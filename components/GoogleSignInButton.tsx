import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
    canUseHostedNativeAuthFallback,
    getGoogleSignInMode,
    getGoogleSignInUnavailableMessage,
    openNativeGoogleAuthHandoff,
    type GoogleSignInMode,
    signInWithNativeGoogleIdToken,
    signInWithGoogleIdToken,
    googleWebClientId,
} from '../lib/googleAuth';
import {
    isNativeGoogleAuthCancellation,
    shouldFallbackToHostedGoogleAuth,
} from '../lib/nativeGoogleAuth';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential?: string }) => void;
                        nonce?: string;
                    }) => void;
                    renderButton: (
                        parent: HTMLElement,
                        options: {
                            type?: 'standard' | 'icon';
                            theme?: 'outline' | 'filled_blue' | 'filled_black';
                            size?: 'large' | 'medium' | 'small';
                            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
                            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
                            logo_alignment?: 'left' | 'center';
                            width?: number;
                        }
                    ) => void;
                };
            };
        };
    }
}

const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleIdentityScriptPromise: Promise<void> | null = null;

const loadGoogleIdentityScript = (): Promise<void> => {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Google sign-in is only available in the browser.'));
    }

    if (window.google?.accounts?.id) {
        return Promise.resolve();
    }

    if (googleIdentityScriptPromise) {
        return googleIdentityScriptPromise;
    }

    googleIdentityScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Google sign-in.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google sign-in.'));
        document.head.appendChild(script);
    });

    return googleIdentityScriptPromise;
};

const GoogleMark = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

interface GoogleSignInButtonProps {
    mode?: 'auto' | GoogleSignInMode;
    onError?: (message: string) => void;
    onSuccess?: () => void | Promise<void>;
    showUnavailableMessage?: boolean;
    fallbackButtonClassName?: string;
    fallbackLabel?: string;
    fallbackLoadingLabel?: string;
}

const defaultFallbackClassName = 'w-full py-4 px-4 bg-white border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-50';

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
    mode = 'auto',
    onError,
    onSuccess,
    showUnavailableMessage = false,
    fallbackButtonClassName = defaultFallbackClassName,
    fallbackLabel = 'Continue with Google',
    fallbackLoadingLabel = 'Signing In...',
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNativeLoading, setIsNativeLoading] = useState(false);

    const resolvedMode = useMemo<GoogleSignInMode>(() => (
        mode === 'auto' ? getGoogleSignInMode() : mode
    ), [mode]);

    useEffect(() => {
        if (resolvedMode !== 'web-gis' || !containerRef.current) {
            return;
        }

        let isCancelled = false;
        const renderButton = async () => {
            try {
                await loadGoogleIdentityScript();

                if (isCancelled || !containerRef.current || !window.google?.accounts?.id) {
                    return;
                }

                containerRef.current.innerHTML = '';

                window.google.accounts.id.initialize({
                    client_id: googleWebClientId,
                    callback: async ({ credential }) => {
                        if (!credential) {
                            onError?.('Google sign-in did not return a valid token.');
                            return;
                        }

                        setIsSubmitting(true);

                        try {
                            await signInWithGoogleIdToken(credential);
                            await onSuccess?.();
                        } catch (error) {
                            const message = error instanceof Error ? error.message : 'Google sign-in failed.';
                            onError?.(message);
                        } finally {
                            setIsSubmitting(false);
                        }
                    },
                });

                window.google.accounts.id.renderButton(containerRef.current, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    shape: 'pill',
                    logo_alignment: 'left',
                    width: Math.max(280, Math.floor(containerRef.current.getBoundingClientRect().width || 320)),
                });

                setIsReady(true);
            } catch (error) {
                setIsReady(false);
                const message = error instanceof Error ? error.message : 'Google sign-in failed to load.';
                onError?.(message);
            }
        };

        renderButton();

        return () => {
            isCancelled = true;
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [resolvedMode, onError, onSuccess]);

    if (resolvedMode === 'web-gis') {
        return (
            <div className="space-y-3">
                <div ref={containerRef} className="min-h-[44px] w-full" />
                {(!isReady || isSubmitting) && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isSubmitting ? 'Finishing sign-in...' : 'Loading Google sign-in...'}</span>
                    </div>
                )}
            </div>
        );
    }

    if (resolvedMode === 'native-direct') {
        return (
            <button
                type="button"
                onClick={async () => {
                    setIsNativeLoading(true);
                    try {
                        await signInWithNativeGoogleIdToken();
                        await onSuccess?.();
                    } catch (error) {
                        if (isNativeGoogleAuthCancellation(error)) {
                            setIsNativeLoading(false);
                            return;
                        }

                        if (shouldFallbackToHostedGoogleAuth(error) && canUseHostedNativeAuthFallback()) {
                            try {
                                await openNativeGoogleAuthHandoff(() => {
                                    setIsNativeLoading(false);
                                });
                                return;
                            } catch (fallbackError) {
                                const fallbackMessage = fallbackError instanceof Error
                                    ? fallbackError.message
                                    : 'Qook could not open Google sign-in.';
                                onError?.(fallbackMessage);
                                return;
                            }
                        }

                        const message = error instanceof Error ? error.message : 'Google sign-in failed.';
                        onError?.(message);
                    } finally {
                        setIsNativeLoading(false);
                    }
                }}
                disabled={isNativeLoading}
                className={fallbackButtonClassName}
            >
                {isNativeLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <GoogleMark />
                )}
                <span>{isNativeLoading ? fallbackLoadingLabel : fallbackLabel}</span>
            </button>
        );
    }

    if (!showUnavailableMessage) {
        return null;
    }

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            {getGoogleSignInUnavailableMessage()}
        </div>
    );
};

export default GoogleSignInButton;
