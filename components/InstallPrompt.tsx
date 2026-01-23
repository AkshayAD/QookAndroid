import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Gift } from 'lucide-react';
import { setupInstallPrompt, promptInstall, isInstalled } from '../utils/pwa';
import { useAuth } from '../contexts/AuthContext';
import { completeTrustAction, hasCompletedAction } from '../services/trustActions';

interface Props {
    variant?: 'banner' | 'button' | 'menu-item' | 'settings';
    showCreditReward?: boolean;
}

const InstallPrompt: React.FC<Props> = ({ variant = 'banner', showCreditReward = true }) => {
    const { user } = useAuth();
    const [canInstall, setCanInstall] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [alreadyRewarded, setAlreadyRewarded] = useState(false);

    useEffect(() => {
        // Check if already dismissed this session
        const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
        if (wasDismissed) {
            setDismissed(true);
        }

        // Check if already installed
        if (isInstalled()) {
            setCanInstall(false);
            return;
        }

        // Check if already got the trust credit
        if (user) {
            hasCompletedAction(user.id, 'install_pwa').then(completed => {
                setAlreadyRewarded(completed);
            });
        }

        // Setup install prompt listener
        setupInstallPrompt((available) => {
            setCanInstall(available);
        });
    }, [user]);

    const handleInstall = async () => {
        setInstalling(true);
        const accepted = await promptInstall();
        setInstalling(false);

        if (accepted) {
            setCanInstall(false);

            // Award trust credit if not already awarded
            if (user && !alreadyRewarded) {
                try {
                    const result = await completeTrustAction(user.id, 'install_pwa');
                    if (result.creditsAwarded > 0) {
                        // Toast will be shown by the trust action service
                    }
                } catch (err) {
                    console.error('Failed to award PWA install credit:', err);
                }
            }
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('pwa-install-dismissed', 'true');
    };

    // Don't show if can't install or dismissed
    if (!canInstall || dismissed) {
        return null;
    }

    // Settings variant with credit reward display
    if (variant === 'settings') {
        return (
            <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-gray-800">Install Qook Commander</p>
                        <p className="text-sm text-gray-600">Add to home screen for quick access</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {showCreditReward && !alreadyRewarded && (
                            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                <Gift className="w-3 h-3" /> +1 credit
                            </span>
                        )}
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                        >
                            {installing ? '...' : 'Install'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Menu item variant (for dropdown menus)
    if (variant === 'menu-item') {
        return (
            <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
                <Download className="w-4 h-4 text-orange-500" />
                <span className="flex-1">{installing ? 'Installing...' : 'Install App'}</span>
                {showCreditReward && !alreadyRewarded && (
                    <span className="text-xs text-orange-500 font-medium">+1 credit</span>
                )}
            </button>
        );
    }

    // Button variant (compact)
    if (variant === 'button') {
        return (
            <button
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-md"
            >
                <Download className="w-4 h-4" />
                <span>{installing ? 'Installing...' : 'Install App'}</span>
                {showCreditReward && !alreadyRewarded && (
                    <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded">+1</span>
                )}
            </button>
        );
    }

    // Banner variant (default - shown at top/bottom)
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg safe-area-inset-bottom animate-in slide-in-from-bottom duration-300">
            <div className="max-w-lg mx-auto flex items-center gap-4">
                <div className="flex-shrink-0 p-2 bg-white/20 rounded-xl">
                    <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Install Qook</p>
                    <p className="text-xs text-orange-100 truncate">
                        {showCreditReward && !alreadyRewarded
                            ? 'Install now and earn +1 credit!'
                            : 'Add to home screen for the best experience'}
                    </p>
                </div>
                <button
                    onClick={handleInstall}
                    disabled={installing}
                    className="flex-shrink-0 px-4 py-2 bg-white text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-50 transition-colors"
                >
                    {installing ? '...' : 'Install'}
                </button>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;

