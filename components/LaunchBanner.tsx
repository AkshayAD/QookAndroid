import React, { useState } from 'react';
import { X, Gift, Sparkles, Crown, Zap, Brain } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';

interface LaunchBannerProps {
    onShowPricing?: () => void;
}

export default function LaunchBanner({ onShowPricing }: LaunchBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    const { subscription, credits, isTrialActive, plans } = useSubscription();

    // Get subscription info
    const currentPlan = plans.find(p => p.id === subscription?.plan_id);
    const planName = currentPlan?.name || 'Free Trial';
    const isTrial = isTrialActive || subscription?.plan_id === 'free';
    const isPaid = subscription?.plan_id && ['basic', 'pro', 'byok'].includes(subscription.plan_id);
    const isByok = subscription?.plan_id === 'byok';

    // Calculate days remaining for trial
    const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    // Unified credits display
    const totalCredits = credits?.total_meal_credits || 0;
    const weeklyBonus = currentPlan?.weekly_bonus_meals || 1; // Default to free tier (1/week)

    // Banner gradient based on plan
    const gradientClass = isPaid
        ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600'
        : 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500';

    // Use CSS-based collapse for smooth transition (no gap when dismissed)
    return (
        <div
            className={`${gradientClass} text-white relative overflow-hidden transition-all duration-300 ease-out ${dismissed ? 'max-h-0 py-0 opacity-0' : 'max-h-14'}`}
            style={{ willChange: 'max-height, opacity' }}
        >
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-1/4 w-24 h-24 bg-white rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-20 h-20 bg-yellow-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="max-w-7xl mx-auto px-4 py-1.5 relative z-10">
                <div className="flex items-center justify-between gap-2">
                    {/* Main Content - Marquee Animation */}
                    <div className="flex-1 overflow-hidden relative">
                        <style>{`
                            @keyframes marquee {
                                0% { transform: translateX(0); }
                                100% { transform: translateX(-50%); }
                            }
                            .marquee-content {
                                animation: marquee 25s linear infinite;
                            }
                            .marquee-content:hover {
                                animation-play-state: paused;
                            }
                        `}</style>
                        <div className="marquee-content flex items-center gap-6 whitespace-nowrap">
                            {/* Content repeated for seamless loop */}
                            {[0, 1].map((i) => (
                                <div key={i} className="flex items-center gap-4 pr-8">
                                    {/* Plan Badge */}
                                    <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
                                        {isPaid ? <Crown className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                                        <span className="text-xs font-bold uppercase tracking-wide">
                                            {isPaid ? planName : 'Launch Offer'}
                                        </span>
                                    </div>

                                    {/* Credits Info */}
                                    {isByok ? (
                                        <span className="font-bold flex items-center gap-1 text-sm">
                                            <Sparkles className="w-4 h-4" /> Unlimited API
                                        </span>
                                    ) : (
                                        <>
                                            <span className="font-bold flex items-center gap-1 text-sm">
                                                🎫 {totalCredits} Credits
                                            </span>
                                            <span className="text-white/50">•</span>
                                            <span className="flex items-center gap-1 text-sm text-white/90">
                                                <Gift className="w-4 h-4" /> +{weeklyBonus}/week
                                            </span>
                                        </>
                                    )}

                                    {/* AI Badge */}
                                    {(subscription?.plan_id === 'basic' || subscription?.plan_id === 'pro') && (
                                        <span className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-0.5 text-xs">
                                            <Brain className="w-3 h-3" /> AI learns your taste
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-3">

                        {/* Trial countdown badge - show prominently for trial users */}
                        {isTrial && daysRemaining > 0 && (
                            <div className="hidden sm:flex items-center gap-2 bg-white/25 rounded-full px-3 py-1 text-xs font-medium">
                                <Crown className="w-3 h-3" />
                                <span>Family Pro Trial • <strong>{daysRemaining}</strong> days left</span>
                            </div>
                        )}

                        {/* Upgrade/View Plans Button */}
                        {!isByok && (
                            <a
                                href="/plan"
                                className="bg-white text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-orange-50 transition-colors shadow-lg flex items-center gap-1.5 no-underline"
                            >
                                {isPaid ? (
                                    <><Zap className="w-4 h-4" /> Buy Credits</>
                                ) : (
                                    <><Sparkles className="w-4 h-4" /> Upgrade</>
                                )}
                            </a>
                        )}

                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors"
                            title="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
