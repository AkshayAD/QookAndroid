import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { resolvePostAuthDestination } from '../lib/googleAuth';

export default function AuthCallbackPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [finalizing, setFinalizing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const finalizeAuth = async () => {
            if (loading) {
                return;
            }

            const code = new URL(window.location.href).searchParams.get('code');
            if (!code || !supabase || user) {
                if (isActive) {
                    setFinalizing(false);
                }
                return;
            }

            try {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                if (exchangeError) {
                    throw exchangeError;
                }
            } catch (exchangeError) {
                if (isActive) {
                    setError(exchangeError instanceof Error ? exchangeError.message : 'Sign-in failed.');
                }
            } finally {
                if (isActive) {
                    setFinalizing(false);
                }
            }
        };

        void finalizeAuth();

        return () => {
            isActive = false;
        };
    }, [loading, user]);

    useEffect(() => {
        if (loading || finalizing) {
            return;
        }

        navigate(resolvePostAuthDestination(Boolean(user)), { replace: true });
    }, [finalizing, loading, navigate, user]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                    {error ? 'Redirecting you back to Qook...' : 'Finishing sign-in...'}
                </p>
                {error && (
                    <p className="mt-2 text-xs text-red-600">{error}</p>
                )}
            </div>
        </div>
    );
}
