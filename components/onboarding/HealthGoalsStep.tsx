import React from 'react';
import { Heart, Check } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const HEALTH_GOALS = [
    {
        value: 'fitness',
        label: 'Gym / Fitness',
        emoji: '🏋️',
        desc: 'High protein meals'
    },
    {
        value: 'diabetes',
        label: 'Diabetes Care',
        emoji: '🩺',
        desc: 'Low sugar, controlled carbs'
    },
    {
        value: 'heart',
        label: 'Heart Health',
        emoji: '❤️',
        desc: 'Low oil, less fried'
    },
    {
        value: 'weight',
        label: 'Weight Management',
        emoji: '⚖️',
        desc: 'Portion controlled'
    },
    {
        value: 'pregnancy',
        label: 'Pregnancy / Lactation',
        emoji: '🤰',
        desc: 'Nutritious, calcium-rich'
    },
    {
        value: 'senior',
        label: 'Senior Friendly',
        emoji: '👴',
        desc: 'Easy to digest, soft foods'
    },
    {
        value: 'kids',
        label: 'Kid-Friendly',
        emoji: '🧒',
        desc: 'Child-approved recipes'
    },
    {
        value: 'none',
        label: 'No specific goals',
        emoji: '✨',
        desc: 'Regular healthy eating'
    },
];

const HealthGoalsStep: React.FC<StepProps> = ({ data, updateData }) => {
    const toggleGoal = (value: string) => {
        if (value === 'none') {
            updateData({ healthGoals: ['none'] });
            return;
        }

        const current = (data.healthGoals || []).filter(g => g !== 'none');
        if (current.includes(value)) {
            updateData({ healthGoals: current.filter(g => g !== value) });
        } else {
            updateData({ healthGoals: [...current, value] });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <Heart className="w-5 h-5 text-orange-500" />
                    Any health goals or special needs?
                </label>
                <p className="text-sm text-gray-500 mb-4">Select all that apply (optional)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HEALTH_GOALS.map((goal) => {
                    const isSelected = data.healthGoals?.includes(goal.value);
                    return (
                        <button
                            key={goal.value}
                            onClick={() => toggleGoal(goal.value)}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left relative ${isSelected
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}
                            <span className="text-2xl">{goal.emoji}</span>
                            <div className="flex-1 min-w-0">
                                <div className={`font-semibold text-sm truncate ${isSelected ? 'text-orange-700' : 'text-gray-700'
                                    }`}>
                                    {goal.label}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{goal.desc}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default HealthGoalsStep;
