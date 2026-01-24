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
    // For web, use the current origin
    return window.location.origin + '/auth/callback';
};

// Initialize Android-specific features
export const initAndroidApp = async (): Promise<void> => {
    if (!isAndroid()) return;

    try {
        // Set status bar style
        // Set status bar style - dark icons on white background (non-overlay mode)
        // This ensures content doesn't render behind the status bar
        await StatusBar.setStyle({ style: Style.Light }); // Light = dark icons on light background
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
        await StatusBar.setOverlaysWebView({ overlay: false }); // IMPORTANT: false = content below status bar

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

// Open OAuth in in-app browser with redirect detection
export const openOAuthInAppBrowser = async (
    url: string,
    onAuthCallback: (accessToken: string, refreshToken: string) => void
): Promise<void> => {
    if (!isNative()) {
        // Web: just redirect
        window.location.href = url;
        return;
    }

    // Listen for browser URL changes to detect OAuth callback
    const urlChangeListener = await Browser.addListener('browserPageLoaded', async () => {
        // This fires when page loads, but we can't get the URL directly
        // Instead, we'll rely on the browserFinished event
    });

    const finishedListener = await Browser.addListener('browserFinished', async () => {
        // Browser was closed - cleanup
        urlChangeListener.remove();
        finishedListener.remove();
    });

    // Open in-app browser (not external)
    await Browser.open({
        url,
        presentationStyle: 'popover',
        toolbarColor: '#f97316'
    });
};

// Open URL in external browser (for OAuth - legacy, kept for compatibility)
export const openOAuthBrowser = async (url: string): Promise<void> => {
    if (isAndroid()) {
        await Browser.open({ url, windowName: '_system' });
    } else {
        window.location.href = url;
    }
};

// Handle deep link URL (OAuth callback)
// Returns the parsed tokens if this is an auth callback
export const setupDeepLinkHandler = (
    onAuthCallback: (accessToken: string, refreshToken: string) => void
): (() => void) => {
    if (!isNative()) return () => { };

    let listenerHandle: { remove: () => void } | null = null;

    // Setup the listener asynchronously
    App.addListener('appUrlOpen', ({ url }) => {
        console.log('[Android] Deep link received:', url);

        // Check if this is an auth callback
        if (url.includes('access_token') || url.includes('auth/callback')) {
            try {
                // Parse tokens from URL - could be hash fragment or query params
                const urlObj = new URL(url);
                let accessToken: string | null = null;
                let refreshToken: string | null = null;

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

                if (accessToken && refreshToken) {
                    console.log('[Android] OAuth tokens received');
                    onAuthCallback(accessToken, refreshToken);
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
