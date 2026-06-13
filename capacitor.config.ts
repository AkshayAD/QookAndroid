import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'in.qook.app',
    appName: 'Qook',
    webDir: 'dist',
    android: {
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false
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
            launchAutoHide: false,
            backgroundColor: '#f97316',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: false,
            splashImmersive: false  // CHANGED: was true, caused status bar to be hidden/overlaid
        }
    }
};

export default config;
