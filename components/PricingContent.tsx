import React, { useState, useEffect } from 'react';
import { Check, X, Zap, Crown, Key, Gift, Sparkles, RefreshCw, ArrowRight, Star, Rocket, Users } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { initializeRazorpayPayment } from '../services/razorpayService';
import { SubscriptionPlan, CreditPack } from '../types/subscription';
import { getCreditPacks } from '../services/subscriptionService';

export default function PricingContent() {
    const { user } = useAuth();
    const { subscription, credits, plans, refreshCredits } = useSubscription();
    const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [selectedPack, setSelectedPack] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'plans' | 'credits'>('plans');

    useEffect(() => {
        getCreditPacks().then(setCreditPacks);
    }, []);

    const handleSubscribe = async (planId: string) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuth'));
            return;
        }

        const plan = plans.find(p => p.id === planId);
        if (!plan?.razorpay_plan_id) {
            console.error('Plan not configured for Razorpay');
            alert('This plan is not yet available for purchase.');
            return;
        }

        setLoading(true);
        setSelectedPlan(planId);

        await initializeRazorpayPayment(user.id, {
            type: 'subscription',
            item: {
                planId: plan.razorpay_plan_id,
                internalPlanId: plan.id
            },
            onSuccess: () => {
                alert('Subscription successful!');
                refreshCredits();
                setLoading(false);
                setSelectedPlan(null);
            },
            onError: (err) => {
                console.error('Payment failed', err);
                alert('Payment failed. Please try again.');
                setLoading(false);
                setSelectedPlan(null);
            }
        });
    };

    const handleBuyCredits = async (pack: CreditPack) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuth'));
            return;
        }

        setLoading(true);
        setSelectedPack(pack.id);

        await initializeRazorpayPayment(user.id, {
            type: 'pack',
            item: {
                amount: pack.price_inr,
                packId: pack.id
            },
            onSuccess: () => {
                alert('Credits added successfully!');
                refreshCredits();
                setLoading(false);
                setSelectedPack(null);
            },
            onError: (err) => {
                console.error('Payment failed', err);
                alert('Payment failed. Please try again.');
                setLoading(false);
                setSelectedPack(null);
            }
        });
    };

    const getPlanIcon = (planId: string) => {
        switch (planId) {
            case 'free': return <Rocket className="w-6 h-6" />;
            case 'basic': return <Zap className="w-6 h-6" />;
            case 'pro': return <Crown className="w-6 h-6" />;
            case 'family_pro': return <Users className="w-6 h-6" />;
            case 'byok': return <Key className="w-6 h-6" />;
            default: return <Sparkles className="w-6 h-6" />;
        }
    };

    const getPlanColor = (planId: string) => {
        switch (planId) {
            case 'free': return 'from-green-500 to-emerald-600';
            case 'basic': return 'from-blue-500 to-indigo-600';
            case 'pro': return 'from-orange-500 to-red-600';
            case 'family_pro': return 'from-pink-500 to-rose-600';
            case 'byok': return 'from-violet-500 to-purple-600';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    // Simplified features for each plan (using unified credits)
    const getSimplifiedFeatures = (plan: SubscriptionPlan) => {
        if (plan.id === 'free') {
            return [
                { text: '8 credits for your first month', checked: true },
                { text: '+1 weekly bonus credit', checked: true },
                { text: '2 household profiles', checked: true },
                { text: '30 days history', checked: true },
                { text: 'No credit card required', checked: true },
            ];
        }
        if (plan.id === 'byok') {
            return [
                { text: 'Requires Gemini API key', checked: true },
                { text: 'Unlimited generations', checked: true },
                { text: '2 household profiles', checked: true },
                { text: '365 days history', checked: true },
                { text: '+1 weekly bonus credit', checked: true },
            ];
        }
        if (plan.id === 'basic') {
            return [
                { text: '8 credits/month', checked: true },
                { text: '+1 weekly bonus credit', checked: true },
                { text: '5 household profiles', checked: true },
                { text: '90 days history', checked: true },
                { text: 'AI learns your preferences', checked: true },
                { text: 'Buy extra credits', checked: true },
            ];
        }
        if (plan.id === 'pro') {
            return [
                { text: '20 credits/month', checked: true },
                { text: '+2 weekly bonus credits', checked: true },
                { text: 'Unlimited profiles', checked: true },
                { text: '365 days history', checked: true },
                { text: 'Priority support', checked: true },
                { text: 'Buy extra credits', checked: true },
            ];
        }
        if (plan.id === 'family_pro') {
            return [
                { text: '40 pooled credits/month', checked: true },
                { text: '+4 weekly bonus credits', checked: true },
                { text: 'Up to 5 family members', checked: true },
                { text: 'Shared grocery lists', checked: true },
                { text: 'Family activity log', checked: true },
                { text: 'Priority support', checked: true },
            ];
        }
        return [];
    };

    const isCurrentPlan = (planId: string) => subscription?.plan_id === planId;
    const isRecommended = (planId: string) => planId === 'basic'; // Basic is recommended for launch offer
    const isLaunchOffer = (planId: string) => planId === 'free';
    const isFamilyPlan = (planId: string) => planId === 'family_pro';

    // Filter plans to show in desired order
    const orderedPlans = [...plans].sort((a, b) => {
        const order = ['free', 'byok', 'basic', 'pro', 'family_pro'];
        return order.indexOf(a.id) - order.indexOf(b.id);
    });

    return (
        <section className="py-12 md:py-20 bg-gradient-to-br from-orange-50 via-white to-indigo-50 min-h-[calc(100vh-4rem)]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-10 md:mb-14">
                    {/* Launch Offer Badge */}
                    <div className="flex justify-center mb-4">
                        <div className="bg-yellow-400 text-yellow-900 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse shadow-md">
                            <Rocket className="w-4 h-4" />
                            🎉 50% OFF Launch Offer!
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto">
                        Unlock AI-powered meal planning. Start free, upgrade when you're ready.
                    </p>
                </div>

                {/* Current Credits Display (if logged in) - Simplified */}
                {user && credits && (
                    <div className="flex justify-center mb-8">
                        <div className="bg-white rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm border border-gray-200">
                            <Sparkles className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-gray-700">
                                {credits.total_meal_credits} credits available
                            </span>
                        </div>
                    </div>
                )}

                {/* Tab Switcher */}
                <div className="flex justify-center mb-8 md:mb-10">
                    <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-gray-200">
                        <button
                            onClick={() => setActiveTab('plans')}
                            className={`px-4 md:px-6 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'plans'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Subscription Plans
                        </button>
                        <button
                            onClick={() => setActiveTab('credits')}
                            className={`px-4 md:px-6 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'credits'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Buy Credits
                        </button>
                    </div>
                </div>

                {/* Subscription Plans Tab */}
                {activeTab === 'plans' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {orderedPlans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`relative bg-white rounded-2xl border-2 p-5 md:p-6 flex flex-col transition-all hover:shadow-xl ${isCurrentPlan(plan.id)
                                    ? 'border-orange-500 shadow-lg ring-2 ring-orange-200'
                                    : isLaunchOffer(plan.id)
                                        ? 'border-green-400 shadow-lg'
                                        : isRecommended(plan.id)
                                            ? 'border-blue-400 shadow-lg'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                {/* Badges */}
                                {isCurrentPlan(plan.id) && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                                        Current Plan
                                    </div>
                                )}
                                {isLaunchOffer(plan.id) && !isCurrentPlan(plan.id) && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                        <Rocket className="w-3 h-3" /> Launch Offer
                                    </div>
                                )}
                                {isRecommended(plan.id) && !isCurrentPlan(plan.id) && !isLaunchOffer(plan.id) && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                        <Star className="w-3 h-3" /> Popular
                                    </div>
                                )}
                                {isFamilyPlan(plan.id) && !isCurrentPlan(plan.id) && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                        <Users className="w-3 h-3" /> Family
                                    </div>
                                )}

                                {/* Plan Icon */}
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanColor(plan.id)} text-white flex items-center justify-center mb-4`}>
                                    {getPlanIcon(plan.id)}
                                </div>

                                {/* Plan Name & Price */}
                                <h3 className="text-lg md:text-xl font-bold text-gray-900">
                                    {plan.id === 'free' ? 'First Month FREE' : plan.name}
                                </h3>
                                <div className="mt-2 mb-4">
                                    {plan.id === 'free' ? (
                                        <>
                                            <span className="text-2xl md:text-3xl font-extrabold text-green-600">₹0</span>
                                            <span className="text-gray-400 text-sm line-through ml-2">₹{plan.regular_price || 99}</span>
                                            <div className="text-xs text-gray-500 mt-1">First month free</div>
                                        </>
                                    ) : plan.price_inr > 0 ? (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-gray-400 text-lg line-through">₹{plan.regular_price || plan.price_inr * 2}</span>
                                                <span className="text-2xl md:text-3xl font-extrabold text-gray-900">₹{plan.first_month_price || plan.price_inr}</span>
                                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">50% OFF</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                First month • then ₹{plan.regular_price || plan.price_inr * 2}/mo
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-2xl md:text-3xl font-extrabold text-gray-900">₹{plan.price_inr}</span>
                                            <span className="text-gray-500 text-sm">/month</span>
                                        </>
                                    )}
                                </div>

                                {/* Simplified Features List */}
                                <ul className="space-y-2 flex-1 mb-5 text-sm">
                                    {getSimplifiedFeatures(plan).map((feature, idx) => (
                                        <FeatureItem key={idx} checked={feature.checked}>
                                            {feature.text}
                                        </FeatureItem>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                <button
                                    onClick={() => plan.id === 'free'
                                        ? window.dispatchEvent(new CustomEvent('openAuth'))
                                        : handleSubscribe(plan.id)
                                    }
                                    disabled={loading}
                                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isCurrentPlan(plan.id)
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : plan.id === 'free'
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:-translate-y-0.5'
                                            : `bg-gradient-to-r ${getPlanColor(plan.id)} text-white hover:shadow-lg hover:-translate-y-0.5`
                                        }`}
                                >
                                    {loading && selectedPlan === plan.id ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : isCurrentPlan(plan.id) ? (
                                        'Current Plan'
                                    ) : plan.id === 'free' ? (
                                        <>Start Free <ArrowRight className="w-4 h-4" /></>
                                    ) : (
                                        <>Subscribe <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Credit Packs Tab */
                    <div>
                        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-2xl mx-auto text-center">
                            <p className="text-amber-800 text-sm">
                                <strong>Paid Credits never expire!</strong> 1 credit = 1 week of AI meal planning.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            {creditPacks.map((pack) => (
                                <div
                                    key={pack.id}
                                    className={`relative bg-white rounded-2xl border-2 p-5 md:p-6 flex flex-col transition-all hover:shadow-xl ${pack.id === 'value'
                                        ? 'border-indigo-400 shadow-lg'
                                        : 'border-gray-200 hover:border-indigo-300'
                                        }`}
                                >
                                    {/* Most Popular Badge */}
                                    {pack.id === 'value' && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                            <Star className="w-3 h-3" /> Most Popular
                                        </div>
                                    )}

                                    {/* Pack Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-gray-900 text-lg">{pack.name}</h3>
                                        {pack.discount_pct > 0 && (
                                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                                -{pack.discount_pct}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Credits Count */}
                                    <div className="text-4xl md:text-5xl font-extrabold text-indigo-600 mb-1">
                                        {pack.credits}
                                    </div>
                                    <p className="text-gray-500 text-sm mb-4">credits</p>

                                    {/* Price */}
                                    <div className="mt-auto mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-lg line-through">₹{pack.price_inr * 2}</span>
                                            <span className="text-2xl font-bold text-gray-900">₹{pack.price_inr}</span>
                                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">50% OFF</span>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            ₹{(pack.price_inr / pack.credits).toFixed(1)} per credit
                                        </p>
                                    </div>

                                    {/* Buy Button */}
                                    <button
                                        onClick={() => handleBuyCredits(pack)}
                                        disabled={loading}
                                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${pack.id === 'value'
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            }`}
                                    >
                                        {loading && selectedPack === pack.id ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Buy Now'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Note */}
                <div className="mt-10 md:mt-12 text-center text-sm text-gray-500">
                    <p>Secure payments via Razorpay. Cancel anytime. <a href="mailto:akshaydewalwar1@gmail.com" className="text-indigo-600 hover:underline">Contact us</a></p>
                </div>
            </div>
        </section>
    );
}

function FeatureItem({ children, checked }: { children: React.ReactNode; checked: boolean }) {
    return (
        <li className="flex items-center gap-2">
            {checked ? (
                <Check className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
                <X className="w-4 h-4 text-gray-300 shrink-0" />
            )}
            <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{children}</span>
        </li>
    );
}
