import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ChefHat, ArrowRight, Sparkles, RefreshCw, CheckCircle, Loader2, ShoppingCart, Calendar } from 'lucide-react';
import { generatePlanViaProxy, regenerateMealViaProxy } from '../services/aiProxyService';
import { supabase } from '../lib/supabase';

interface OnboardingProps {
    forceShow?: boolean;
}

interface DayPlan {
    day: string;
    breakfast: string;
    lunch: string;
    dinner: string;
}

const DIETARY_OPTIONS = [
    'Vegetarian',
    'Vegan',
    'Eggetarian',
    'Non-Vegetarian',
    'Jain',
    'No Preference'
];

export default function Onboarding({ forceShow = false }: OnboardingProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshCredits } = useSubscription();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [regenLoading, setRegenLoading] = useState<string | null>(null);

    // Step 1: Preferences
    const [dietaryType, setDietaryType] = useState('Vegetarian');
    const [dislikes, setDislikes] = useState('');
    const [favorites, setFavorites] = useState('');
    const [aiInput, setAiInput] = useState('');
    const [useAiImport, setUseAiImport] = useState(true);

    // Step 2: Generated Plan
    const [weeklyPlan, setWeeklyPlan] = useState<DayPlan[]>([]);

    // Check if already completed onboarding
    useEffect(() => {
        if (!forceShow) {
            const completed = localStorage.getItem('qook_onboarding_completed');
            if (completed === 'true') {
                navigate('/dashboard');
            }
        }
    }, [forceShow, navigate]);

    const handleGeneratePlan = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Build preferences from input
            const preferences = useAiImport ? {
                dietaryType: 'Vegetarian',
                dislikes: [],
                favorites: [],
                aiDescription: aiInput
            } : {
                dietaryType,
                dislikes: dislikes.split(',').map(s => s.trim()).filter(Boolean),
                favorites: favorites.split(',').map(s => s.trim()).filter(Boolean),
            };

            // Save preference profile
            const { data: profile } = await supabase
                .from('preference_profiles')
                .insert({
                    user_id: user.id,
                    name: 'My Preferences',
                    dietary_type: preferences.dietaryType,
                    dislikes: preferences.dislikes,
                    is_default: true
                })
                .select()
                .single();

            // Generate meal plan
            const result = await generatePlanViaProxy(user.id, preferences, undefined);

            if (result && result.days) {
                setWeeklyPlan(result.days);
                setStep(3);
            }

            await refreshCredits();
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerateMeal = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
        if (!user) return;
        const key = `${dayIndex}-${mealType}`;
        setRegenLoading(key);

        try {
            const currentMeal = weeklyPlan[dayIndex][mealType];
            const dayName = weeklyPlan[dayIndex].day;

            const existingMeals = weeklyPlan.flatMap(d => [d.breakfast, d.lunch, d.dinner]).filter(Boolean);

            const newMeal = await regenerateMealViaProxy(
                user.id,
                currentMeal,
                mealType,
                { dietaryType, dislikes: dislikes.split(',').map(s => s.trim()) },
                dayName,
                existingMeals
            );

            setWeeklyPlan(prev => prev.map((day, i) =>
                i === dayIndex ? { ...day, [mealType]: newMeal } : day
            ));

            await refreshCredits();
        } catch (error) {
            console.error('Regen error:', error);
        } finally {
            setRegenLoading(null);
        }
    };

    const handleComplete = () => {
        if (!forceShow) {
            localStorage.setItem('qook_onboarding_completed', 'true');
        }
        navigate('/dashboard');
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ChefHat className="w-6 h-6 text-orange-500" />
                        <span className="font-bold text-lg">Qook</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map(s => (
                            <div
                                key={s}
                                className={`w-2 h-2 rounded-full transition-all ${s === step ? 'w-6 bg-orange-500' :
                                    s < step ? 'bg-orange-300' : 'bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">

                {/* Step 1: Preferences */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                                Welcome to Qook! 👋
                            </h1>
                            <p className="text-gray-600">
                                Let's personalize your meal plans. This takes 1 minute.
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
                            {/* Toggle AI Import vs Manual */}
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => setUseAiImport(true)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${useAiImport ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                                        }`}
                                >
                                    <Sparkles className="w-4 h-4 inline mr-2" />
                                    AI Quick Import
                                </button>
                                <button
                                    onClick={() => setUseAiImport(false)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${!useAiImport ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                                        }`}
                                >
                                    Manual Setup
                                </button>
                            </div>

                            {useAiImport ? (
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Describe your food preferences
                                    </label>
                                    <textarea
                                        value={aiInput}
                                        onChange={(e) => setAiInput(e.target.value)}
                                        placeholder="Example: I'm vegetarian, love South Indian breakfast like idli dosa. I don't like bitter gourd and brinjal. Prefer light dinners. My family has 4 members."
                                        className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                                    />
                                    <p className="text-xs text-gray-500">
                                        ✨ Our AI will understand your preferences and create personalized meal plans
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Dietary Preference
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {DIETARY_OPTIONS.map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => setDietaryType(opt)}
                                                    className={`py-2 px-3 rounded-lg text-sm border transition-all ${dietaryType === opt
                                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Foods you dislike (comma separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={dislikes}
                                            onChange={(e) => setDislikes(e.target.value)}
                                            placeholder="bitter gourd, brinjal, capsicum"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Favorite dishes (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={favorites}
                                            onChange={(e) => setFavorites(e.target.value)}
                                            placeholder="idli, dosa, paneer butter masala"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={useAiImport ? !aiInput.trim() : !dietaryType}
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Continue <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Step 2: Generate Plan */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                                Generate Your First Plan ✨
                            </h1>
                            <p className="text-gray-600">
                                AI will create a personalized 7-day meal plan just for you
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <div className="text-center py-8">
                                {!loading ? (
                                    <>
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center">
                                            <Sparkles className="w-10 h-10" />
                                        </div>
                                        <h3 className="font-semibold text-lg mb-2">Ready to Generate</h3>
                                        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                                            Based on your preferences, we'll create breakfast, lunch, and dinner for 7 days
                                        </p>
                                        <button
                                            onClick={handleGeneratePlan}
                                            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                                        >
                                            <Sparkles className="w-5 h-5" />
                                            Generate My Plan
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                                        <h3 className="font-semibold text-lg mb-2">Creating Your Plan...</h3>
                                        <p className="text-gray-500 text-sm">
                                            AI is crafting personalized meals just for you
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setStep(1)}
                            className="text-gray-500 text-sm hover:text-gray-700"
                        >
                            ← Back to preferences
                        </button>
                    </div>
                )}

                {/* Step 3: View Plan & Try Regenerate */}
                {step === 3 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                                Your Plan is Ready! 🎉
                            </h1>
                            <p className="text-gray-600">
                                Try clicking the refresh icon on any meal to regenerate it
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {weeklyPlan.slice(0, 3).map((day, dayIndex) => (
                                <div key={day.day} className="bg-white rounded-xl shadow-sm border p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">{day.day}</h3>
                                    {(['breakfast', 'lunch', 'dinner'] as const).map(mealType => (
                                        <div key={mealType} className="flex items-start justify-between py-2 border-t border-gray-100">
                                            <div className="flex-1">
                                                <span className="text-xs text-gray-500 uppercase">{mealType}</span>
                                                <p className="text-sm text-gray-900 line-clamp-2">
                                                    {day[mealType]}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRegenerateMeal(dayIndex, mealType)}
                                                disabled={regenLoading === `${dayIndex}-${mealType}`}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                                            >
                                                <RefreshCw className={`w-4 h-4 text-gray-400 ${regenLoading === `${dayIndex}-${mealType}` ? 'animate-spin' : ''
                                                    }`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <p className="text-orange-800 text-sm text-center">
                                💡 <strong>Tip:</strong> Click the refresh icon to regenerate any meal you don't like!
                            </p>
                        </div>

                        <button
                            onClick={() => setStep(4)}
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
                        >
                            Continue <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Step 4: Complete */}
                {step === 4 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                                You're All Set! 🎉
                            </h1>
                            <p className="text-gray-600">
                                Your personalized meal planning is ready to go
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl shadow-sm border p-4 flex items-start gap-4">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Schedule Meals</h3>
                                    <p className="text-sm text-gray-500">Add meals to your calendar and track history</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-4 flex items-start gap-4">
                                <div className="p-3 bg-green-100 rounded-lg">
                                    <ShoppingCart className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Grocery List</h3>
                                    <p className="text-sm text-gray-500">Auto-generate shopping lists from your plans</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleComplete}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Start Using Qook
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to check if onboarding is needed
export function shouldShowOnboardingWizard(): boolean {
    return localStorage.getItem('qook_onboarding_completed') !== 'true';
}

// Helper to reset onboarding
export function resetOnboardingWizard(): void {
    localStorage.removeItem('qook_onboarding_completed');
}
