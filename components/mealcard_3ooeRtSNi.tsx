
import React, { useState } from 'react';
import { DayPlan } from '../types';
import { RefreshCw, Sun, CloudSun, Moon, MessageSquarePlus, Pencil, Check, X, Trash2, Bell } from 'lucide-react';
import MealList from './MealList';

interface Props {
  dayPlan: DayPlan;
  dayIndex: number;
  onRegenerate: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onSmartEdit: (dayPlan: DayPlan, dayIndex: number) => void;
  onMealUpdate?: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => void;
  isLoading: boolean;
  isSwapMode?: boolean;
  onSwapSelect?: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  selectedSwap?: { dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner' } | null;
  dateLabel?: string;
  showPrepReminders?: boolean;
}

const MealCard: React.FC<Props> = ({
  dayPlan,
  dayIndex,
  onRegenerate,
  onSmartEdit,
  onMealUpdate,
  isLoading,
  isSwapMode = false,
  onSwapSelect,
  selectedSwap,
  dateLabel,
  showPrepReminders = true
}) => {
  // Card-level edit mode (not per-meal)
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    breakfast: dayPlan.breakfast || '',
    lunch: dayPlan.lunch || '',
    dinner: dayPlan.dinner || ''
  });

  // Check if this card is "empty" (no meals)
  const isEmpty = !dayPlan.breakfast && !dayPlan.lunch && !dayPlan.dinner;

  const startEditing = () => {
    if (isSwapMode) return;
    setEditValues({
      breakfast: dayPlan.breakfast || '',
      lunch: dayPlan.lunch || '',
      dinner: dayPlan.dinner || ''
    });
    setIsEditing(true);
  };

  const saveEdits = () => {
    if (onMealUpdate) {
      if (editValues.breakfast !== dayPlan.breakfast) {
        onMealUpdate(dayIndex, 'breakfast', editValues.breakfast);
      }
      if (editValues.lunch !== dayPlan.lunch) {
        onMealUpdate(dayIndex, 'lunch', editValues.lunch);
      }
      if (editValues.dinner !== dayPlan.dinner) {
        onMealUpdate(dayIndex, 'dinner', editValues.dinner);
      }
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValues({
      breakfast: dayPlan.breakfast || '',
      lunch: dayPlan.lunch || '',
      dinner: dayPlan.dinner || ''
    });
  };

  // Render a meal section - either in edit mode or display mode
  const renderMealSection = (
    type: 'breakfast' | 'lunch' | 'dinner',
    Icon: React.ElementType,
    colorClass: string,
    label: string,
    placeholder: string
  ) => {
    const mealContent = dayPlan[type] || '';
    const isSelected = selectedSwap?.dayIndex === dayIndex && selectedSwap?.mealType === type;
    const isSwapTarget = isSwapMode && !isSelected;
    const hasMeal = !!mealContent.trim();

    return (
      <div
        onClick={() => isSwapMode && onSwapSelect && onSwapSelect(dayIndex, type)}
        className={`relative ${type !== 'breakfast' ? 'pt-2 border-t border-dashed border-gray-200' : ''} 
          ${isSwapMode ? 'cursor-pointer transition-all p-2 rounded-lg' : ''}
          ${isSelected ? 'bg-green-50 ring-2 ring-green-500 shadow-sm' : ''}
          ${isSwapTarget ? 'hover:bg-gray-50 hover:ring-2 hover:ring-indigo-200' : ''}
`}
      >
        <div className="flex justify-between items-start">
          <div className={`flex items-center gap-2 text-xs font-semibold ${colorClass} mb-1`}>
            <Icon className="w-3 h-3" /> {label}
            {isSwapMode && isSelected && <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded text-[10px]">Selected</span>}
          </div>
          {/* Regen button only when not editing */}
          {!isSwapMode && !isEditing && hasMeal && (
            <button
              onClick={(e) => { e.stopPropagation(); onRegenerate(dayIndex, type); }}
              disabled={isLoading}
              data-tour={dayIndex === 0 && type === 'breakfast' ? 'meal-regenerate' : undefined}
              className="opacity-50 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
              title="Quick Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Edit mode: text input */}
        {(isEditing || (!hasMeal && !isSwapMode)) ? (
          <input
            type="text"
            value={editValues[type]}
            onChange={(e) => setEditValues(prev => ({ ...prev, [type]: e.target.value }))}
            onClick={(e) => { e.stopPropagation(); if (!isEditing) startEditing(); }}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded focus:ring-2 focus:ring-orange-300 focus:border-orange-400 focus:bg-white transition-all"
          />
        ) : (
          <div className={`${isSwapMode && !isSelected ? 'opacity-70' : ''}`}>
            <MealList content={mealContent} />
          </div>
        )}
      </div>
    );
  };

  // Placeholders for empty states
  const placeholders = {
    breakfast: ['Enter a tasty breakfast...', 'Add your morning meal...', 'Start the day right...', 'Plan something yummy...', 'Add a morning delight...', 'Something quick & healthy...', 'Fuel up with...'],
    lunch: ['Enter a satisfying lunch...', 'Add a midday treat...', 'Power through with...', 'Try something new...', 'Add comfort food...', 'Keep it light & fresh...', 'Plan something filling...'],
    dinner: ['Enter a delicious dinner...', 'Add an evening feast...', 'Something special...', 'Add family favorites...', 'Try a new cuisine...', 'Keep it simple & tasty...', 'End the day deliciously...']
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-md border overflow-hidden hover:shadow-lg transition-all relative group
        ${isEmpty ? 'border-2 border-dashed border-gray-200 hover:border-orange-300' : 'border-gray-100'}
        ${isSwapMode ? 'ring-1 ring-indigo-200' : ''}
`}
      data-tour={dayIndex === 0 ? 'meal-card' : undefined}
    >
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
        <h3 className="font-bold text-gray-800">{dateLabel || dayPlan.day}</h3>
        <div className="flex items-center gap-1.5">
          {/* Single Pencil Icon for whole card */}
          {!isSwapMode && !isEmpty && !isEditing && onMealUpdate && (
            <button
              onClick={startEditing}
              className="opacity-50 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
              title="Edit all meals"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {/* Save/Cancel when editing */}
          {isEditing && (
            <>
              <button
                onClick={saveEdits}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </>
          )}
          {/* AI Edit button */}
          {!isSwapMode && !isEditing && !isEmpty && (
            <button
              onClick={() => onSmartEdit(dayPlan, dayIndex)}
              data-tour={dayIndex === 0 ? 'smart-edit' : undefined}
              className="text-xs flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full hover:bg-indigo-100 transition-colors"
            >
              <MessageSquarePlus className="w-3 h-3" /> Edit with AI
            </button>
          )}
        </div>
      </div>

      {/* Meal Sections */}
      <div className="p-4 space-y-4">
        {renderMealSection('breakfast', Sun, 'text-amber-600', 'BREAKFAST', placeholders.breakfast[dayIndex % 7])}
        {renderMealSection('lunch', CloudSun, 'text-orange-600', 'LUNCH', placeholders.lunch[dayIndex % 7])}
        {renderMealSection('dinner', Moon, 'text-indigo-600', 'DINNER', placeholders.dinner[dayIndex % 7])}
      </div>

      {/* Prep-Ahead Reminders */}
      {showPrepReminders && dayPlan.prepAhead && (
        <div className="px-4 pb-3">
          {(dayPlan.prepAhead.forBreakfast || dayPlan.prepAhead.forLunch || dayPlan.prepAhead.forDinner) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-1.5">
                <Bell className="w-3 h-3" />
                Prep Ahead
              </div>
              <div className="space-y-1 text-xs text-amber-800">
                {dayPlan.prepAhead.forBreakfast && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span>
                    <span>{dayPlan.prepAhead.forBreakfast}</span>
                  </div>
                )}
                {dayPlan.prepAhead.forLunch && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span>
                    <span>{dayPlan.prepAhead.forLunch}</span>
                  </div>
                )}
                {dayPlan.prepAhead.forDinner && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span>
                    <span>{dayPlan.prepAhead.forDinner}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MealCard;