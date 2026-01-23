import React from 'react';
import { Drumstick, Calendar, Check } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const NON_VEG_TYPES = [
    { value: 'Chicken', emoji: '🐔' },
    { value: 'Mutton', emoji: '🐑' },
    { value: 'Fish', emoji: '🐟' },
    { value: 'Prawns', emoji: '🦐' },
    { value: 'Crabs', emoji: '🦀' },
    { value: 'Eggs', emoji: '🥚' },
];

const FREQUENCY_OPTIONS = [
    { value: 'daily', label: 'Daily', desc: 'Every day' },
    { value: '3-4x/week', label: '3-4x a week', desc: 'Moderate' },
    { value: '1-2x/week', label: '1-2x a week', desc: 'Occasional' },
    { value: 'weekends', label: 'Weekends Only', desc: 'Special occasions' },
];

const NonVegStep: React.FC<StepProps> = ({ data, updateData }) => {
    const toggleNonVegType = (value: string) => {
        const current = data.nonVegPreferences || [];
        if (current.includes(value)) {
            updateData({ nonVegPreferences: current.filter(d => d !== value) });
        } else {
            updateData({ nonVegPreferences: [...current, value] });
        }
    };

    return (
        <div className="space-y-8">
            {/* Non-veg types */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <Drumstick className="w-5 h-5 text-orange-500" />
                    Which non-veg do you enjoy?
                </label>
                <p className="text-sm text-gray-500 mb-4">Select all that apply</p>

                <div className="grid grid-cols-3 gap-3">
                    {NON_VEG_TYPES.map((type) => {
                        const isSelected = data.nonVegPreferences?.includes(type.value);
                        return (
                            <button
                                key={type.value}
                                onClick={() => toggleNonVegType(type.value)}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all relative ${isSelected
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                <span className="text-3xl">{type.emoji}</span>
                                <span className={`text-sm font-medium ${isSelected ? 'text-orange-700' : 'text-gray-600'
                                    }`}>
                                    {type.value}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Frequency */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    How often would you like non-veg?
                </label>
                <p className="text-xs text-gray-500 mb-3">Optional - click again to unselect</p>
                <div className="grid grid-cols-2 gap-3">
                    {FREQUENCY_OPTIONS.map((freq) => (
                        <button
                            key={freq.value}
                            onClick={() => updateData({
                                nonVegFrequency: data.nonVegFrequency === freq.value ? '' : freq.value
                            })}
                            className={`p-4 rounded-2xl border-2 transition-all text-left ${data.nonVegFrequency === freq.value
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <div className={`font-semibold ${data.nonVegFrequency === freq.value ? 'text-orange-700' : 'text-gray-700'
                                }`}>
                                {freq.label}
                            </div>
                            <div className="text-xs text-gray-500">{freq.desc}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NonVegStep;
