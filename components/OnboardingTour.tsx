import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Brain, Refrigerator, Shuffle, ShoppingCart, Sparkles, X } from 'lucide-react';

interface TourStep {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    actionLabel?: string;
    triggerAction?: string;
}

const TOUR_STEPS: TourStep[] = [
    {
        id: 'welcome',
        eyebrow: 'Guided walkthrough',
        title: 'Qook now teaches in the planner',
        description: 'You do not need to memorize hidden menus anymore. The main planner surfaces the next best action at the right time.',
    },
    {
        id: 'inventory',
        eyebrow: 'What I Have',
        title: 'Start with your real kitchen',
        description: 'Snap a fridge photo, upload a receipt, or type ingredients so the next generation prioritizes what is already at home.',
        actionLabel: 'Open What I Have',
        triggerAction: 'open-inventory',
    },
    {
        id: 'swap',
        eyebrow: 'Quick Swap',
        title: 'Swap from saved, recent, or AI ideas',
        description: 'Each meal card now exposes swap directly. Replacements help Qook learn what to bring back and what to avoid.',
        actionLabel: 'Show Quick Swaps',
        triggerAction: 'open-quick-swap',
    },
    {
        id: 'teach',
        eyebrow: 'Teach Qook',
        title: 'Teach Qook only appears when there is something to review',
        description: 'Edits, regenerations, swaps, and saved recipes build learning in the background. Qook only surfaces Teach Qook when there is a real pattern worth confirming.',
        actionLabel: 'Open Teach Qook',
        triggerAction: 'open-learning',
    },
    {
        id: 'grocery',
        eyebrow: 'Grocery flow',
        title: 'Groceries now keeps list and calendar together',
        description: 'Use Grocery List for shopping, and the Grocery Calendar subtab for schedule-driven generation. Pantry staples and active inventory stay in the loop so the list stays cleaner.',
        actionLabel: 'Go to Grocery',
        triggerAction: 'switch-to-grocery',
    },
];

interface OnboardingTourProps {
    onComplete: () => void;
    forceShow?: boolean;
    onTriggerAction?: (action: string) => void;
    currentAction?: string;
}

export default function OnboardingTour({
    onComplete,
    forceShow = false,
    onTriggerAction,
    currentAction,
}: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const step = TOUR_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    const icon = useMemo(() => {
        switch (step.id) {
            case 'inventory':
                return Refrigerator;
            case 'swap':
                return Shuffle;
            case 'teach':
                return Brain;
            case 'grocery':
                return ShoppingCart;
            default:
                return Sparkles;
        }
    }, [step.id]);

    useEffect(() => {
        if (currentAction && step.triggerAction === currentAction) {
            setCurrentStep((value) => Math.min(value + 1, TOUR_STEPS.length - 1));
        }
    }, [currentAction, step.triggerAction]);

    const finishTour = () => {
        if (!forceShow) {
            localStorage.setItem('qook_tour_completed', 'true');
        }
        onComplete();
    };

    const handleSkip = () => {
        if (onTriggerAction) {
            onTriggerAction('switch-to-plan');
        }
        finishTour();
    };

    const handleNext = () => {
        if (isLastStep) {
            finishTour();
            return;
        }
        setCurrentStep((value) => value + 1);
    };

    const Icon = icon;

    return (
        <div className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-[28px] bg-white shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 px-6 py-5 text-white">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-white/75 font-semibold">{step.eyebrow}</p>
                            <h2 className="text-2xl font-bold mt-2">{step.title}</h2>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="p-2 rounded-full hover:bg-white/15 transition-colors"
                            title="Skip tour"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-6">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                            <Icon className="w-7 h-7" />
                        </div>
                        <div className="space-y-4">
                            <p className="text-gray-600 leading-7">{step.description}</p>
                            {step.triggerAction && onTriggerAction && (
                                <button
                                    onClick={() => onTriggerAction(step.triggerAction!)}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors"
                                >
                                    {step.actionLabel || 'Show me'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-8">
                        <div className="flex gap-2">
                            {TOUR_STEPS.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`h-2 rounded-full transition-all ${index === currentStep ? 'w-8 bg-orange-500' : 'w-2 bg-gray-200'}`}
                                />
                            ))}
                        </div>
                        <span className="text-sm text-gray-400">{currentStep + 1} / {TOUR_STEPS.length}</span>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between gap-3">
                    <button
                        onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
                        disabled={isFirstStep}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSkip}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleNext}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
                        >
                            {isLastStep ? 'Done' : 'Next'}
                            {!isLastStep && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function shouldShowTour(): boolean {
    return localStorage.getItem('qook_tour_completed') !== 'true';
}

export function resetTour(): void {
    localStorage.removeItem('qook_tour_completed');
}
