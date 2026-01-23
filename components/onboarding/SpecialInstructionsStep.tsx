import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { OnboardingData } from '../../types';

interface StepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onNext: () => void;
}

const QUICK_ADDITIONS = [
    { label: '☕ Daily Chai', text: 'Add chai to breakfast everyday' },
    { label: '🥗 Light Dinner', text: 'Keep dinner light, especially if lunch was heavy' },
    { label: '🥛 Daily Curd', text: 'Include curd/raita with lunch daily' },
    { label: '🌿 Less Oil', text: 'Use minimal oil in cooking' },
    { label: '🥬 More Veggies', text: 'Include seasonal vegetables in every meal' },
    { label: '🍚 No Repeat', text: 'Avoid repeating same dish within the week' },
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
                    Almost done, {data.userName || 'friend'}! ✨
                </h2>
            </div>

            <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-2">
                    <MessageSquare className="w-5 h-5 text-orange-500" />
                    Any special instructions?
                </label>
                <p className="text-sm text-gray-500 mb-4">
                    Tell me anything else about your meal preferences
                </p>

                {/* Text area */}
                <textarea
                    value={data.specialInstructions}
                    onChange={(e) => updateData({ specialInstructions: e.target.value })}
                    placeholder="Examples:&#10;• Add chai to breakfast daily&#10;• Keep dinner light if lunch was heavy&#10;• Use seasonal vegetables&#10;• Balance heavy/light meals&#10;• Diabetic-friendly options for elderly&#10;• GYM-style high protein meals"
                    rows={5}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-100 outline-none transition-all resize-none"
                />
            </div>

            {/* Quick additions */}
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
                                {item.label} {isAdded && '✓'}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
                💡 You can always update these in your profile settings later
            </p>
        </div>
    );
};

export default SpecialInstructionsStep;
