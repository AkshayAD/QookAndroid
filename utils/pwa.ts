// Register Service Worker for PWA support
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('[PWA] Service Worker registered:', registration.scope);

                // Check for updates periodically
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New content available, show refresh prompt if needed
                                console.log('[PWA] New content available');
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        });
    }
}

// PWA Install Prompt Management
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installPromptCallback: ((canInstall: boolean) => void) | null = null;

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Listen for the install prompt
export function setupInstallPrompt(onInstallAvailable: (canInstall: boolean) => void) {
    installPromptCallback = onInstallAvailable;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        onInstallAvailable(true);
        console.log('[PWA] Install prompt available');
    });

    // Check if already installed
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        onInstallAvailable(false);
        console.log('[PWA] App was installed');
    });

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
        onInstallAvailable(false);
    }
}

// Trigger the install prompt
export async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt) {
        console.log('[PWA] No install prompt available');
        return false;
    }

    try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice:', outcome);

        deferredPrompt = null;
        if (installPromptCallback) {
            installPromptCallback(false);
        }

        return outcome === 'accepted';
    } catch (error) {
        console.error('[PWA] Install prompt error:', error);
        return false;
    }
}

// Check if app can be installed
export function canInstall(): boolean {
    return deferredPrompt !== null;
}

// Check if app is running as installed PWA
export function isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
}
