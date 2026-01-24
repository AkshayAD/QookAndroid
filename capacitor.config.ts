import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'in.qook.app',
    appName: 'Qook Commander',
    webDir: 'dist',
    android: {
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: true // Set to false for production
    },
    server: {
        androidScheme: 'https',
        cleartext: false
    },
    plugins: {
        // Enable native HTTP to bypass WebView CORS restrictions
        // This makes fetch() use the device's native HTTP client instead of WebView
        CapacitorHttp: {
            enabled: true
        },
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#f97316',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: false  // CHANGED: was true, caused status bar to be hidden/overlaid
        },
        StatusBar: {
            style: 'LIGHT',          // LIGHT = dark icons on light background
            backgroundColor: '#ffffff',
            overlaysWebView: false   // Content renders BELOW status bar
        },
        Keyboard: {
            resize: 'body' as const,
            resizeOnFullScreen: true
        }
    }
};

export default config;

