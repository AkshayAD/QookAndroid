import React from 'react';
import { Briefcase, Check } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const TIFFIN_FOR_OPTIONS = [
    { value: 'office', label: 'Office', emoji: '🧑‍💼' },
    { value: 'college', label: 'College', emoji: '👨‍🎓' },
    { value: 'school', label: 'School Kids', emoji: '🧒' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TiffinStep: React.FC<StepProps> = ({ data, updateData }) => {
    const toggleDay = (day: string) => {
        const current = data.tiffinDays || [];
        if (current.includes(day)) {
            updateData({ tiffinDays: current.filter(d => d !== day) });
        } else {
            updateData({ tiffinDays: [...current, day] });
        }
    };

    const toggleTiffinFor = (value: string) => {
        const current = data.tiffinFor || [];
        if (current.includes(value)) {
            updateData({ tiffinFor: current.filter(t => t !== value) });
        } else {
            updateData({ tiffinFor: [...current, value] });
        }
    };

    return (
        <div className="space-y-8">
            {/* Main Question */}
            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                    <Briefcase className="w-5 h-5 text-orange-500" />
                    Do you pack tiffin/lunchbox?
                </label>
                <div className="flex gap-3">
                    <button
                        onClick={() => updateData({ hasTiffin: true, tiffinDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] })}
                        className={`flex-1 p-5 rounded-2xl border-2 transition-all ${data.hasTiffin === true
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                    >
                        <div className="text-3xl mb-2">🍱</div>
                        <div className={`font-semibold ${data.hasTiffin ? 'text-orange-700' : 'text-gray-700'}`}>
                            Yes
                        </div>
                        <div className="text-xs text-gray-500">We pack lunch</div>
                    </button>
                    <button
                        onClick={() => updateData({ hasTiffin: false, tiffinDays: [], tiffinFor: [] })}
                        className={`flex-1 p-5 rounded-2xl border-2 transition-all ${data.hasTiffin === false
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                    >
                        <div className="text-3xl mb-2">🏠</div>
                        <div className={`font-semibold ${data.hasTiffin === false ? 'text-orange-700' : 'text-gray-700'}`}>
                            No
                        </div>
                        <div className="text-xs text-gray-500">We eat at home</div>
                    </button>
                </div>
            </div>

            {/* Conditional: Tiffin details */}
            {data.hasTiffin && (
                <>
                    {/* Who needs tiffin */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-sm font-bold text-gray-700 mb-3">
                            👥 Who needs tiffin?
                        </label>
                        <div className="flex gap-3">
                            {TIFFIN_FOR_OPTIONS.map((opt) => {
                                const isSelected = data.tiffinFor?.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => toggleTiffinFor(opt.value)}
                                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all relative ${isSelected
                                                ? 'border-orange-400 bg-orange-50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <span className="text-2xl">{opt.emoji}</span>
                                        <span className={`text-xs font-medium ${isSelected ? 'text-orange-700' : 'text-gray-600'}`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Which days */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
                        <label className="block text-sm font-bold text-gray-700 mb-3">
                            📅 Which days?
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {DAYS.map((day) => {
                                const isSelected = data.tiffinDays?.includes(day);
                                return (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(day)}
                                        className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${isSelected
                                                ? 'border-orange-400 bg-orange-500 text-white'
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TiffinStep;
