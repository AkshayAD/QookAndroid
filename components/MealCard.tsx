
import React, { useState } from 'react';
import { DayPlan } from '../types';
import { RefreshCw, Sun, CloudSun, Moon, MessageSquarePlus, Pencil, Check, X, Trash2, Bell, Users, PlayCircle, Lock, Shuffle } from 'lucide-react';
import MealList from './MealList';
import { useFamily } from '../contexts/FamilyContext';
import { useFeatureGate, Feature } from '../hooks/useFeatureGate';
import FeatureGateModal from './FeatureGateModal';

interface Props {
  dayPlan: DayPlan;
  dayIndex: number;
  enabledMeals?: Array<'breakfast' | 'lunch' | 'dinner'>;
  onRegenerate: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onSmartEdit: (dayPlan: DayPlan, dayIndex: number) => void;
  onMealUpdate?: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => void;
  isLoading: boolean;
  isSwapMode?: boolean;
  onSwapSelect?: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  selectedSwap?: { dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner' } | null;
  dateLabel?: string;
  showPrepReminders?: boolean;
  showQuantities?: boolean;
  isLastDay?: boolean;
  onOpenRecipe?: (mealName: string) => void;
  onUpgrade?: () => void;
}

const MealCard: React.FC<Props> = ({
  dayPlan,
  dayIndex,
  enabledMeals = ['breakfast', 'lunch', 'dinner'],
  onRegenerate,
  onSmartEdit,
  onMealUpdate,
  isLoading,
  isSwapMode = false,
  onSwapSelect,
  selectedSwap,
  dateLabel,
  showPrepReminders = true,
  showQuantities = true,
  isLastDay = false,
  onOpenRecipe,
  onUpgrade
}) => {
  // Family context for shared indicator and styling
  const { isInFamily, isFamilyModeActive } = useFamily();

  // Feature gating
  const { canAccess, isStandardOrAbove } = useFeatureGate();
  const [gatedFeature, setGatedFeature] = useState<Feature | null>(null);


  // Card-level edit mode (not per-meal)
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    breakfast: dayPlan.breakfast || '',
    lunch: dayPlan.lunch || '',
    dinner: dayPlan.dinner || ''
  });

  const visibleMeals = enabledMeals.length > 0 ? enabledMeals : ['breakfast', 'lunch', 'dinner'];

  // Check if this card is "empty" (no visible meals)
  const isEmpty = visibleMeals.every((mealType) => {
    const mealValue = dayPlan[mealType];
    return typeof mealValue !== 'string' || mealValue.trim() === '';
  });
  // Feature gate handler
  const handleGatedAction = (feature: Feature, action: () => void) => {
    if (canAccess(feature)) {
      action();
    } else {
      setGatedFeature(feature);
    }
  };

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
      if (visibleMeals.includes('breakfast') && editValues.breakfast !== dayPlan.breakfast) {
        onMealUpdate(dayIndex, 'breakfast', editValues.breakfast);
      }
      if (visibleMeals.includes('lunch') && editValues.lunch !== dayPlan.lunch) {
        onMealUpdate(dayIndex, 'lunch', editValues.lunch);
      }
      if (visibleMeals.includes('dinner') && editValues.dinner !== dayPlan.dinner) {
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
    placeholder: string,
    isFirstSection: boolean
  ) => {
    const mealContent = dayPlan[type] || '';
    const isSelected = selectedSwap?.dayIndex === dayIndex && selectedSwap?.mealType === type;
    const isSwapTarget = isSwapMode && !isSelected;
    const hasMeal = !!mealContent.trim();
    const canRegen = canAccess('single_regen');

    return (
      <div
        onClick={() => isSwapMode && onSwapSelect && onSwapSelect(dayIndex, type)}
        className={`relative ${!isFirstSection ? 'pt-2 border-t border-dashed border-gray-200' : ''} 
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
          {/* Regen and Recipe buttons - only when not editing */}
          {!isSwapMode && !isEditing && hasMeal && (
            <div className="flex items-center gap-0.5">
              {onSwapSelect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwapSelect(dayIndex, type);
                  }}
                  className="opacity-60 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-emerald-600"
                  title={`Swap ${label.toLowerCase()}`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              )}
              {onOpenRecipe && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenRecipe(mealContent); }}
                  className="opacity-50 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-purple-600"
                  title="View Recipe"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGatedAction('single_regen', () => onRegenerate(dayIndex, type));
                }}
                disabled={isLoading}
                data-tour={dayIndex === 0 && type === 'breakfast' ? 'meal-regenerate' : undefined}
                className={`opacity-50 group-hover:opacity-100 transition-opacity p-1 disabled:opacity-50 ${canRegen ? 'text-gray-400 hover:text-blue-600' : 'text-gray-300'
                  }`}
                title={canRegen ? 'Quick Regenerate' : 'Upgrade to Standard to unlock'}
              >
                {canRegen ? (
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
              </button>
            </div>
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
            <MealList content={mealContent} showQuantities={showQuantities} />
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

  const canSmartEdit = canAccess('smart_edit');

  return (
    <>
      {/* Feature Gate Modal */}
      <FeatureGateModal
        isOpen={gatedFeature !== null}
        onClose={() => setGatedFeature(null)}
        feature={gatedFeature || 'single_regen'}
        onUpgrade={onUpgrade}
      />

      <div
        className={`bg-white rounded-xl shadow-md border overflow-hidden hover:shadow-lg transition-all relative group
          ${isEmpty ? 'border-2 border-dashed border-gray-200 hover:border-orange-300' : 'border-gray-100'}
          ${isSwapMode ? 'ring-1 ring-indigo-200' : ''}
          ${isFamilyModeActive ? 'border-l-4 border-l-purple-500' : ''}
`}
        data-tour={dayIndex === 0 ? 'meal-card' : undefined}
      >
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800">{dateLabel || dayPlan.day}</h3>
            {/* Family sharing badge */}
            {isInFamily && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-semibold">
                <Users className="w-2.5 h-2.5" />
                Shared
              </span>
            )}
          </div>
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
            {/* AI Edit button - with feature gating */}
            {!isSwapMode && !isEditing && !isEmpty && (
              <button
                onClick={() => handleGatedAction('smart_edit', () => onSmartEdit(dayPlan, dayIndex))}
                data-tour={dayIndex === 0 ? 'smart-edit' : undefined}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${canSmartEdit
                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                    : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                  }`}
                title={canSmartEdit ? 'Edit with AI' : 'Upgrade to Standard to unlock'}
              >
                {canSmartEdit ? (
                  <MessageSquarePlus className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                {canSmartEdit ? 'Edit with AI' : 'Upgrade'}
              </button>
            )}
          </div>
        </div>

        {/* Meal Sections */}
        <div className="p-4 space-y-4">
          {visibleMeals.includes('breakfast') && renderMealSection('breakfast', Sun, 'text-amber-600', 'BREAKFAST', placeholders.breakfast[dayIndex % 7], true)}
          {visibleMeals.includes('lunch') && renderMealSection('lunch', CloudSun, 'text-orange-600', 'LUNCH', placeholders.lunch[dayIndex % 7], !visibleMeals.includes('breakfast'))}
          {visibleMeals.includes('dinner') && renderMealSection('dinner', Moon, 'text-indigo-600', 'DINNER', placeholders.dinner[dayIndex % 7], !visibleMeals.includes('breakfast') && !visibleMeals.includes('lunch'))}
        </div>

        {/* Prep-Ahead Reminders - Skip for last day since next day is not planned */}
        {(() => {
          // Helper to check if prep value is valid (not null, 'null', or empty)
          const isValidPrep = (val: string | null | undefined): val is string =>
            !!val && val !== 'null' && val.trim() !== '';

          const hasValidPrep = dayPlan.prepAhead && (
            isValidPrep(dayPlan.prepAhead.forBreakfast) ||
            isValidPrep(dayPlan.prepAhead.forLunch) ||
            isValidPrep(dayPlan.prepAhead.forDinner)
          );

          if (!showPrepReminders || isLastDay || !hasValidPrep) return null;

          return (
            <div className="px-4 pb-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-1.5">
                  <Bell className="w-3 h-3" />
                  Prep Ahead
                </div>
                <div className="space-y-1 text-xs text-amber-800">
                  {visibleMeals.includes('breakfast') && isValidPrep(dayPlan.prepAhead?.forBreakfast) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-500">•</span>
                      <span>{dayPlan.prepAhead.forBreakfast}</span>
                    </div>
                  )}
                  {visibleMeals.includes('lunch') && isValidPrep(dayPlan.prepAhead?.forLunch) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-500">•</span>
                      <span>{dayPlan.prepAhead.forLunch}</span>
                    </div>
                  )}
                  {visibleMeals.includes('dinner') && isValidPrep(dayPlan.prepAhead?.forDinner) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-500">•</span>
                      <span>{dayPlan.prepAhead.forDinner}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div >
    </>
  );
};

export default MealCard;
