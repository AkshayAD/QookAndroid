import React, { useState, useCallback } from 'react';
import { ChefHat, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { OnboardingData } from '../types';

// Step Components
import WelcomeStep from './onboarding/WelcomeStep';
import NameLocationStep from './onboarding/NameLocationStep';
import HouseholdStep from './onboarding/HouseholdStep';
import DietTypeStep from './onboarding/DietTypeStep';
import NonVegStep from './onboarding/NonVegStep';
import MealsStep from './onboarding/MealsStep';
import DislikesStep from './onboarding/DislikesStep';
import SpecialInstructionsStep from './onboarding/SpecialInstructionsStep';

interface OnboardingWizardProps {
    onComplete: (data: OnboardingData) => Promise<void>;
    initialData?: Partial<OnboardingData>; // For pre-filling when re-running wizard
    onSkip?: () => void; // Optional: for cancelling wizard without saving
    isRerun?: boolean; // True if this is a re-run (not first time)
}

const INITIAL_DATA: OnboardingData = {
    userName: '',
    country: 'India',
    language: 'English',
    householdSize: 4,
    portionSize: 'regular',
    dietaryTypes: ['Vegetarian'],
    nonVegPreferences: [],
    nonVegFrequency: '',
    mealsToPrepare: ['breakfast', 'lunch', 'dinner'],
    hasTiffin: false,
    tiffinDays: [],
    tiffinFor: [],
    mealComplexity: 'balanced',
    cuisineStyle: 'pan-indian',
    dislikes: [],
    allergies: [],
    healthGoals: [],
    specialInstructions: '',
    referralCode: ''
};

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, initialData, onSkip, isRerun }) => {
    const [currentStep, setCurrentStep] = useState(0);
    // Merge initialData with defaults - use initialData values if provided
    const [data, setData] = useState<OnboardingData>(() => ({
        ...INITIAL_DATA,
        ...initialData
    }));
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine if we should show the NonVeg step - only for actual Non-Vegetarian diet
    const showNonVegStep = data.dietaryTypes.includes('Non-Vegetarian');

    // Define steps dynamically based on selections
    const getSteps = useCallback(() => {
        const steps = [
            { id: 'welcome', component: WelcomeStep, title: 'Welcome' },
            { id: 'name-location', component: NameLocationStep, title: 'About You' },
            { id: 'household', component: HouseholdStep, title: 'Household' },
            { id: 'diet-type', component: DietTypeStep, title: 'Diet' },
        ];

        if (showNonVegStep) {
            steps.push({ id: 'non-veg', component: NonVegStep, title: 'Non-Veg' });
        }

        steps.push(
            { id: 'meals', component: MealsStep, title: 'Meals' },
            { id: 'dislikes', component: DislikesStep, title: 'Dislikes' },
            { id: 'special', component: SpecialInstructionsStep, title: 'More' }
        );

        return steps;
    }, [showNonVegStep]);

    const steps = getSteps();
    const totalSteps = steps.length;
    const isLastStep = currentStep === totalSteps - 1;
    const isFirstStep = currentStep === 0;

    const updateData = useCallback((updates: Partial<OnboardingData>) => {
        setData(prev => ({ ...prev, ...updates }));
    }, []);

    const handleNext = () => {
        if (isLastStep) {
            handleComplete();
        } else {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const handleComplete = async () => {
        setIsSubmitting(true);
        try {
            await onComplete(data);
        } catch (error) {
            console.error('Onboarding error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const CurrentStepComponent = steps[currentStep]?.component;

    // Progress percentage (excluding welcome)
    const progressPercent = currentStep === 0 ? 0 : Math.round((currentStep / (totalSteps - 1)) * 100);

    return (
        <div className="min-h-dvh bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col">
            {/* Header with Progress */}
            {currentStep > 0 && (
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
                    <div className="max-w-lg mx-auto">
                        {/* Skip button for re-runs */}
                        {onSkip && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => {
                                        if (confirm('Discard changes and cancel setup?')) {
                                            onSkip();
                                        }
                                    }}
                                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    ✕ Cancel Setup
                                </button>
                            </div>
                        )}
                        {/* Step indicator */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span>Step {currentStep} of {totalSteps - 1}</span>
                            <span>{progressPercent}% complete</span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
                <div className="w-full max-w-lg">
                    {/* Step Content with animation */}
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {CurrentStepComponent && (
                            <CurrentStepComponent
                                data={data}
                                updateData={updateData}
                                onNext={handleNext}
                                isRerun={isRerun}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Navigation (not on welcome) */}
            {currentStep > 0 && (
                <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-gray-100 px-4 py-4 safe-area-inset-bottom">
                    <div className="max-w-lg mx-auto flex gap-3">
                        {/* Back Button */}
                        {!isFirstStep && (
                            <button
                                onClick={handleBack}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back
                            </button>
                        )}

                        {/* Next/Complete Button */}
                        <button
                            onClick={handleNext}
                            disabled={isSubmitting}
                            className={`flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg ${isLastStep
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-xl hover:scale-[1.02]'
                                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-xl hover:scale-[1.02]'
                                } disabled:opacity-70 disabled:cursor-not-allowed`}
                        >
                            {isSubmitting ? (
                                <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving your setup...
                                </>
                            ) : isLastStep ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    Continue to My Kitchen
                                </>
                            ) : (
                                <>
                                    Next
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingWizard;
