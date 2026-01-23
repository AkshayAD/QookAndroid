import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as supabaseService from '../services/supabaseService';

interface SettingsContextType {
    apiKey: string;
    setApiKey: (key: string) => void;
    modelName: string;
    isAuthenticated: boolean;
    cookName: string;
    setCookName: (name: string) => void;
    cookNumber: string;
    setCookNumber: (number: string) => void;
    syncSettings: () => Promise<void>;
}

// Default model - Gemini 3 Flash Preview with thinking capabilities
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const API_KEY_STORAGE = 'qookcommander_gemini_api_key';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const userId = user?.id || 'local';

    const [apiKey, setApiKeyState] = useState('');
    const [cookName, setCookNameState] = useState('');
    const [cookNumber, setCookNumberState] = useState('');

    // Sync settings from Supabase on login (cook contact only)
    const syncSettings = useCallback(async () => {
        // API key stays local only
        const storedKey = localStorage.getItem(API_KEY_STORAGE);
        if (storedKey) setApiKeyState(storedKey);

        // Cook contact syncs from Supabase
        const settings = await supabaseService.getUserSettings(userId);
        if (settings) {
            setCookNameState(settings.cookName);
            setCookNumberState(settings.cookWhatsappNumber);
        }
    }, [userId]);

    useEffect(() => {
        syncSettings();
    }, [syncSettings]);

    // API key stays in localStorage only (not synced to Supabase)
    const setApiKey = useCallback((key: string) => {
        setApiKeyState(key);
        localStorage.setItem(API_KEY_STORAGE, key);
    }, []);

    const setCookName = useCallback((name: string) => {
        setCookNameState(name);
        supabaseService.saveUserSettings(userId, { cookName: name });
    }, [userId]);

    const setCookNumber = useCallback((number: string) => {
        setCookNumberState(number);
        supabaseService.saveUserSettings(userId, { cookWhatsappNumber: number });
    }, [userId]);

    // API key is now handled server-side for security
    // User's BYOK key (if any) is passed to proxy which uses platform key as fallback
    // The server-side proxy at /api/ai-proxy keeps the platform key secure

    const value = {
        apiKey, // User's BYOK key only (empty if not set)
        setApiKey,
        modelName: DEFAULT_MODEL,
        isAuthenticated: true, // Always true - proxy handles auth
        cookName,
        setCookName,
        cookNumber,
        setCookNumber,
        syncSettings
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
