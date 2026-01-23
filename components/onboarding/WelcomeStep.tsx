import React from 'react';
import { ChefHat, Sparkles, ArrowRight } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const WelcomeStep: React.FC<StepProps> = ({ onNext }) => {
    return (
        <div className="text-center py-12 px-4">
            {/* Animated Chef Icon */}
            <div className="mb-8 relative inline-block">
                <div className="w-28 h-28 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-200 animate-bounce">
                    <ChefHat className="w-14 h-14 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
            </div>

            {/* Welcome Text */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Hi there! 👋
            </h1>
            <p className="text-xl text-gray-600 mb-2">
                I'm your personal
                <span className="text-orange-600 font-semibold"> meal planning assistant</span>
            </p>
            <p className="text-gray-500 mb-10 max-w-sm mx-auto">
                Let's set up your kitchen preferences in just 2 minutes, and I'll create your first personalized meal plan!
            </p>

            {/* CTA Button */}
            <button
                onClick={onNext}
                className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-orange-200 hover:shadow-2xl hover:scale-105 transition-all duration-300 active:scale-95"
            >
                Let's Go!
                <ArrowRight className="w-6 h-6" />
            </button>

            <p className="text-xs text-gray-400 mt-6">
                Takes about 2 minutes • You can always change these later
            </p>
        </div>
    );
};

export default WelcomeStep;
