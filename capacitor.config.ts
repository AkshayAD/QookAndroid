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
            splashImmersive: true
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#ffffff',
            overlaysWebView: false // Set to false so app content doesn't go behind status bar
        },
        Keyboard: {
            resize: 'body' as const,
            resizeOnFullScreen: true
        }
    }
};

export default config;

