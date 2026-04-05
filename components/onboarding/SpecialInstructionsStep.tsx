import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
    isRerun?: boolean;
}

const QUICK_ADDITIONS = [
    { label: 'Daily chai', text: 'Add chai to breakfast everyday' },
    { label: 'Light dinner', text: 'Keep dinner light, especially if lunch was heavy' },
    { label: 'Daily curd', text: 'Include curd or raita with lunch daily' },
    { label: 'Less oil', text: 'Use minimal oil in cooking' },
    { label: 'More veggies', text: 'Include seasonal vegetables in every meal' },
    { label: 'No repeat', text: 'Avoid repeating the same dish within the week' },
];

const SpecialInstructionsStep: React.FC<StepProps> = ({ data, updateData }) => {
    const addQuickInstruction = (text: string) => {
        const current = data.specialInstructions || '';
        if (!current.includes(text)) {
            const newInstructions = current ? `${current}\n${text}` : text;
            updateData({ specialInstructions: newInstructions });
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full mb-4">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">
                    Almost done, {data.userName || 'friend'}
                </h2>
            </div>

            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <MessageSquare className="w-5 h-5 text-orange-500" />
                    Anything Qook should remember right away?
                </label>
                <p className="text-sm text-gray-500 mb-4">
                    Share the rules that matter most. You can teach more later from swaps, edits, and saves.
                </p>

                <textarea
                    value={data.specialInstructions}
                    onChange={(e) => updateData({ specialInstructions: e.target.value })}
                    placeholder={`Examples:\n- Add chai to breakfast daily\n- Keep dinner light if lunch was heavy\n- Use seasonal vegetables\n- Balance heavy and light meals\n- Diabetic-friendly options for elders\n- Gym-style high protein meals`}
                    rows={5}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-100 outline-none transition-all resize-none"
                />
            </div>

            <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Quick additions:</p>
                <div className="flex flex-wrap gap-2">
                    {QUICK_ADDITIONS.map((item) => {
                        const isAdded = data.specialInstructions?.includes(item.text);
                        return (
                            <button
                                key={item.label}
                                onClick={() => !isAdded && addQuickInstruction(item.text)}
                                disabled={isAdded}
                                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${isAdded
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-orange-100 hover:text-orange-700 hover:border-orange-200'
                                    }`}
                            >
                                {item.label} {isAdded && 'Done'}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-900">Next up: Add what you already have</p>
                <p className="text-sm text-amber-800 mt-1">
                    After setup, Qook will let you snap your fridge, upload a receipt, or type ingredients so the first plan uses your real kitchen.
                </p>
            </div>
        </div>
    );
};

export default SpecialInstructionsStep;
