import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRightLeft, Check, ClipboardList, CloudSun, Loader2, Moon, Pencil, ShoppingCart, Sun, X } from 'lucide-react';
import type { DayPlan, MealTransfer } from '../types';
import MealList from './MealList';

interface DayMealPreviewProps {
    selectedDate: Date | null;
    dayPlan?: DayPlan | null;
    onInitiateTransfer?: (transfer: MealTransfer) => void;
    onMealUpdate?: (dateKey: string, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => void;
    onOpenWeek?: (date: Date) => void;
    onGenerateWeekGrocery?: () => void;
    groceryLoading?: boolean;
    emptyMessage?: string;
    openWeekLabel?: string;
    helperText?: string;
}

type EditingMeal = {
    type: 'breakfast' | 'lunch' | 'dinner';
    value: string;
};

const mealConfigs = [
    { type: 'breakfast' as const, icon: Sun, colorClass: 'text-amber-600', label: 'Breakfast' },
    { type: 'lunch' as const, icon: CloudSun, colorClass: 'text-orange-600', label: 'Lunch' },
    { type: 'dinner' as const, icon: Moon, colorClass: 'text-indigo-600', label: 'Dinner' },
];

export default function DayMealPreview({
    selectedDate,
    dayPlan,
    onInitiateTransfer,
    onMealUpdate,
    onOpenWeek,
    onGenerateWeekGrocery,
    groceryLoading = false,
    emptyMessage = 'Tap a date to view meals',
    openWeekLabel = 'Open next 7 days in planner',
    helperText,
}: DayMealPreviewProps) {
    const [editingMeal, setEditingMeal] = useState<EditingMeal | null>(null);

    useEffect(() => {
        setEditingMeal(null);
    }, [selectedDate, dayPlan?.day]);

    const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

    const saveEdit = async () => {
        if (!editingMeal || !dateKey || !onMealUpdate) {
            return;
        }

        await onMealUpdate(dateKey, editingMeal.type, editingMeal.value);
        setEditingMeal(null);
    };

    const cancelEdit = () => {
        setEditingMeal(null);
    };

    return (
        <>
            <div className="p-4 border-b bg-gray-50 flex justify-between items-start gap-3">
                <div>
                    <h3 className="font-bold text-gray-800">
                        {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a Day'}
                    </h3>
                    {helperText && (
                        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
                    )}
                </div>
                {selectedDate && onOpenWeek && (
                    <button
                        onClick={() => onOpenWeek(selectedDate)}
                        className="flex items-center gap-1.5 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 hover:border-indigo-300 text-xs font-medium"
                        title={openWeekLabel}
                        aria-label={openWeekLabel}
                    >
                        <ClipboardList className="w-4 h-4" />
                        <span>{openWeekLabel}</span>
                    </button>
                )}
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {!selectedDate ? (
                    <p className="text-gray-400 text-sm text-center mt-10">{emptyMessage}</p>
                ) : (
                    mealConfigs.map(({ type, icon: Icon, colorClass, label }) => {
                        const meal = dayPlan?.[type] || '';
                        const isEditing = editingMeal?.type === type;

                        return (
                            <div key={type} className="group relative bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`flex items-center gap-2 text-xs font-bold uppercase ${colorClass}`}>
                                        <Icon className="w-4 h-4" /> {label}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {onMealUpdate && !isEditing && (
                                            <button
                                                onClick={() => setEditingMeal({ type, value: meal })}
                                                className="text-gray-300 hover:text-green-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Edit meal"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        )}
                                        {meal && selectedDate && onInitiateTransfer && (
                                            <button
                                                onClick={() => onInitiateTransfer({
                                                    sourceDate: format(selectedDate, 'yyyy-MM-dd'),
                                                    sourceMealType: label as 'Breakfast' | 'Lunch' | 'Dinner',
                                                    sourceMealName: meal,
                                                })}
                                                className="text-gray-300 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Move or Copy"
                                            >
                                                <ArrowRightLeft className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={editingMeal.value}
                                            onChange={(event) => setEditingMeal({ ...editingMeal, value: event.target.value })}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            autoFocus
                                            placeholder={`Enter ${label.toLowerCase()}...`}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    void saveEdit();
                                                }
                                                if (event.key === 'Escape') {
                                                    cancelEdit();
                                                }
                                            }}
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    void saveEdit();
                                                }}
                                                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
                                            >
                                                <Check className="w-3 h-3" /> Save
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 flex items-center gap-1"
                                            >
                                                <X className="w-3 h-3" /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : meal ? (
                                    <MealList content={meal} />
                                ) : (
                                    <p className="text-gray-400 text-sm italic">No meal planned</p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {selectedDate && onGenerateWeekGrocery && (
                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={onGenerateWeekGrocery}
                        disabled={groceryLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {groceryLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="w-4 h-4" />
                                Generate Grocery for This Week
                            </>
                        )}
                    </button>
                </div>
            )}
        </>
    );
}
