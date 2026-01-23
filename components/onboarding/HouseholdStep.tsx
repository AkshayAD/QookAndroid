import React from 'react';
import { Users, Utensils } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const HOUSEHOLD_SIZES = [
    { value: 1, label: 'Just Me', emoji: '🧑', desc: 'Solo dining' },
    { value: 2, label: 'Couple', emoji: '👫', desc: 'Two people' },
    { value: 4, label: 'Small Family', emoji: '👨‍👩‍👧', desc: '3-4 people' },
    { value: 6, label: 'Large Family', emoji: '👨‍👩‍👧‍👦', desc: '5-6 people' },
    { value: 8, label: 'Joint Family', emoji: '👨‍👩‍👧‍👦', desc: '7+ people' },
];

const PORTION_SIZES = [
    { value: 'light', label: 'Light Eaters', emoji: '🥗', desc: 'Smaller portions' },
    { value: 'regular', label: 'Regular', emoji: '🍽️', desc: 'Normal portions' },
    { value: 'hearty', label: 'Hearty Appetites', emoji: '🍛', desc: 'Generous portions' },
];

const HouseholdStep: React.FC<StepProps> = ({ data, updateData }) => {
    return (
        <div className="space-y-8">
            {/* Household Size */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                    <Users className="w-5 h-5 text-orange-500" />
                    How many people are you cooking for?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {HOUSEHOLD_SIZES.map((size) => (
                        <button
                            key={size.value}
                            onClick={() => updateData({ householdSize: size.value })}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${data.householdSize === size.value
                                    ? 'border-orange-400 bg-orange-50 shadow-md'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <span className="text-3xl">{size.emoji}</span>
                            <span className={`font-semibold text-sm ${data.householdSize === size.value ? 'text-orange-700' : 'text-gray-700'
                                }`}>
                                {size.label}
                            </span>
                            <span className="text-xs text-gray-500">{size.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Portion Size */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                    <Utensils className="w-5 h-5 text-orange-500" />
                    Typical portion size?
                </label>
                <div className="space-y-3">
                    {PORTION_SIZES.map((portion) => (
                        <button
                            key={portion.value}
                            onClick={() => updateData({ portionSize: portion.value as 'light' | 'regular' | 'hearty' })}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${data.portionSize === portion.value
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <span className="text-2xl">{portion.emoji}</span>
                            <div>
                                <div className={`font-semibold ${data.portionSize === portion.value ? 'text-orange-700' : 'text-gray-700'
                                    }`}>
                                    {portion.label}
                                </div>
                                <div className="text-sm text-gray-500">{portion.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HouseholdStep;
