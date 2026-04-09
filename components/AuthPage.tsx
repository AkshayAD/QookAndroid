import React, { useState } from 'react';
import { AlertTriangle, ChefHat } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import GoogleSignInButton from './GoogleSignInButton';
import { isNative } from '../utils/platform';

interface AuthPageProps {
    onSkipAuth?: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onSkipAuth }) => {
    const [error, setError] = useState<string | null>(null);
    const nativePlatform = isNative();

    if (!isSupabaseConfigured || !supabase) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Qook Login Is Unavailable</h1>
                    <p className="text-gray-600 mb-6">
                        Google sign-in needs Supabase credentials in this environment before Qook can connect your account.
                    </p>
                    <div className="bg-gray-50 rounded-xl p-4 text-left text-sm font-mono text-gray-700 mb-6">
                        <p>VITE_SUPABASE_URL=your-url</p>
                        <p>VITE_SUPABASE_ANON_KEY=your-key</p>
                    </div>
                    {onSkipAuth && (
                        <button
                            onClick={onSkipAuth}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                        >
                            Continue in Offline Mode
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="bg-orange-500 p-3 rounded-xl shadow-lg shadow-orange-200">
                        <ChefHat className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Qook</h1>
                        <p className="text-sm text-gray-500">Smart weekly meal planning for your home</p>
                    </div>
                </div>

                <div className="text-center mb-6">
                    <p className="text-base font-semibold text-gray-900">Continue with Google</p>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in with your Google account to open your Qook dashboard.
                    </p>
                </div>

                <div className="space-y-4">
                    <GoogleSignInButton
                        mode="auto"
                        onError={(nextError) => setError(nextError)}
                        showUnavailableMessage={true}
                        fallbackButtonClassName="w-full py-3 px-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-50"
                        fallbackLabel="Continue with Google"
                        fallbackLoadingLabel="Signing in with Google..."
                    />

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                            {error}
                        </div>
                    )}
                </div>

                {nativePlatform ? (
                    <div className="mt-6 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700 border border-orange-100">
                        Qook signs you in securely with your Google account and opens your kitchen directly.
                    </div>
                ) : (
                    <div className="mt-6 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700 border border-orange-100">
                        Qook signs you in with Google directly on <span className="font-semibold">qook.in</span>.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthPage;
