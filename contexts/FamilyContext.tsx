/**
 * Family Context
 * Provides app-wide family mode state and credit pool integration
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
    FamilyGroup,
    FamilyMember,
    FamilyCreditPool,
    getUserFamilyGroup,
    getFamilyMembers,
    getFamilyCreditPool,
    subscribeToFamilyGroup,
    isInFamilyMode,
    isFamilyOwner
} from '../services/familyService';

interface FamilyContextType {
    // Family status
    familyGroup: FamilyGroup | null;
    members: FamilyMember[];
    isInFamily: boolean;
    isOwner: boolean;
    loading: boolean;

    // Mode toggle: Personal vs Family
    isFamilyModeActive: boolean;  // Is the user viewing family meals?
    toggleFamilyMode: () => void; // Switch between modes
    setFamilyModeActive: (active: boolean) => void;

    // Credit pool (for family mode)
    familyCredits: number;

    // Actions
    refreshFamily: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

const FAMILY_MODE_STORAGE_KEY = 'qook_family_mode_active';

export function FamilyProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [creditPool, setCreditPool] = useState<FamilyCreditPool | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isFamilyModeActive, setIsFamilyModeActive] = useState<boolean>(() => {
        // Initialize from localStorage
        const saved = localStorage.getItem(FAMILY_MODE_STORAGE_KEY);
        return saved !== null ? saved === 'true' : true; // Default to family mode on
    });

    // Load family data
    const loadFamilyData = async () => {
        if (!user?.id) {
            setFamilyGroup(null);
            setMembers([]);
            setCreditPool(null);
            setIsOwner(false);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const group = await getUserFamilyGroup();
            setFamilyGroup(group);

            if (group) {
                const [memberList, pool, ownerStatus] = await Promise.all([
                    getFamilyMembers(group.id),
                    getFamilyCreditPool(group.id),
                    isFamilyOwner()
                ]);
                setMembers(memberList);
                setCreditPool(pool);
                setIsOwner(ownerStatus);
            } else {
                setMembers([]);
                setCreditPool(null);
                setIsOwner(false);
            }
        } catch (error) {
            console.error('Error loading family data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFamilyData();
    }, [user?.id]);

    // Real-time subscription
    useEffect(() => {
        if (!familyGroup?.id) return;

        const unsubscribe = subscribeToFamilyGroup(
            familyGroup.id,
            (newMembers) => setMembers(newMembers),
            (newPool) => setCreditPool(newPool)
        );

        return () => unsubscribe();
    }, [familyGroup?.id]);

    const refreshFamily = async () => {
        await loadFamilyData();
    };

    // Toggle family mode
    const toggleFamilyMode = () => {
        if (!familyGroup?.is_active) return; // Can only toggle if in a family
        const newValue = !isFamilyModeActive;
        setIsFamilyModeActive(newValue);
        localStorage.setItem(FAMILY_MODE_STORAGE_KEY, String(newValue));
    };

    // Set family mode explicitly
    const setFamilyModeActiveHandler = (active: boolean) => {
        if (!familyGroup?.is_active && active) return; // Can't enable if not in family
        setIsFamilyModeActive(active);
        localStorage.setItem(FAMILY_MODE_STORAGE_KEY, String(active));
    };

    const value: FamilyContextType = {
        familyGroup,
        members,
        isInFamily: !!familyGroup?.is_active,
        isOwner,
        loading,
        isFamilyModeActive: !!familyGroup?.is_active && isFamilyModeActive,
        toggleFamilyMode,
        setFamilyModeActive: setFamilyModeActiveHandler,
        familyCredits: creditPool?.total_credits ?? 0,
        refreshFamily
    };

    return (
        <FamilyContext.Provider value={value}>
            {children}
        </FamilyContext.Provider>
    );
}

export function useFamily() {
    const context = useContext(FamilyContext);
    if (context === undefined) {
        // Return safe defaults if used outside provider
        return {
            familyGroup: null,
            members: [],
            isInFamily: false,
            isOwner: false,
            loading: false,
            isFamilyModeActive: false,
            toggleFamilyMode: () => { },
            setFamilyModeActive: () => { },
            familyCredits: 0,
            refreshFamily: async () => { }
        };
    }
    return context;
}

/**
 * Hook to get the current family group ID for meal operations
 * Returns the family group ID if in family mode, null otherwise
 */
export function useActiveFamilyGroupId(): string | null {
    const { isInFamily, isFamilyModeActive, familyGroup } = useFamily();
    if (isInFamily && isFamilyModeActive && familyGroup) {
        return familyGroup.id;
    }
    return null;
}
