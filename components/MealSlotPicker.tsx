import React from 'react';
import { X, Sun, CloudSun, Moon } from 'lucide-react';
import { WeeklyPlan } from '../types';

interface MealSlotPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSlot: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
    weeklyPlan: WeeklyPlan | null;
    selectedMealName: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS: { type: 'breakfast' | 'lunch' | 'dinner'; label: string; Icon: typeof Sun }[] = [
    { type: 'breakfast', label: 'Breakfast', Icon: Sun },
    { type: 'lunch', label: 'Lunch', Icon: CloudSun },
    { type: 'dinner', label: 'Dinner', Icon: Moon },
];

export default function MealSlotPicker({
    isOpen,
    onClose,
    onSelectSlot,
    weeklyPlan,
    selectedMealName
}: MealSlotPickerProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-t-2xl">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="font-bold text-lg">Replace Which Meal?</h2>
                            <p className="text-xs text-white/80 mt-1 truncate">
                                Adding: {selectedMealName}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            title="Cancel"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Days Grid */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {weeklyPlan?.days.map((day, dayIndex) => (
                        <div key={dayIndex} className="border rounded-xl overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2 font-semibold text-sm text-gray-700">
                                {day.day || DAYS[dayIndex]}
                            </div>
                            <div className="grid grid-cols-3 divide-x">
                                {MEALS.map(({ type, label, Icon }) => {
                                    const currentMeal = day[type];
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                onSelectSlot(dayIndex, type);
                                                onClose();
                                            }}
                                            className="p-3 hover:bg-purple-50 transition-colors flex flex-col items-center gap-1 group"
                                        >
                                            <Icon className={`w-4 h-4 ${type === 'breakfast' ? 'text-amber-500' :
                                                type === 'lunch' ? 'text-orange-500' : 'text-indigo-500'
                                                }`} />
                                            <span className="text-[10px] font-medium text-gray-500 uppercase">
                                                {label}
                                            </span>
                                            <span className="text-xs text-gray-700 text-center line-clamp-2 leading-tight group-hover:text-purple-600">
                                                {currentMeal || <span className="text-gray-400 italic">Empty</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {!weeklyPlan && (
                        <div className="text-center py-10 text-gray-400">
                            <p>No meal plan loaded.</p>
                            <p className="text-xs mt-2">Generate a plan first to swap meals.</p>
                        </div>
                    )}
                </div>

                {/* Footer with Cancel button */}
                <div className="p-3 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                        Click any slot to replace
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

