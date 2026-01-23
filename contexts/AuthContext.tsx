import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setupDeepLinkHandler, closeOAuthBrowser, isNative } from '../utils/platform';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) {
            // Running in offline mode
            setLoading(false);
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Setup deep link handler for native OAuth callbacks
        const cleanupDeepLink = setupDeepLinkHandler(async (accessToken, refreshToken) => {
            console.log('[Auth] Received OAuth tokens from deep link');
            try {
                // Set the session from the received tokens
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (error) {
                    console.error('[Auth] Error setting session:', error);
                } else {
                    console.log('[Auth] Session set successfully');
                    setSession(data.session);
                    setUser(data.session?.user ?? null);
                    // Close the OAuth browser window
                    await closeOAuthBrowser();
                }
            } catch (err) {
                console.error('[Auth] Exception setting session:', err);
            }
        });

        // Handle visibility change to refresh session when app resumes from background
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && supabase) {
                console.log('[Auth] App resumed, checking session...');
                try {
                    const { data } = await supabase.auth.getSession();
                    if (data.session) {
                        // Session exists, try to refresh for freshness
                        setSession(data.session);
                        setUser(data.session.user);
                    } else {
                        // No session, try to refresh
                        const { data: refreshData, error } = await supabase.auth.refreshSession();
                        if (!error && refreshData.session) {
                            setSession(refreshData.session);
                            setUser(refreshData.session.user);
                            console.log('[Auth] Session refreshed on app resume');
                        }
                    }
                } catch (err) {
                    console.warn('[Auth] Session refresh on resume failed:', err);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            subscription.unsubscribe();
            cleanupDeepLink();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const signOut = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
        setSession(null);
        setUser(null);
    };

    const value: AuthContextType = {
        session,
        user,
        loading,
        signOut,
        isConfigured: isSupabaseConfigured,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
