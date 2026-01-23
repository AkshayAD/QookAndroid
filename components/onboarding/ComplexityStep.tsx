import React from 'react';
import { Clock, Globe2 } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const COMPLEXITY_OPTIONS = [
    {
        value: 'quick',
        label: 'Quick & Simple',
        emoji: '⚡',
        desc: '30 mins or less',
        example: '"Dal-Rice-Sabzi type meals"'
    },
    {
        value: 'balanced',
        label: 'Balanced Mix',
        emoji: '⚖️',
        desc: 'Mix of quick & elaborate',
        example: '"Weekdays simple, weekends special"'
    },
    {
        value: 'elaborate',
        label: 'Restaurant Style',
        emoji: '👨‍🍳',
        desc: 'Full course meals',
        example: '"Main + sides + accompaniments"'
    },
];

const CUISINE_STYLES = [
    { value: 'regional', label: 'Regional Only', emoji: '🏠', desc: 'Home-style local' },
    { value: 'pan-indian', label: 'Pan-Indian', emoji: '🇮🇳', desc: 'Mix of regions' },
    { value: 'fusion', label: 'Fusion/Global', emoji: '🌍', desc: 'International flavors' },
];

const ComplexityStep: React.FC<StepProps> = ({ data, updateData }) => {
    return (
        <div className="space-y-8">
            {/* Meal Complexity */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    How elaborate should meals be?
                </label>
                <p className="text-sm text-gray-500 mb-4">This affects cooking time and ingredients</p>

                <div className="space-y-3">
                    {COMPLEXITY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => updateData({ mealComplexity: opt.value as 'quick' | 'balanced' | 'elaborate' })}
                            className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${data.mealComplexity === opt.value
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <span className="text-3xl mt-0.5">{opt.emoji}</span>
                            <div className="flex-1">
                                <div className={`font-bold ${data.mealComplexity === opt.value ? 'text-orange-700' : 'text-gray-800'
                                    }`}>
                                    {opt.label}
                                </div>
                                <div className="text-sm text-gray-500">{opt.desc}</div>
                                <div className="text-xs text-gray-400 mt-1 italic">{opt.example}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Cuisine Style */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                    <Globe2 className="w-5 h-5 text-orange-500" />
                    Preferred cuisine style?
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {CUISINE_STYLES.map((style) => (
                        <button
                            key={style.value}
                            onClick={() => updateData({ cuisineStyle: style.value as 'regional' | 'pan-indian' | 'fusion' })}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${data.cuisineStyle === style.value
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <span className="text-2xl">{style.emoji}</span>
                            <span className={`text-xs font-semibold text-center ${data.cuisineStyle === style.value ? 'text-orange-700' : 'text-gray-700'
                                }`}>
                                {style.label}
                            </span>
                            <span className="text-[10px] text-gray-500 text-center">{style.desc}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ComplexityStep;
