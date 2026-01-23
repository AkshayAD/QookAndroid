import React, { useState, useEffect } from 'react';
import { X, Check, Info, Loader2, Rocket, Gift, Zap, Crown, Key, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { initializeRazorpayPayment } from '../services/razorpayService';
import { useNavigate } from 'react-router-dom';
import { SubscriptionPlan, CreditPack } from '../types/subscription';
import { getCreditPacks, upgradeSubscription } from '../services/subscriptionService';

interface PricingPageProps {
    onClose: () => void;
    onUpgradeSuccess?: () => void;
}

export default function PricingPage({ onClose, onUpgradeSuccess }: PricingPageProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { subscription, credits, plans, loading: subscriptionLoading, refreshCredits } = useSubscription();
    const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'plans' | 'credits'>('plans');

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        getCreditPacks().then(setCreditPacks);
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleSubscribe = async (planId: string) => {
        if (!user) {
            navigate('/auth'); // Or show login modal
            return;
        }

        const plan = plans.find(p => p.id === planId);
        if (!plan?.razorpay_plan_id) {
            console.error('Plan not configured for Razorpay');
            return;
        }

        // Initialize Razorpay Subscription Checkout
        await initializeRazorpayPayment(user.id, {
            type: 'subscription',
            item: {
                planId: plan.razorpay_plan_id,
                internalPlanId: plan.id
            },
            onSuccess: () => {
                alert('Subscription successful! Refreshing...');
                refreshCredits();
                onClose();
            },
            onError: (err) => {
                console.error('Payment failed', err);
                alert('Payment failed. Please try again.');
            }
        });
    };

    const handleBuyCredits = async (pack: CreditPack) => {
        if (!user) {
            navigate('/auth');
            return;
        }

        // Initialize Razorpay Order Checkout
        await initializeRazorpayPayment(user.id, {
            type: 'pack',
            item: {
                amount: pack.price_inr,
                packId: pack.id
            },
            onSuccess: () => {
                alert('Credits added successfully!');
                refreshCredits();
                onClose();
            },
            onError: (err) => {
                console.error('Payment failed', err);
                alert('Payment failed. Please try again.');
            }
        });
    };

    const getPlanIcon = (planId: string) => {
        switch (planId) {
            case 'free': return <Gift className="w-6 h-6" />;
            case 'basic': return <Zap className="w-6 h-6" />;
            case 'pro': return <Crown className="w-6 h-6" />;
            case 'byok': return <Key className="w-6 h-6" />;
            default: return <Sparkles className="w-6 h-6" />;
        }
    };

    const getPlanColor = (planId: string) => {
        switch (planId) {
            case 'free': return 'from-gray-500 to-gray-600';
            case 'basic': return 'from-blue-500 to-indigo-600';
            case 'pro': return 'from-orange-500 to-red-600';
            case 'byok': return 'from-violet-500 to-purple-600';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    const isCurrentPlan = (planId: string) => subscription?.plan_id === planId;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">Choose Your Plan</h2>
                            <p className="text-white/80 text-sm mt-1">Unlock AI-powered meal planning</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                                <Rocket className="w-3.5 h-3.5" />
                                50% OFF Launch Offer!
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Current Credits Display */}
                    {credits && (
                        <div className="mt-4 flex flex-wrap gap-3">
                            <div className="bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                <span className="text-sm font-medium">{credits.total_meal_credits} Meal Plans</span>
                            </div>
                            <div className="bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                <span className="text-sm font-medium">{credits.total_grocery_credits} Grocery Lists</span>
                            </div>
                            {/* Removed Regens count - regeneration is unlimited */}
                        </div>
                    )}
                </div>

                {/* Tab Switcher */}
                <div className="border-b border-gray-200 px-6">
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('plans')}
                            className={`py-3 border-b-2 text-sm font-medium transition-colors ${activeTab === 'plans'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Subscription Plans
                        </button>
                        <button
                            onClick={() => setActiveTab('credits')}
                            className={`py-3 border-b-2 text-sm font-medium transition-colors ${activeTab === 'credits'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Buy Credits
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'plans' ? (
                        <div className="grid md:grid-cols-4 gap-4">
                            {plans.filter(p => p.id !== 'free').map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-2xl border-2 p-5 flex flex-col transition-all hover:shadow-lg ${isCurrentPlan(plan.id)
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {isCurrentPlan(plan.id) && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                            Current Plan
                                        </div>
                                    )}

                                    {/* Plan Header */}
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanColor(plan.id)} text-white flex items-center justify-center mb-4`}>
                                        {getPlanIcon(plan.id)}
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                    <div className="mt-2">
                                        <span className="text-gray-400 text-lg line-through mr-2">₹{plan.price_inr * 2}</span>
                                        <span className="text-3xl font-extrabold text-gray-900">₹{plan.price_inr}</span>
                                        <span className="text-gray-500 text-sm">/month</span>
                                        <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">50% OFF</span>
                                    </div>

                                    {/* Features */}
                                    <ul className="mt-4 space-y-2 flex-1">
                                        <FeatureItem checked>{plan.meal_generations} Meal Plans/mo</FeatureItem>
                                        <FeatureItem checked>{plan.grocery_generations} Grocery Lists</FeatureItem>
                                        <FeatureItem checked>{plan.smart_edits} Smart Edits</FeatureItem>
                                        <FeatureItem checked={plan.byok_enabled}>BYOK Unlimited</FeatureItem>
                                        <FeatureItem checked={plan.weekly_bonus_meals > 0}>
                                            Weekly Bonus ({plan.weekly_bonus_meals}+{plan.weekly_bonus_grocery})
                                        </FeatureItem>
                                        <FeatureItem checked={plan.can_buy_credits}>Buy Extra Credits</FeatureItem>
                                        <FeatureItem checked={plan.priority_support}>Priority Support</FeatureItem>
                                    </ul>

                                    {/* CTA Button */}
                                    <button
                                        onClick={() => handleSubscribe(plan.id)}
                                        disabled={loading || isCurrentPlan(plan.id)}
                                        className={`mt-4 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isCurrentPlan(plan.id)
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : `bg-gradient-to-r ${getPlanColor(plan.id)} text-white hover:shadow-lg hover:-translate-y-0.5`
                                            }`}
                                    >
                                        {loading && selectedPlan === plan.id ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : isCurrentPlan(plan.id) ? (
                                            'Current Plan'
                                        ) : (
                                            <>Subscribe <ArrowRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-amber-800 text-sm">
                                    <strong>Paid Credits never expire!</strong> 1 credit = 1 week meal plan generation.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-4 gap-4">
                                {creditPacks.map((pack) => (
                                    <div
                                        key={pack.id}
                                        className="rounded-2xl border-2 border-gray-200 p-5 flex flex-col hover:border-indigo-300 hover:shadow-lg transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-bold text-gray-900">{pack.name}</h3>
                                            {pack.discount_pct > 0 && (
                                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                                    -{pack.discount_pct}%
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-4xl font-extrabold text-indigo-600 mb-1">
                                            {pack.credits}
                                        </div>
                                        <p className="text-gray-500 text-sm mb-4">credits</p>

                                        <div className="mt-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-lg line-through">₹{pack.price_inr * 2}</span>
                                                <span className="text-2xl font-bold text-gray-900">₹{pack.price_inr}</span>
                                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">50% OFF</span>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                ₹{(pack.price_inr / pack.credits).toFixed(2)} per credit
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => handleBuyCredits(pack)}
                                            className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
                                        >
                                            Buy Now
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 text-center text-xs text-gray-500">
                    <p>Secure payments via Razorpay. Cancel anytime. Questions? <a href="mailto:akshaydewalwar1@gmail.com" className="text-indigo-600 hover:underline">Contact us</a></p>
                </div>
            </div>
        </div>
    );
}

function FeatureItem({ children, checked }: { children: React.ReactNode; checked: boolean }) {
    return (
        <li className="flex items-center gap-2 text-sm">
            {checked ? (
                <Check className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
                <X className="w-4 h-4 text-gray-300 shrink-0" />
            )}
            <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{children}</span>
        </li>
    );
}
