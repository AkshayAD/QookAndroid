import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  CloudSun,
  Lock,
  MessageSquarePlus,
  Moon,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  RefreshCw,
  Shuffle,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { DayPlan } from '../types';
import MealList from './MealList';
import { useFamily } from '../contexts/FamilyContext';
import { useFeatureGate, Feature } from '../hooks/useFeatureGate';
import FeatureGateModal from './FeatureGateModal';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface Props {
  dayPlan: DayPlan;
  dayIndex: number;
  enabledMeals?: MealType[];
  onRegenerate: (dayIndex: number, mealType: MealType) => void;
  onSmartEdit: (dayPlan: DayPlan, dayIndex: number) => void;
  onMealUpdate?: (dayIndex: number, mealType: MealType, newValue: string) => void;
  isLoading: boolean;
  isSwapMode?: boolean;
  onSwapSelect?: (dayIndex: number, mealType: MealType) => void;
  selectedSwap?: { dayIndex: number; mealType: MealType } | null;
  dateLabel?: string;
  showPrepReminders?: boolean;
  showQuantities?: boolean;
  isLastDay?: boolean;
  onOpenRecipe?: (mealName: string) => void;
  onUpgrade?: () => void;
  isSelectedDay?: boolean;
}

const LABEL_STYLES: Record<MealType, { icon: React.ElementType; accent: string; surface: string; label: string }> = {
  breakfast: {
    icon: Sun,
    accent: 'text-amber-600',
    surface: 'bg-amber-50',
    label: 'Breakfast',
  },
  lunch: {
    icon: CloudSun,
    accent: 'text-orange-600',
    surface: 'bg-orange-50',
    label: 'Lunch',
  },
  dinner: {
    icon: Moon,
    accent: 'text-indigo-600',
    surface: 'bg-indigo-50',
    label: 'Dinner',
  },
};

