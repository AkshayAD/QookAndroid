import React from 'react';
import { Leaf, Check } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
    isRerun?: boolean;
}

const DIET_OPTIONS = [
    {
        value: 'Vegetarian',
        label: 'Pure Vegetarian',
        emoji: '🥬',
        desc: 'No meat, fish, or eggs',
        color: 'green'
    },
    {
        value: 'Vegetarian (with Eggs)',
        label: 'Vegetarian + Eggs',
        emoji: '🥚',
        desc: 'Eggetarian',
        color: 'amber'
    },
    {
        value: 'Non-Vegetarian',
        label: 'Non-Vegetarian',
        emoji: '🍗',
        desc: 'Includes meat & fish',
        color: 'red'
    },
    {
        value: 'Vegan',
        label: 'Vegan',
        emoji: '🌱',
        desc: 'No animal products',
        color: 'emerald'
    },
];

const DietTypeStep: React.FC<StepProps> = ({ data, updateData }) => {
    const toggleDiet = (value: string) => {
        const current = data.dietaryTypes || [];
        if (current.includes(value)) {
            // Remove if already selected (but keep at least one)
            if (current.length > 1) {
                updateData({ dietaryTypes: current.filter(d => d !== value) });
            }
        } else {
            // Add to selection
            updateData({ dietaryTypes: [...current, value] });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <Leaf className="w-5 h-5 text-orange-500" />
                    What's your food preference?
                </label>
                <p className="text-sm text-gray-500 mb-4">Select all that apply to your household</p>
            </div>

            <div className="space-y-3">
                {DIET_OPTIONS.map((diet) => {
                    const isSelected = data.dietaryTypes?.includes(diet.value);
                    return (
                        <button
                            key={diet.value}
                            onClick={() => toggleDiet(diet.value)}
                            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${isSelected
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            )}

                            <span className="text-4xl">{diet.emoji}</span>
                            <div className="flex-1">
                                <div className={`font-bold text-lg ${isSelected ? 'text-orange-700' : 'text-gray-800'
                                    }`}>
                                    {diet.label}
                                </div>
                                <div className="text-sm text-gray-500">{diet.desc}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
                💡 Select multiple if different family members have different preferences
            </p>
        </div>
    );
};

export default DietTypeStep;
