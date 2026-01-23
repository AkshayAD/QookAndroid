import React from 'react';
import { UtensilsCrossed, Check } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const MEAL_OPTIONS = [
    {
        value: 'breakfast',
        label: 'Breakfast',
        emoji: '☀️',
        desc: 'Morning meal',
        color: 'amber'
    },
    {
        value: 'lunch',
        label: 'Lunch',
        emoji: '🌤️',
        desc: 'Midday meal',
        color: 'orange'
    },
    {
        value: 'dinner',
        label: 'Dinner',
        emoji: '🌙',
        desc: 'Evening meal',
        color: 'indigo'
    },
];

const MealsStep: React.FC<StepProps> = ({ data, updateData }) => {
    const toggleMeal = (value: 'breakfast' | 'lunch' | 'dinner') => {
        const current = data.mealsToPrepare || [];
        if (current.includes(value)) {
            // Remove if already selected (but keep at least one)
            if (current.length > 1) {
                updateData({ mealsToPrepare: current.filter(m => m !== value) });
            }
        } else {
            updateData({ mealsToPrepare: [...current, value] });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <UtensilsCrossed className="w-5 h-5 text-orange-500" />
                    Which meals do you want planned?
                </label>
                <p className="text-sm text-gray-500 mb-4">Select the meals you'd like me to plan for you</p>
            </div>

            <div className="space-y-3">
                {MEAL_OPTIONS.map((meal) => {
                    const isSelected = data.mealsToPrepare?.includes(meal.value as 'breakfast' | 'lunch' | 'dinner');
                    return (
                        <button
                            key={meal.value}
                            onClick={() => toggleMeal(meal.value as 'breakfast' | 'lunch' | 'dinner')}
                            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left relative ${isSelected
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            {isSelected && (
                                <div className="absolute top-4 right-4 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            )}
                            <span className="text-4xl">{meal.emoji}</span>
                            <div>
                                <div className={`font-bold text-lg ${isSelected ? 'text-orange-700' : 'text-gray-800'
                                    }`}>
                                    {meal.label}
                                </div>
                                <div className="text-sm text-gray-500">{meal.desc}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-gray-400 text-center">
                💡 You can skip meals you don't need planned
            </p>
        </div>
    );
};

export default MealsStep;
