import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, Settings, Utensils, MessageSquare, HelpCircle, Sparkles, Trash2, Gift, Copy, Check, Crown, Download } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getOrCreateReferralCode } from '../services/referralService';

interface UserMenuProps {
    userEmail: string | null;
    userId?: string | null;
    onSignOut: () => void;
    onOpenSettings?: () => void;
    onOpenPreferences?: () => void;
    onOpenFeedback?: () => void;
    onStartTour?: () => void;
    onOpenPricing?: () => void;
    onDeleteAccount?: () => void;
    onInstallPWA?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({
    userEmail,
    userId,
    onSignOut,
    onOpenSettings,
    onOpenPreferences,
    onOpenFeedback,
    onStartTour,
    onOpenPricing,
    onInstallPWA,
    onDeleteAccount
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { credits, isLaunchTrial, trialDaysRemaining } = useSubscription();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load referral code when userId is available
    useEffect(() => {
        const loadReferral = async () => {
            if (userId) {
                const code = await getOrCreateReferralCode(userId);
                setReferralCode(code);
            }
        };
        loadReferral();
    }, [userId]);

    const handleCopyReferral = async () => {
        if (referralCode) {
            const link = `https://qook.in?ref=${referralCode}`;
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const totalCredits = credits?.total_meal_credits || 0;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-100">
                    <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                        {userEmail || 'User'}
                    </p>
                    <p className="text-xs text-gray-400">
                        Signed in
                    </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {userEmail}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500">Cloud sync enabled</span>
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                {totalCredits} Credits
                            </span>
                            {isLaunchTrial && trialDaysRemaining > 0 && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                    <Crown className="w-3 h-3" />
                                    Pro Trial ({trialDaysRemaining}d)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        {/* Preferences */}
                        {onOpenPreferences && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenPreferences();
                                }}
                                data-tour="preferences-button"
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Utensils className="w-4 h-4 text-gray-500" />
                                Meal Preferences
                            </button>
                        )}

                        {/* AI/Model Settings */}
                        {onOpenSettings && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenSettings();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Settings className="w-4 h-4 text-gray-500" />
                                Settings
                            </button>
                        )}

                        {/* Plans/Pricing */}
                        {onOpenPricing && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenPricing();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                            >
                                <Sparkles className="w-4 h-4" />
                                Plans & Credits
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>

                    {/* Help Section */}
                    <div className="py-1">
                        {/* Tour */}
                        {onStartTour && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onStartTour();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <HelpCircle className="w-4 h-4 text-gray-500" />
                                App Tour
                            </button>
                        )}

                        {/* Install Webapp */}
                        {onInstallPWA && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onInstallPWA();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Install Webapp
                            </button>
                        )}

                        {/* Feedback */}
                        {onOpenFeedback && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenFeedback();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <MessageSquare className="w-4 h-4 text-gray-500" />
                                Send Feedback
                            </button>
                        )}
                    </div>

                    {/* Referral Section - Single Share Button */}
                    {referralCode && (
                        <div className="py-1">
                            <button
                                onClick={async () => {
                                    const link = `https://qook.in?ref=${referralCode}`;
                                    const message = `Hey! 👋

I've been using Qook Commander to plan my weekly meals and it's amazing! 🍽️

The AI creates personalized meal plans based on my taste, and even generates grocery lists automatically.

Sign up using my link and we BOTH get 3 free credits! 🎁

${link}`;

                                    // Try native share first (works on mobile)
                                    if (navigator.share) {
                                        try {
                                            await navigator.share({
                                                title: 'Try Qook Commander - AI Meal Planner',
                                                text: message,
                                            });
                                            setIsOpen(false);
                                            return;
                                        } catch (e) {
                                            // User cancelled or share failed, fallback to copy
                                        }
                                    }

                                    // Fallback: copy link and show copied feedback
                                    await navigator.clipboard.writeText(link);
                                    setCopied(true);
                                    setTimeout(() => {
                                        setCopied(false);
                                        // Also open WhatsApp after copying
                                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                                        setIsOpen(false);
                                    }, 1500);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 transition-colors"
                            >
                                <Gift className="w-4 h-4" />
                                <span>{copied ? 'Link Copied!' : 'Share Referral & Earn Credits'}</span>
                            </button>
                        </div>
                    )}

                    {/* Sign Out */}
                    <div className="py-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onSignOut();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;
