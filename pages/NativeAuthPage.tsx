import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildNativeAppCallbackUrl } from '../lib/googleAuth';
import GoogleSignInButton from '../components/GoogleSignInButton';

async function redirectSessionToApp() {
    if (!supabase) {
        throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw error;
    }

    const session = data.session;
    if (!session?.access_token || !session.refresh_token) {
        throw new Error('Qook could not create a mobile session from Google sign-in.');
    }

    window.location.replace(buildNativeAppCallbackUrl(session.access_token, session.refresh_token));
}

export default function NativeAuthPage() {
    const [error, setError] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);

    const completeNativeHandoff = useCallback(async () => {
        setRedirecting(true);
        setError(null);

        try {
            await redirectSessionToApp();
        } catch (handoffError) {
            setRedirecting(false);
            setError(handoffError instanceof Error ? handoffError.message : 'Google sign-in failed.');
        }
    }, []);

    useEffect(() => {
        void (async () => {
            if (!supabase) {
                return;
            }

            const { data } = await supabase.auth.getSession();
            if (data.session?.access_token && data.session.refresh_token) {
                void completeNativeHandoff();
            }
        })();
    }, [completeNativeHandoff]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-orange-100 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
                        <span className="text-2xl text-white">Q</span>
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">Qook</p>
                    <h1 className="mt-3 text-3xl font-bold text-gray-900">Continue to the Qook app</h1>
                    <p className="mt-3 text-sm text-gray-600">
                        Use your Google account to finish sign-in and return to Qook on your phone.
                    </p>
                </div>

                <div className="mt-8 space-y-4">
                    {redirecting ? (
                        <div className="flex items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-4 text-sm font-medium text-orange-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Returning you to the Qook app...
                        </div>
                    ) : (
                        <GoogleSignInButton
                            mode="web-gis"
                            onError={(nextError) => setError(nextError)}
                            onSuccess={completeNativeHandoff}
                            showUnavailableMessage={true}
                        />
                    )}

                    {error && (
                        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
