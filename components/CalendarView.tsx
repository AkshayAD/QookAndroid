import React, { useState, useRef, useEffect } from 'react';
import { Schedule, MealTransfer } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Sun, Moon, CloudSun, ArrowRightLeft, ShoppingCart, Loader2, X, CheckSquare, Pencil, Check, AlertCircle, RotateCcw, ClipboardList, Share2 } from 'lucide-react';
import MealList from './MealList';
import { useFamily } from '../contexts/FamilyContext';

interface Props {
    schedule: Schedule;
    onInitiateTransfer: (transfer: MealTransfer) => void;
    onGenerateGroceryFromWeek?: (meals: { date: string; breakfast: string; lunch: string; dinner: string }[]) => Promise<void>;
    groceryLoading?: boolean;
    onMealUpdate?: (dateKey: string, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => void;
    onRevert?: () => void;
    canRevert?: boolean;
    onLoadWeek?: (date: Date) => void;
    onShareMeals?: (schedule: Schedule, dateRange?: string) => void;
}

const CalendarView: React.FC<Props> = ({ schedule, onInitiateTransfer, onGenerateGroceryFromWeek, groceryLoading, onMealUpdate, onRevert, canRevert, onLoadWeek, onShareMeals }) => {
    // Family context for styling
    const { isFamilyModeActive } = useFamily();

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [editingMeal, setEditingMeal] = useState<{ type: 'breakfast' | 'lunch' | 'dinner'; value: string } | null>(null);
    const todayRef = useRef<HTMLButtonElement>(null);
    const dateScrollRef = useRef<HTMLDivElement>(null);
    // Scroll to today when the date strip becomes visible
    const scrollToToday = React.useCallback(() => {
        if (todayRef.current && dateScrollRef.current) {
            const container = dateScrollRef.current;
            const todayButton = todayRef.current;
            const scrollLeft = todayButton.offsetLeft - (container.clientWidth / 2) + (todayButton.offsetWidth / 2);
            container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    }, []);

    // Use IntersectionObserver to trigger scroll when container becomes visible
    useEffect(() => {
        const container = dateScrollRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Small delay to ensure layout is stable
                        setTimeout(scrollToToday, 100);
                        setTimeout(scrollToToday, 300);
                    }
                });
            },
            { threshold: 0.1 }
        );

        observer.observe(container);

        // Also try immediately in case already visible
        setTimeout(scrollToToday, 200);

        return () => observer.disconnect();
    }, [scrollToToday, currentMonth]);

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    });

    const getDayPlan = (date: Date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return schedule[dateKey];
    };

    const handleDayClick = (date: Date, e: React.MouseEvent) => {
        const dateKey = format(date, 'yyyy-MM-dd');

        if (isMultiSelectMode || e.ctrlKey || e.metaKey) {
            const newSelected = new Set(selectedDates);
            if (newSelected.has(dateKey)) {
                newSelected.delete(dateKey);
            } else {
                newSelected.add(dateKey);
            }
            setSelectedDates(newSelected);
            setIsMultiSelectMode(true);
        } else {
            setSelectedDate(date);
            setSelectedDates(new Set());
            setIsMultiSelectMode(false);
            setEditingMeal(null);
        }
    };

    const clearMultiSelect = () => {
        setSelectedDates(new Set());
        setIsMultiSelectMode(false);
    };

    const selectThisWeek = () => {
        const weekStart = startOfWeek(selectedDate || new Date(), { weekStartsOn: 1 });
        const newSelected = new Set<string>();
        for (let i = 0; i < 7; i++) {
            newSelected.add(format(addDays(weekStart, i), 'yyyy-MM-dd'));
        }
        setSelectedDates(newSelected);
        setIsMultiSelectMode(true);
    };

    const handleMultiSelectGrocery = () => {
        if (!onGenerateGroceryFromWeek || selectedDates.size === 0) return;

        const meals: { date: string; breakfast: string; lunch: string; dinner: string }[] = [];
        const sortedDates = Array.from(selectedDates).sort();

        // Track which days have meals and which don't
        const daysWithMeals: string[] = [];
        const daysWithoutMeals: string[] = [];

        sortedDates.forEach((dateKey: string) => {
            const plan = schedule[dateKey];
            const hasMeal = plan?.breakfast || plan?.lunch || plan?.dinner;

            if (hasMeal) {
                daysWithMeals.push(format(new Date(dateKey), 'MMM d'));
            } else {
                daysWithoutMeals.push(format(new Date(dateKey), 'MMM d'));
            }

            meals.push({
                date: dateKey,
                breakfast: plan?.breakfast || '',
                lunch: plan?.lunch || '',
                dinner: plan?.dinner || ''
            });
        });

        // Check if no days have meals
        if (daysWithMeals.length === 0) {
            alert('None of the selected days have meals planned. Please add meals to the schedule first.');
            return;
        }

        // Warn about days without meals but proceed
        if (daysWithoutMeals.length > 0) {
            const proceed = window.confirm(
                `Note: ${daysWithoutMeals.length} day(s) have no meals scheduled (${daysWithoutMeals.slice(0, 3).join(', ')}${daysWithoutMeals.length > 3 ? '...' : ''}).\n\nGenerate grocery list for the ${daysWithMeals.length} day(s) with meals?`
            );
            if (!proceed) return;
        }

        onGenerateGroceryFromWeek(meals.filter(m => m.breakfast || m.lunch || m.dinner));
    };

    const handleGenerateWeekGrocery = () => {
        if (!selectedDate || !onGenerateGroceryFromWeek) return;

        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekDays: { date: string; breakfast: string; lunch: string; dinner: string }[] = [];

        for (let i = 0; i < 7; i++) {
            const day = addDays(weekStart, i);
            const dateKey = format(day, 'yyyy-MM-dd');
            const plan = schedule[dateKey];
            weekDays.push({
                date: dateKey,
                breakfast: plan?.breakfast || '',
                lunch: plan?.lunch || '',
                dinner: plan?.dinner || ''
            });
        }

        const hasMeals = weekDays.some(d => d.breakfast || d.lunch || d.dinner);
        if (!hasMeals) {
            alert('No meals scheduled for this week. Please add meals first.');
            return;
        }

        onGenerateGroceryFromWeek(weekDays);
    };

    // Inline editing handlers
    const startEditing = (type: 'breakfast' | 'lunch' | 'dinner', currentValue: string) => {
        setEditingMeal({ type, value: currentValue || '' });
    };

    const saveEdit = () => {
        if (!editingMeal || !selectedDate || !onMealUpdate) return;
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        onMealUpdate(dateKey, editingMeal.type, editingMeal.value);
        setEditingMeal(null);
    };

    const cancelEdit = () => {
        setEditingMeal(null);
    };

    const selectedPlan = selectedDate && !isMultiSelectMode ? getDayPlan(selectedDate) : null;

    const getWeekRange = () => {
        if (!selectedDate) return '';
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    };

    return (
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-6 lg:h-full small-screen-zoom">
            <style jsx global>{`
                @media (max-width: 350px) {
                    .small-screen-zoom {
                        zoom: 0.85;
                    }
                }
            `}</style>
            {/* Calendar Grid */}
            <div className="lg:col-span-2 bg-white sm:rounded-2xl sm:shadow-sm sm:border sm:border-gray-200 overflow-hidden flex flex-col">
                <div className="p-1.5 sm:p-4 flex justify-between items-center border-b flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base sm:text-lg text-gray-800">{format(currentMonth, 'MMM yyyy')}</h2>
                        {isMultiSelectMode && (
                            <span className="hidden sm:inline px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                {selectedDates.size} days selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {canRevert && onRevert && (
                            <button
                                onClick={onRevert}
                                className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1 font-medium"
                                title="Revert to previous schedule"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Undo
                            </button>
                        )}
                        {isMultiSelectMode && (
                            <button
                                onClick={clearMultiSelect}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                title="Exit multi-select"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Multi-select controls - Compact on mobile */}
                <div className="flex px-2 sm:px-4 py-1 sm:py-2 bg-gray-50 border-b text-xs text-gray-500 items-center justify-between gap-1 sm:gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                            className={`p-2 sm:px-3 sm:py-2 text-xs rounded-lg sm:rounded-full font-medium transition-colors flex items-center gap-1 ${isMultiSelectMode
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            title={isMultiSelectMode ? 'Multi-Select ON' : 'Multi-Select'}
                        >
                            <CheckSquare className="w-4 h-4" />
                            <span className="hidden sm:inline">{isMultiSelectMode ? 'Multi-Select ON' : 'Multi-Select'}</span>
                        </button>
                        <span className="hidden sm:inline text-gray-400">or Ctrl/Cmd + Click</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button
                            onClick={selectThisWeek}
                            className="p-2 sm:px-3 sm:py-2 text-xs bg-indigo-100 text-indigo-700 rounded-lg sm:rounded-full hover:bg-indigo-200 transition-colors font-medium"
                            title="Select This Week"
                        >
                            <span className="hidden sm:inline">Select This Week</span>
                            <span className="sm:hidden text-[10px]">Week</span>
                        </button>
                        {onShareMeals && (
                            <button
                                onClick={() => {
                                    // Determine which dates to share
                                    let datesToShare: Set<string>;
                                    let dateRangeLabel: string;

                                    if (isMultiSelectMode && selectedDates.size > 0) {
                                        // Multi-select: share only selected dates
                                        datesToShare = selectedDates;
                                        const sortedDates = Array.from(selectedDates).sort();
                                        dateRangeLabel = sortedDates.length === 1
                                            ? format(new Date(sortedDates[0]), 'MMM d, yyyy')
                                            : `${format(new Date(sortedDates[0]), 'MMM d')} - ${format(new Date(sortedDates[sortedDates.length - 1]), 'MMM d, yyyy')}`;
                                    } else if (selectedDate) {
                                        // Single selection: share only that date
                                        datesToShare = new Set([format(selectedDate, 'yyyy-MM-dd')]);
                                        dateRangeLabel = format(selectedDate, 'EEEE, MMM d, yyyy');
                                    } else {
                                        // No selection: prompt user
                                        alert('Please select at least one date to share.');
                                        return;
                                    }

                                    // Filter schedule to only include selected dates
                                    const filteredSchedule: Schedule = {};
                                    datesToShare.forEach(dateKey => {
                                        if (schedule[dateKey]) {
                                            filteredSchedule[dateKey] = schedule[dateKey];
                                        }
                                    });

                                    onShareMeals(filteredSchedule, dateRangeLabel);
                                }}
                                disabled={!selectedDate && selectedDates.size === 0}
                                className={`p-2 sm:px-3 sm:py-2 text-xs rounded-lg sm:rounded-full transition-colors font-medium flex items-center gap-1 ${(selectedDate || selectedDates.size > 0)
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                                title="Share"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Share {isMultiSelectMode && selectedDates.size > 0 ? `(${selectedDates.size} days)` : ''}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Horizontal Date Bar - Scrollable, always visible with minimum height */}
                <div ref={dateScrollRef} className="sm:hidden overflow-x-auto border-b bg-white flex-shrink-0 min-h-[75px]">
                    <div className="flex gap-0.5 p-1.5 min-w-max">
                        {days.map((day) => {
                            const plan = getDayPlan(day);
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const hasBreakfast = plan?.breakfast && plan.breakfast.trim() !== '';
                            const hasLunch = plan?.lunch && plan.lunch.trim() !== '';
                            const hasDinner = plan?.dinner && plan.dinner.trim() !== '';

                            const isSingleSelected = selectedDate && isSameDay(day, selectedDate) && !isMultiSelectMode;
                            const isMultiSelected = selectedDates.has(dateKey);
                            const isCurrent = isToday(day);

                            return (
                                <button
                                    key={dateKey}
                                    ref={isCurrent ? todayRef : undefined}
                                    onClick={(e) => handleDayClick(day, e)}
                                    className={`flex flex-col items-center p-1.5 rounded-lg min-w-[44px] transition-all ${isSingleSelected || isMultiSelected
                                        ? 'bg-indigo-600 text-white'
                                        : isCurrent
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <span className="text-[10px] font-medium opacity-60">
                                        {format(day, 'EEE')}
                                    </span>
                                    <span className={`text-lg font-bold ${isSingleSelected || isMultiSelected ? 'text-white' : ''}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {/* Meal indicator dots - purple in family mode */}
                                    <div className="flex gap-0.5 mt-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${hasBreakfast
                                            ? isSingleSelected || isMultiSelected ? 'bg-white' : isFamilyModeActive ? 'bg-purple-400' : 'bg-amber-400'
                                            : 'bg-gray-300'
                                            }`} title="Breakfast" />
                                        <span className={`w-1.5 h-1.5 rounded-full ${hasLunch
                                            ? isSingleSelected || isMultiSelected ? 'bg-white' : isFamilyModeActive ? 'bg-purple-500' : 'bg-orange-400'
                                            : 'bg-gray-300'
                                            }`} title="Lunch" />
                                        <span className={`w-1.5 h-1.5 rounded-full ${hasDinner
                                            ? isSingleSelected || isMultiSelected ? 'bg-white' : isFamilyModeActive ? 'bg-purple-600' : 'bg-indigo-400'
                                            : 'bg-gray-300'
                                            }`} title="Dinner" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Desktop Grid - Hidden on mobile */}
                <div className="hidden sm:grid grid-cols-7 text-center py-2 bg-gray-50 border-b text-xs sm:text-sm font-semibold text-gray-500">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                </div>

                {/* Desktop Calendar Grid - Hidden on mobile */}
                <div className="hidden sm:grid grid-cols-7 flex-1 auto-rows-fr">
                    {/* Add empty cells for days before the first of month */}
                    {(() => {
                        const firstDay = startOfMonth(currentMonth);
                        const dayOfWeek = firstDay.getDay();
                        const emptyCells = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                        return Array(emptyCells).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border-b border-r border-gray-100 bg-gray-50/50"></div>
                        ));
                    })()}
                    {days.map((day) => {
                        const plan = getDayPlan(day);
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const hasBreakfast = plan?.breakfast && plan.breakfast.trim() !== '';
                        const hasLunch = plan?.lunch && plan.lunch.trim() !== '';
                        const hasDinner = plan?.dinner && plan.dinner.trim() !== '';

                        const isSingleSelected = selectedDate && isSameDay(day, selectedDate) && !isMultiSelectMode;
                        const isMultiSelected = selectedDates.has(dateKey);
                        const isCurrent = isToday(day);

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={(e) => handleDayClick(day, e)}
                                className={`min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border-b border-r border-gray-100 flex flex-col items-start gap-0.5 sm:gap-1 transition-colors hover:bg-gray-50 relative ${isSingleSelected ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-500 z-10' : ''
                                    } ${isMultiSelected ? 'bg-green-50 ring-inset ring-2 ring-green-500' : ''}`}
                            >
                                {isMultiSelected && (
                                    <div className="absolute top-1 right-1">
                                        <CheckSquare className="w-3 h-3 text-green-600" />
                                    </div>
                                )}
                                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isCurrent ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                                    {format(day, 'd')}
                                </span>

                                {/* Meal dots - purple in family mode */}
                                <div className="flex flex-wrap gap-1 mt-auto w-full">
                                    {hasBreakfast && (
                                        <div className={`h-2 w-2 rounded-full ${isFamilyModeActive ? 'bg-purple-400' : 'bg-amber-400'}`} title={`Breakfast: ${plan.breakfast}`} />
                                    )}
                                    {hasLunch && (
                                        <div className={`h-2 w-2 rounded-full ${isFamilyModeActive ? 'bg-purple-500' : 'bg-orange-500'}`} title={`Lunch: ${plan.lunch}`} />
                                    )}
                                    {hasDinner && (
                                        <div className={`h-2 w-2 rounded-full ${isFamilyModeActive ? 'bg-purple-600' : 'bg-indigo-600'}`} title={`Dinner: ${plan.dinner}`} />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Legend - Desktop only - purple in family mode */}
                <div className="hidden sm:flex p-3 bg-gray-50 border-t gap-4 text-xs text-gray-500 justify-center">
                    <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${isFamilyModeActive ? 'bg-purple-400' : 'bg-amber-400'}`} /> Breakfast</div>
                    <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${isFamilyModeActive ? 'bg-purple-500' : 'bg-orange-500'}`} /> Lunch</div>
                    <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${isFamilyModeActive ? 'bg-purple-600' : 'bg-indigo-600'}`} /> Dinner</div>
                </div>
            </div>

            {/* Day Detail Sidebar - Inline on mobile, sidebar on desktop */}
            <div className={`lg:col-span-1 bg-white sm:rounded-2xl sm:shadow-sm sm:border sm:border-gray-200 flex flex-col max-h-[60vh] lg:max-h-none overflow-y-auto ${!selectedDate && !isMultiSelectMode ? 'hidden lg:flex' : ''}`}>
                {isMultiSelectMode ? (
                    // Multi-select mode sidebar
                    <>
                        <div className="p-4 border-b bg-green-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-green-600" />
                                {selectedDates.size} Days Selected
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                {Array.from(selectedDates).sort().slice(0, 3).map((d: string) => format(new Date(d), 'MMM d')).join(', ')}
                                {selectedDates.size > 3 && ` +${selectedDates.size - 3} more`}
                            </p>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            <div className="text-center py-8">
                                <ShoppingCart className="w-12 h-12 text-green-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-600 mb-2">Ready to generate grocery list for selected days?</p>
                                <p className="text-xs text-gray-400">Days without meals will be skipped</p>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 space-y-2">
                            <button
                                onClick={handleMultiSelectGrocery}
                                disabled={groceryLoading || selectedDates.size === 0}
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
                                        Generate Grocery List ({selectedDates.size} days)
                                    </>
                                )}
                            </button>
                            <button
                                onClick={clearMultiSelect}
                                className="w-full px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel Selection
                            </button>
                        </div>
                    </>
                ) : (
                    // Single select mode sidebar
                    <>
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a Day'}
                                </h3>
                                {/* Week range hidden - user preference */}
                            </div>
                            {selectedDate && onLoadWeek && (
                                <button
                                    onClick={() => onLoadWeek(selectedDate)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 hover:border-indigo-300 text-xs font-medium"
                                    title="Open this week in the Weekly Planner tab"
                                    aria-label="Open this week in Planner"
                                >
                                    <ClipboardList className="w-4 h-4" />
                                    <span>Open next 7 days in planner</span>
                                </button>
                            )}
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            {!selectedDate ? (
                                <p className="text-gray-400 text-sm text-center mt-10">Tap a date to view meals</p>
                            ) : (
                                <>
                                    {(['breakfast', 'lunch', 'dinner'] as const).map(type => {
                                        const meal = selectedPlan?.[type] || '';
                                        const Icon = type === 'breakfast' ? Sun : type === 'lunch' ? CloudSun : Moon;
                                        const colorClass = type === 'breakfast' ? 'text-amber-600' : type === 'lunch' ? 'text-orange-600' : 'text-indigo-600';
                                        const label = type.charAt(0).toUpperCase() + type.slice(1);
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
                                                                onClick={() => startEditing(type, meal)}
                                                                className="text-gray-300 hover:text-green-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Edit meal"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {meal && (
                                                            <button
                                                                onClick={() => onInitiateTransfer({
                                                                    sourceDate: format(selectedDate!, 'yyyy-MM-dd'),
                                                                    sourceMealType: label as 'Breakfast' | 'Lunch' | 'Dinner',
                                                                    sourceMealName: meal
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
                                                            onChange={(e) => setEditingMeal({ ...editingMeal, value: e.target.value })}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                            autoFocus
                                                            placeholder={`Enter ${label.toLowerCase()}...`}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEdit();
                                                                if (e.key === 'Escape') cancelEdit();
                                                            }}
                                                        />
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={saveEdit}
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
                                    })}
                                </>
                            )}
                        </div>

                        {/* Generate Grocery List Button */}
                        {selectedDate && onGenerateGroceryFromWeek && (
                            <div className="p-4 border-t bg-gray-50">
                                <button
                                    onClick={handleGenerateWeekGrocery}
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
                )}
            </div>
        </div >
    );
};

export default CalendarView;