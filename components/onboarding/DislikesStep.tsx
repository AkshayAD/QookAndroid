import React, { useState } from 'react';
import { Ban, AlertTriangle, Plus, X, Check } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
    isRerun?: boolean;
}

const COMMON_DISLIKES = [
    { value: 'Onion', emoji: '🧅' },
    { value: 'Garlic', emoji: '🧄' },
    { value: 'Mushroom', emoji: '🍄' },
    { value: 'Cucumber', emoji: '🥒' },
    { value: 'Brinjal', emoji: '🍆' },
    { value: 'Spicy Food', emoji: '🌶️' },
    { value: 'Bitter Gourd', emoji: '🥬' },
    { value: 'Capsicum', emoji: '🫑' },
    { value: 'Tomato', emoji: '🍅' },
];

const COMMON_ALLERGIES = [
    { value: 'Nuts', emoji: '🥜' },
    { value: 'Dairy', emoji: '🥛' },
    { value: 'Gluten', emoji: '🌾' },
    { value: 'Soy', emoji: '🫘' },
    { value: 'Shellfish', emoji: '🦐' },
];

const DislikesStep: React.FC<StepProps> = ({ data, updateData }) => {
    const [customDislike, setCustomDislike] = useState('');

    const toggleDislike = (value: string) => {
        const current = data.dislikes || [];
        if (current.includes(value)) {
            updateData({ dislikes: current.filter(d => d !== value) });
        } else {
            updateData({ dislikes: [...current, value] });
        }
    };

    const toggleAllergy = (value: string) => {
        const current = data.allergies || [];
        if (current.includes(value)) {
            updateData({ allergies: current.filter(a => a !== value) });
        } else {
            updateData({ allergies: [...current, value] });
        }
    };

    const addCustomDislike = () => {
        if (customDislike.trim() && !data.dislikes?.includes(customDislike.trim())) {
            updateData({ dislikes: [...(data.dislikes || []), customDislike.trim()] });
            setCustomDislike('');
        }
    };

    return (
        <div className="space-y-8">
            {/* Dislikes */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <Ban className="w-5 h-5 text-orange-500" />
                    Any ingredients to avoid?
                </label>
                <p className="text-sm text-gray-500 mb-4">Tap to select (optional)</p>

                <div className="flex flex-wrap gap-2">
                    {COMMON_DISLIKES.map((item) => {
                        const isSelected = data.dislikes?.includes(item.value);
                        return (
                            <button
                                key={item.value}
                                onClick={() => toggleDislike(item.value)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${isSelected
                                        ? 'border-red-400 bg-red-50 text-red-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span>{item.emoji}</span>
                                <span className="text-sm font-medium">{item.value}</span>
                                {isSelected && <X className="w-4 h-4" />}
                            </button>
                        );
                    })}
                </div>

                {/* Custom dislike input */}
                <div className="flex gap-2 mt-3">
                    <input
                        type="text"
                        value={customDislike}
                        onChange={(e) => setCustomDislike(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomDislike()}
                        placeholder="Add other items..."
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-400 outline-none"
                    />
                    <button
                        onClick={addCustomDislike}
                        disabled={!customDislike.trim()}
                        className="px-4 py-2.5 bg-orange-500 text-white rounded-xl disabled:opacity-50"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Custom dislikes display */}
                {data.dislikes?.filter(d => !COMMON_DISLIKES.find(c => c.value === d)).map((item) => (
                    <span
                        key={item}
                        className="inline-flex items-center gap-2 px-4 py-2 mt-2 mr-2 rounded-full border-2 border-red-400 bg-red-50 text-red-700 text-sm font-medium"
                    >
                        {item}
                        <button onClick={() => toggleDislike(item)}>
                            <X className="w-4 h-4" />
                        </button>
                    </span>
                ))}
            </div>

            {/* Allergies */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Any allergies?
                </label>
                <p className="text-sm text-gray-500 mb-4">Important for safety</p>

                <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGIES.map((item) => {
                        const isSelected = data.allergies?.includes(item.value);
                        return (
                            <button
                                key={item.value}
                                onClick={() => toggleAllergy(item.value)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${isSelected
                                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span>{item.emoji}</span>
                                <span className="text-sm font-medium">{item.value}</span>
                                {isSelected && <Check className="w-4 h-4" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DislikesStep;
