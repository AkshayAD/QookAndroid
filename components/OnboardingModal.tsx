import React, { useState, useEffect } from 'react';
import { X, ChefHat, CalendarDays, ShoppingCart, Settings, Sparkles, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

interface OnboardingModalProps {
    onComplete: () => void;
    isMobile?: boolean;
}

interface Step {
    title: string;
    description: string;
    icon: React.ReactNode;
    highlight?: string;
    tip?: string;
}

const STEPS: Step[] = [
    {
        title: "Welcome to QookCommander!",
        description: "Your AI-powered kitchen assistant. Let's take a quick tour to help you get started.",
        icon: <ChefHat className="w-12 h-12" />,
        tip: "This tour takes about 30 seconds"
    },
    {
        title: "Plan Your Meals",
        description: "The 'Weekly Planner' tab is where AI generates personalized 7-day meal plans based on your preferences.",
        icon: <CalendarDays className="w-12 h-12" />,
        highlight: "Click 'Generate Plan' to create your first AI meal plan!",
        tip: "Each plan includes breakfast, lunch, and dinner"
    },
    {
        title: "Schedule & History",
        description: "Use the 'Calendar' tab to save your meal plans to specific dates. View past meals and track what you've eaten.",
        icon: <CalendarDays className="w-12 h-12" />,
        tip: "Drag and drop meals between days"
    },
    {
        title: "Smart Grocery Lists",
        description: "The 'Grocery' tab auto-generates shopping lists from your meal plans. Share directly to WhatsApp!",
        icon: <ShoppingCart className="w-12 h-12" />,
        tip: "Tap items to mark them as purchased"
    },
    {
        title: "Set Your Preferences",
        description: "Click the ⚙️ Settings icon to customize your dietary preferences, allergies, and cuisine style.",
        icon: <Settings className="w-12 h-12" />,
        highlight: "Pro tip: Add specific dishes you love in the Preferences!",
        tip: "Use 'Quick Import' to paste text and let AI extract preferences"
    },
    {
        title: "You're All Set!",
        description: "Start by generating your first meal plan. You have 25 free generations to explore!",
        icon: <Sparkles className="w-12 h-12" />,
        highlight: "🎉 Weekly Bonus: Get 1 free meal generation every week!",
        tip: "Access this guide anytime from the user menu"
    }
];

export default function OnboardingModal({ onComplete, isMobile = false }: OnboardingModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        setIsExiting(true);
        setTimeout(() => {
            onComplete();
        }, 300);
    };

    const handleSkip = () => {
        onComplete();
    };

    const step = STEPS[currentStep];
    const isLastStep = currentStep === STEPS.length - 1;
    const isFirstStep = currentStep === 0;

    // Mobile Bottom Sheet Style
    if (isMobile) {
        return (
            <div className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/50 transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
                <div className={`bg-white w-full max-h-[80vh] rounded-t-3xl shadow-2xl overflow-hidden transform transition-transform duration-300 ${isExiting ? 'translate-y-full' : 'translate-y-0'}`}>
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-10 h-1 bg-gray-300 rounded-full" />
                    </div>

                    {/* Content */}
                    <div className="p-6 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center">
                            {step.icon}
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h2>
                        <p className="text-gray-600 mb-4">{step.description}</p>

                        {step.highlight && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
                                <p className="text-orange-800 text-sm font-medium">{step.highlight}</p>
                            </div>
                        )}

                        {step.tip && (
                            <p className="text-xs text-gray-400 mb-6">💡 {step.tip}</p>
                        )}

                        {/* Progress Dots */}
                        <div className="flex justify-center gap-2 mb-6">
                            {STEPS.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentStep(idx)}
                                    className={`w-2 h-2 rounded-full transition-all ${idx === currentStep ? 'w-6 bg-orange-500' : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Navigation */}
                        <div className="flex gap-3">
                            {!isFirstStep && (
                                <button
                                    onClick={handlePrev}
                                    className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                {isLastStep ? (
                                    <>Get Started <CheckCircle className="w-4 h-4" /></>
                                ) : (
                                    <>Next <ArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </div>

                        {isFirstStep && (
                            <button onClick={handleSkip} className="mt-4 text-sm text-gray-400 hover:text-gray-600">
                                Skip tour
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Desktop Modal Style
    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all duration-300 ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 p-8 text-white text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
                    </div>

                    <div className="relative z-10">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                            {step.icon}
                        </div>
                        <h2 className="text-2xl font-bold">{step.title}</h2>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={handleSkip}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-gray-600 text-center mb-6">{step.description}</p>

                    {step.highlight && (
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4 mb-6">
                            <p className="text-orange-800 text-sm font-medium text-center">{step.highlight}</p>
                        </div>
                    )}

                    {step.tip && (
                        <p className="text-center text-xs text-gray-400 mb-6">💡 {step.tip}</p>
                    )}

                    {/* Progress Dots */}
                    <div className="flex justify-center gap-2 mb-8">
                        {STEPS.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentStep(idx)}
                                className={`h-2 rounded-full transition-all ${idx === currentStep ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300 hover:bg-gray-400'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-4">
                        {!isFirstStep && (
                            <button
                                onClick={handlePrev}
                                className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                        >
                            {isLastStep ? (
                                <>Start Planning <CheckCircle className="w-4 h-4" /></>
                            ) : (
                                <>Next <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
