import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { closeOAuthBrowser, setupDeepLinkHandler } from '../utils/platform';
import { signOutFromNativeGoogle } from '../lib/nativeGoogleAuth';

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
        const cleanupDeepLink = setupDeepLinkHandler(async ({ accessToken, refreshToken, code }) => {
            console.log('[Auth] Received OAuth callback from deep link');
            try {
                if (accessToken && refreshToken) {
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    if (error) {
                        console.error('[Auth] Error setting session:', error);
                    } else {
                        console.log('[Auth] Session set successfully from tokens');
                        setSession(data.session);
                        setUser(data.session?.user ?? null);
                    }
                } else if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        console.error('[Auth] Error exchanging OAuth code:', error);
                    } else {
                        console.log('[Auth] Session exchanged successfully from code');
                        setSession(data.session);
                        setUser(data.session?.user ?? null);
                    }
                }

                await closeOAuthBrowser();
            } catch (err) {
                console.error('[Auth] Exception handling OAuth callback:', err);
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
        await signOutFromNativeGoogle();
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
