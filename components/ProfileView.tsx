import React, { useState, useEffect } from 'react';
import { User, LogOut, Settings, Utensils, MessageSquare, HelpCircle, Sparkles, Gift, Check, ChevronRight, Mail, Heart } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getOrCreateReferralCode } from '../services/referralService';

interface ProfileViewProps {
    userEmail: string | null;
    userId?: string | null;
    onSignOut: () => Promise<void> | void;
    onOpenSettings?: () => void;
    onOpenPreferences?: () => void;
    onOpenFeedback?: () => void;
    onStartTour?: () => void;
    onOpenPricing?: () => void;
    onDeleteAccount?: () => void;
    onOpenSavedRecipes?: () => void;
}

export default function ProfileView({
    userEmail,
    userId,
    onSignOut,
    onOpenSettings,
    onOpenPreferences,
    onOpenFeedback,
    onStartTour,
    onOpenPricing,
    onDeleteAccount,
    onOpenSavedRecipes
}: ProfileViewProps) {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { credits } = useSubscription();

    const totalCredits = credits?.total_meal_credits || 0;

    // Load referral code
    useEffect(() => {
        const loadReferral = async () => {
            if (userId) {
                const code = await getOrCreateReferralCode(userId);
                setReferralCode(code);
            }
        };
        loadReferral();
    }, [userId]);

    const handleShareReferral = async () => {
        if (!referralCode) return;

        const link = `https://qook.in?ref=${referralCode}`;
        const message = `Hey! 👋\n\nI've been using Qook Commander to plan my weekly meals and it's amazing! 🍽️\n\nThe AI creates personalized meal plans based on my taste, and even generates grocery lists automatically.\n\nSign up using my link and we BOTH get 3 free credits! 🎁\n\n${link}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Try Qook Commander',
                    text: message,
                });
                return;
            } catch (e) {
                // Ignore cancel
            }
        }

        // Fallback
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        }, 1500);
    };

    return (
        <div className="flex flex-col bg-gray-50">
            {/* Header Profile Card */}
            <div className="bg-white p-6 pb-8 border-b border-gray-100 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center mb-4 shadow-sm">
                    <User className="w-10 h-10 text-orange-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">{userEmail?.split('@')[0] || 'User'}</h1>
                <p className="text-sm text-gray-500 mb-6">{userEmail}</p>

                {/* Stats Row */}
                <div className="flex gap-4 w-full max-w-xs">
                    <div className="flex-1 bg-orange-50 rounded-xl p-3 border border-orange-100 flex flex-col items-center">
                        <span className="text-2xl font-bold text-orange-600">{totalCredits}</span>
                        <span className="text-xs text-orange-600 font-medium uppercase tracking-wide">Credits</span>
                    </div>
                    <div className="flex-1 bg-indigo-50 rounded-xl p-3 border border-indigo-100 flex flex-col items-center">
                        <span className="text-2xl font-bold text-indigo-600">Free</span>
                        <span className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Plan</span>
                    </div>
                </div>
            </div>

            {/* Menu List */}
            <div className="p-4 space-y-4">
                {/* Main Settings Group */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <MenuItem
                        icon={Sparkles}
                        label="Plans & Credits"
                        onClick={onOpenPricing}
                        color="text-orange-600"
                    />
                    <Divider />
                    <MenuItem
                        icon={Utensils}
                        label="Meal Preferences"
                        onClick={onOpenPreferences}
                    />
                    <Divider />
                    <MenuItem
                        icon={Heart}
                        label="Saved Recipes"
                        onClick={onOpenSavedRecipes}
                        color="text-red-500"
                    />
                    <Divider />
                    <MenuItem
                        icon={Settings}
                        label="Settings"
                        onClick={onOpenSettings}
                    />
                </div>

                {/* Referral Group */}
                {referralCode && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <MenuItem
                            icon={Gift}
                            label={copied ? "Link Copied!" : "Share & Earn Credits"}
                            onClick={handleShareReferral}
                            color="text-green-600"
                            rightElement={copied ? <Check className="w-5 h-5 text-green-600" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
                        />
                    </div>
                )}

                {/* Support Group */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <MenuItem
                        icon={HelpCircle}
                        label="App Tour"
                        onClick={onStartTour}
                    />
                    <Divider />
                    <MenuItem
                        icon={MessageSquare}
                        label="Send Feedback"
                        onClick={onOpenFeedback}
                    />
                </div>

                {/* Sign Out */}
                <button
                    onClick={async () => {
                        await onSignOut();
                    }}
                    className="w-full bg-white rounded-2xl p-4 flex items-center justify-center gap-2 text-red-600 font-medium border border-gray-200 shadow-sm active:bg-red-50 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>

                <div className="text-center text-xs text-gray-400 py-4">
                    v1.0.0 • Qook Commander
                </div>
            </div>
        </div>
    );
}

// Subcomponents
function MenuItem({ icon: Icon, label, onClick, color = "text-gray-700", rightElement }: any) {
    if (!onClick) return null;
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color === 'text-orange-600' ? 'bg-orange-50' : color === 'text-green-600' ? 'bg-green-50' : 'bg-gray-100'}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <span className={`font-medium ${color}`}>{label}</span>
            </div>
            {rightElement || <ChevronRight className="w-5 h-5 text-gray-300" />}
        </button>
    );
}

function Divider() {
    return <div className="h-px bg-gray-100 mx-4" />;
}
