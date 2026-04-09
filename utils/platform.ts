// Platform detection and Android-specific utilities
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Platform detection helpers
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';
export const isNative = (): boolean => Capacitor.isNativePlatform();
export const isWeb = (): boolean => Capacitor.getPlatform() === 'web';

export const cleanupLegacyWebViewState = async (): Promise<void> => {
    if (typeof window === 'undefined') {
        return;
    }

    const shouldCleanupCaches = isNative()
        || window.location.protocol === 'capacitor:'
        || window.location.hostname === 'localhost';

    if (!shouldCleanupCaches) {
        return;
    }

    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        }

        console.log('[Platform] Cleared legacy service workers and caches');
    } catch (error) {
        console.warn('[Platform] Failed to clear legacy service workers and caches', error);
    }
};

// Production backend URL for API calls
// CRITICAL: Must use www.qook.in (not qook.in) to avoid 307 redirect which breaks CORS preflight
const PRODUCTION_API_URL = 'https://www.qook.in';

/**
 * Get the API base URL for fetch calls.
 * - Native apps (Android/iOS): Use production URL since there's no local server
 * - Web: Use relative URLs (empty string) to hit the same origin
 */
export const getApiBaseUrl = (): string => {
    if (isNative()) {
        return PRODUCTION_API_URL;
    }
    return '';
};

// Get the correct OAuth redirect URL based on platform
export const getOAuthRedirectUrl = (): string => {
    if (isNative()) {
        // For native apps, use custom URL scheme which guarantees return to app
        // This URL scheme is registered in AndroidManifest.xml
        return 'in.qook.app://auth/callback';
    }
    return window.location.origin + '/dashboard';
};

export const openHostedAuthBrowser = async (
    url: string,
    onBrowserFinished?: () => void
): Promise<void> => {
    if (!isNative()) {
        window.location.href = url;
        return;
    }

    const finishedListener = await Browser.addListener('browserFinished', async () => {
        finishedListener.remove();
        onBrowserFinished?.();
    });

    try {
        await Browser.open({
            url,
            presentationStyle: 'popover',
            toolbarColor: '#f97316',
        });
    } catch (error) {
        finishedListener.remove();
        throw error;
    }
};

// Initialize Android-specific features
export const initAndroidApp = async (): Promise<void> => {
    if (!isAndroid()) return;

    try {
        // Status bar defaults come from Capacitor config.
        // These runtime calls re-assert the same values on Android resume.
        try {
            await StatusBar.setStyle({ style: Style.Light }); // Light = dark icons
            await StatusBar.setBackgroundColor({ color: '#ffffff' });
            await StatusBar.setOverlaysWebView({ overlay: false });
        } catch (e) {
            console.log('[Android] StatusBar plugin not available:', e);
        }

        // Hide splash screen after app is ready
        await SplashScreen.hide();

        // Handle hardware back button
        App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                App.exitApp();
            }
        });

        // Handle keyboard for better form UX
        Keyboard.addListener('keyboardWillShow', (info) => {
            document.body.style.paddingBottom = `${info.keyboardHeight}px`;
        });

        Keyboard.addListener('keyboardWillHide', () => {
            document.body.style.paddingBottom = '0';
        });

        console.log('[Android] App initialized successfully');
    } catch (error) {
        console.error('[Android] Initialization error:', error);
    }
};

// Handle deep link URL (OAuth callback)
// Returns the parsed tokens if this is an auth callback
export const setupDeepLinkHandler = (
    onAuthCallback: (payload: { accessToken?: string | null; refreshToken?: string | null; code?: string | null; url: string }) => void
): (() => void) => {
    if (!isNative()) return () => { };

    let listenerHandle: { remove: () => void } | null = null;

    // Setup the listener asynchronously
    App.addListener('appUrlOpen', ({ url }) => {
        console.log('[Android] Deep link received:', url);

        if (!url.startsWith('in.qook.app://auth/callback')) {
            return;
        }

        // Check if this is an auth callback
        if (url.includes('access_token') || url.includes('auth/callback')) {
            try {
                // Parse tokens from URL - could be hash fragment or query params
                const urlObj = new URL(url);
                let accessToken: string | null = null;
                let refreshToken: string | null = null;
                let code: string | null = null;

                // Try hash fragment first (Supabase implicit flow)
                if (urlObj.hash) {
                    const hashParams = new URLSearchParams(urlObj.hash.substring(1));
                    accessToken = hashParams.get('access_token');
                    refreshToken = hashParams.get('refresh_token');
                }

                // Fall back to query params
                if (!accessToken) {
                    accessToken = urlObj.searchParams.get('access_token');
                    refreshToken = urlObj.searchParams.get('refresh_token');
                }

                code = urlObj.searchParams.get('code');

                if (accessToken || code || url.includes('auth/callback')) {
                    console.log('[Android] OAuth callback received');
                    onAuthCallback({
                        accessToken,
                        refreshToken,
                        code,
                        url,
                    });
                }
            } catch (error) {
                console.error('[Android] Error parsing auth callback:', error);
            }
        }
    }).then(handle => {
        listenerHandle = handle;
    });

    // Return cleanup function
    return () => {
        if (listenerHandle) {
            listenerHandle.remove();
        }
    };
};

// Close the in-app browser (call after successful auth)
export const closeOAuthBrowser = async (): Promise<void> => {
    if (isNative()) {
        try {
            await Browser.close();
        } catch (e) {
            // Browser may already be closed
        }
    }
};

// Clean up listeners when needed
export const cleanupAndroidListeners = async (): Promise<void> => {
    if (!isAndroid()) return;

    await App.removeAllListeners();
    await Keyboard.removeAllListeners();
};