const PLACEHOLDERS: Record<MealType, string[]> = {
  breakfast: ['Enter a tasty breakfast...', 'Add your morning meal...', 'Start the day right...', 'Plan something yummy...', 'Add a morning delight...', 'Something quick & healthy...', 'Fuel up with...'],
  lunch: ['Enter a satisfying lunch...', 'Add a midday treat...', 'Power through with...', 'Try something new...', 'Add comfort food...', 'Keep it light & fresh...', 'Plan something filling...'],
  dinner: ['Enter a delicious dinner...', 'Add an evening feast...', 'Something special...', 'Add family favorites...', 'Try a new cuisine...', 'Keep it simple & tasty...', 'End the day deliciously...'],
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

const MealCard: React.FC<Props> = ({
  dayPlan,
  dayIndex,
  enabledMeals = MEAL_ORDER,
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
  onUpgrade,
  isSelectedDay = false,
}) => {
  const { isInFamily, isFamilyModeActive } = useFamily();
  const { canAccess } = useFeatureGate();
  const [gatedFeature, setGatedFeature] = useState<Feature | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MealType | null>(null);
  const [openMenuMealType, setOpenMenuMealType] = useState<MealType | null>(null);
  const [editValues, setEditValues] = useState({
    breakfast: dayPlan.breakfast || '',
    lunch: dayPlan.lunch || '',
    dinner: dayPlan.dinner || '',
  });

  const visibleMeals = enabledMeals.length > 0 ? enabledMeals : MEAL_ORDER;
  const isEmpty = visibleMeals.every((mealType) => {
    const mealValue = dayPlan[mealType];
    return typeof mealValue !== 'string' || mealValue.trim() === '';
  });
  const canSmartEdit = canAccess('smart_edit');
  const canRegen = canAccess('single_regen');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuMealType) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuMealType(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuMealType(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuMealType]);

  const handleGatedAction = (feature: Feature, action: () => void) => {
    if (canAccess(feature)) {
      action();
      return;
    }

    setGatedFeature(feature);
  };

  const startEditing = (target: MealType | null = null) => {
    if (isSwapMode) {
      return;
    }

    setEditValues({
      breakfast: dayPlan.breakfast || '',
      lunch: dayPlan.lunch || '',
      dinner: dayPlan.dinner || '',
    });
    setEditingTarget(target);
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
    setEditingTarget(null);
  };

  const cancelEdit = () => {
    setEditValues({
      breakfast: dayPlan.breakfast || '',
      lunch: dayPlan.lunch || '',
      dinner: dayPlan.dinner || '',
    });
    setIsEditing(false);
    setEditingTarget(null);
  };

  const prepContent = useMemo(() => {
    const isValidPrep = (value: string | null | undefined): value is string => Boolean(value && value !== 'null' && value.trim() !== '');

    if (!showPrepReminders || isLastDay || !dayPlan.prepAhead) {
      return [];
    }

    return [
      visibleMeals.includes('breakfast') && isValidPrep(dayPlan.prepAhead.forBreakfast) ? dayPlan.prepAhead.forBreakfast : null,
      visibleMeals.includes('lunch') && isValidPrep(dayPlan.prepAhead.forLunch) ? dayPlan.prepAhead.forLunch : null,
      visibleMeals.includes('dinner') && isValidPrep(dayPlan.prepAhead.forDinner) ? dayPlan.prepAhead.forDinner : null,
    ].filter(Boolean) as string[];
  }, [dayPlan.prepAhead, isLastDay, showPrepReminders, visibleMeals]);

  const renderMealSection = (mealType: MealType, isFirstSection: boolean) => {
    const { icon: Icon, accent, surface, label } = LABEL_STYLES[mealType];
    const mealContent = dayPlan[mealType] || '';
    const isSelected = selectedSwap?.dayIndex === dayIndex && selectedSwap?.mealType === mealType;
    const isSwapTarget = isSwapMode && !isSelected;
    const hasMeal = mealContent.trim().length > 0;

    return (
      <section
        key={mealType}
        onClick={() => isSwapMode && onSwapSelect && onSwapSelect(dayIndex, mealType)}
        className={`rounded-2xl ${!isFirstSection ? 'border-t border-dashed border-slate-200 pt-2.5' : ''} ${isSwapMode ? 'cursor-pointer p-2 transition-all' : ''} ${isSelected ? 'bg-emerald-50 ring-2 ring-emerald-500 shadow-sm' : ''} ${isSwapTarget ? 'hover:bg-slate-50 hover:ring-2 hover:ring-indigo-200' : ''}`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${surface} ${accent}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
              {isSwapMode && isSelected && (
                <p className="text-[11px] font-semibold text-emerald-600">Selected for swap</p>
              )}
            </div>
          </div>

          {!isSwapMode && !isEditing && hasMeal && (
            <div className="relative flex items-center gap-1" ref={openMenuMealType === mealType ? menuRef : undefined}>
              {onOpenRecipe && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenRecipe(mealContent);
                  }}
                  className="touch-target inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:text-indigo-600"
                  title="Open recipe"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span>Recipe</span>
                </button>
              )}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuMealType((current) => current === mealType ? null : mealType);
                }}
                className="touch-target inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
                aria-label={`${label} options`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>More</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenuMealType === mealType ? 'rotate-180' : ''}`} />
              </button>

              {openMenuMealType === mealType && (
                <div
                  className="absolute right-0 top-full z-30 mt-2 min-w-[188px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_20px_48px_-24px_rgba(15,23,42,0.45)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  {onSwapSelect && (
                    <MenuAction
                      icon={Shuffle}
                      label="Swap meal"
                      helper="Choose saved, recent, or AI ideas"
                      onClick={() => {
                        onSwapSelect(dayIndex, mealType);
                        setOpenMenuMealType(null);
                      }}
                    />
                  )}
                  <MenuAction
                    icon={canRegen ? RefreshCw : Lock}
                    label={canRegen ? 'Regenerate meal' : 'Upgrade to regenerate'}
                    helper="Refresh only this meal slot"
                    onClick={() => {
                      handleGatedAction('single_regen', () => onRegenerate(dayIndex, mealType));
                      setOpenMenuMealType(null);
                    }}
                    disabled={isLoading}
                  />
                  {onMealUpdate && (
                    <MenuAction
                      icon={Pencil}
                      label="Edit meal text"
                      helper="Manually update this meal"
                      onClick={() => {
                        startEditing(mealType);
                        setOpenMenuMealType(null);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {(isEditing || (!hasMeal && !isSwapMode)) ? (
          <input
            type="text"
            value={editValues[mealType]}
            onChange={(event) => setEditValues((previous) => ({ ...previous, [mealType]: event.target.value }))}
            onClick={(event) => {
              event.stopPropagation();
              if (!isEditing) {
                startEditing(mealType);
              }
            }}
            autoFocus={isEditing && (editingTarget === mealType || (editingTarget === null && visibleMeals[0] === mealType))}
            placeholder={PLACEHOLDERS[mealType][dayIndex % 7]}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition-all focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        ) : (
          <div
            className={`w-full rounded-2xl px-1 text-left transition ${isSwapMode && !isSelected ? 'opacity-70' : ''}`}
          >
            <MealList content={mealContent} showQuantities={showQuantities} bulletColorClass="text-slate-300" />
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <FeatureGateModal
        isOpen={gatedFeature !== null}
        onClose={() => setGatedFeature(null)}
        feature={gatedFeature || 'single_regen'}
        onUpgrade={onUpgrade}
      />

      <div
        className={`relative overflow-hidden rounded-[24px] border bg-white shadow-[0_16px_32px_-28px_rgba(15,23,42,0.28)] transition-all ${isEmpty ? 'border-dashed border-slate-200' : 'border-slate-200'} ${isSwapMode ? 'ring-1 ring-indigo-200' : ''} ${isSelectedDay ? 'border-orange-200 ring-1 ring-orange-100' : ''} ${isFamilyModeActive ? 'border-l-4 border-l-purple-500' : ''}`}
        data-tour={dayIndex === 0 ? 'meal-card' : undefined}
      >
        <div className="border-b border-slate-100 bg-white px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[17px] font-semibold text-slate-900">{dateLabel || dayPlan.day}</h3>
                {isInFamily && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                    <Users className="h-3 w-3" />
                    Shared
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {isSelectedDay ? 'Current week focus' : 'Planned meals'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={saveEdits}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {!isMobile && !isEmpty && (
                    <>
                      {onMealUpdate && (
                        <button
                          type="button"
                          onClick={() => startEditing(null)}
                          className="touch-target rounded-full border border-slate-200 bg-white p-2 text-slate-400 hover:border-slate-300 hover:text-orange-600"
                          title="Edit meals"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  {!isEmpty && (
                    <button
                      type="button"
                      onClick={() => handleGatedAction('smart_edit', () => onSmartEdit(dayPlan, dayIndex))}
                      data-tour={dayIndex === 0 ? 'smart-edit' : undefined}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${canSmartEdit ? 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {canSmartEdit ? <MessageSquarePlus className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {canSmartEdit ? 'Edit with AI' : 'Upgrade'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 bg-white px-4 py-3">
          {visibleMeals.map((mealType, index) => renderMealSection(mealType, index === 0))}
        </div>

        {prepContent.length > 0 && (
          <div className="border-t border-slate-100 px-4 pb-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Bell className="h-3.5 w-3.5" />
                Prep ahead
              </div>
              <div className="space-y-1.5 text-xs text-amber-900">
                {prepContent.map((prepItem, index) => (
                  <div key={`${prepItem}-${index}`} className="flex items-start gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span>{prepItem}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MealCard;

function MenuAction({
  icon: Icon,
  label,
  helper,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  helper: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      <span className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{helper}</span>
      </span>
    </button>
  );
}
