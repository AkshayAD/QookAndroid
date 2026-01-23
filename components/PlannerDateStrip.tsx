import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format, addDays, isSameDay, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    schedule?: Record<string, { breakfast?: string; lunch?: string; dinner?: string }>;
}

/**
 * Scrollable horizontal date picker for Planner view
 * - Shows dates from current month
 * - Auto-scrolls to today/selected date
 * - Clicking a date updates which 7 days are shown
 */
const PlannerDateStrip: React.FC<Props> = ({ selectedDate, onDateSelect, schedule = {} }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const selectedDateRef = useRef<HTMLButtonElement>(null);
    const firstDayRef = useRef<HTMLButtonElement>(null);

    // Get all days of current month
    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    });

    // Scroll to selected date
    const scrollToDate = useCallback(() => {
        if (selectedDateRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const dateButton = selectedDateRef.current;
            const scrollLeft = dateButton.offsetLeft - (container.clientWidth / 2) + (dateButton.offsetWidth / 2);
            container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    }, []);

    // Scroll when component mounts or selected date changes
    useEffect(() => {
        const timer = setTimeout(scrollToDate, 100);
        return () => clearTimeout(timer);
    }, [scrollToDate, selectedDate, currentMonth]);

    // Check if date is within selected 7-day range
    const isInSelectedRange = (date: Date) => {
        for (let i = 0; i < 7; i++) {
            if (isSameDay(addDays(selectedDate, i), date)) return true;
        }
        return false;
    };

    // Get meal indicators for a date
    const getMealIndicators = (date: Date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const plan = schedule[dateKey];

        // Non-veg keywords detection
        const nonVegKeywords = ['chicken', 'mutton', 'fish', 'egg', 'meat', 'lamb', 'beef', 'pork', 'prawns', 'shrimp', 'crab', 'lobster', 'turkey', 'duck', 'bacon', 'sausage', 'keema', 'murg', 'murgh', 'gosht', 'machhli', 'jhinga', 'anda'];
        const checkNonVeg = (meal: string | undefined) => {
            if (!meal) return false;
            const lowerMeal = meal.toLowerCase();
            return nonVegKeywords.some(keyword => lowerMeal.includes(keyword));
        };

        const hasNonVeg = checkNonVeg(plan?.breakfast) || checkNonVeg(plan?.lunch) || checkNonVeg(plan?.dinner);
        const hasMeals = !!plan?.breakfast?.trim() || !!plan?.lunch?.trim() || !!plan?.dinner?.trim();

        return {
            hasBreakfast: !!plan?.breakfast?.trim(),
            hasLunch: !!plan?.lunch?.trim(),
            hasDinner: !!plan?.dinner?.trim(),
            hasNonVeg,
            hasMeals,
        };
    };

    return (
        <div className="bg-white border-b border-gray-200">
            {/* Compact Scrollable Date Strip with Inline Month Navigation */}
            <div
                ref={scrollContainerRef}
                className="overflow-x-auto scrollbar-hide"
            >
                <div className="flex items-center gap-1 px-2 py-1.5 min-w-max">
                    {/* Month Navigation - Inline */}
                    <button
                        onClick={() => {
                            setCurrentMonth(subMonths(currentMonth, 1));
                            // Smooth scroll to first of previous month
                            setTimeout(() => {
                                if (firstDayRef.current && scrollContainerRef.current) {
                                    const container = scrollContainerRef.current;
                                    const firstDay = firstDayRef.current;
                                    container.scrollTo({ left: firstDay.offsetLeft - 50, behavior: 'smooth' });
                                }
                            }, 100);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-xs font-bold text-gray-700 px-1 whitespace-nowrap">
                        {format(currentMonth, 'MMM yy')}
                    </span>
                    <button
                        onClick={() => {
                            setCurrentMonth(addMonths(currentMonth, 1));
                            // Smooth scroll to first of next month
                            setTimeout(() => {
                                if (firstDayRef.current && scrollContainerRef.current) {
                                    const container = scrollContainerRef.current;
                                    const firstDay = firstDayRef.current;
                                    container.scrollTo({ left: firstDay.offsetLeft - 50, behavior: 'smooth' });
                                }
                            }, 100);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 mr-1"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Date Pills - Compact */}
                    {days.map((day, index) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentDay = isToday(day);
                        const isInRange = isInSelectedRange(day);
                        const isFirstDay = index === 0;
                        const { hasBreakfast, hasLunch, hasDinner, hasNonVeg, hasMeals } = getMealIndicators(day);

                        return (
                            <button
                                key={format(day, 'yyyy-MM-dd')}
                                ref={isSelected ? selectedDateRef : isFirstDay ? firstDayRef : undefined}
                                onClick={() => onDateSelect(day)}
                                className={`flex flex-col items-center px-2 py-1 rounded-lg min-w-[40px] transition-all relative ${
                                    // Background colors based on selection state
                                    isSelected
                                        ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-500 ring-offset-1'
                                        : isInRange
                                            ? 'bg-orange-100 text-orange-700'
                                            : isCurrentDay
                                                ? 'bg-indigo-100 text-indigo-700'
                                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    } ${
                                    // Orange ring for days with meals (applied independently of above)
                                    hasMeals && !isSelected ? 'ring-2 ring-orange-400' : ''
                                    } ${
                                    // Blue ring for today (only if not selected and no meals)
                                    isCurrentDay && !isSelected && !hasMeals ? 'ring-1 ring-indigo-300' : ''
                                    }`}
                            >
                                {/* Non-veg indicator - chicken emoji */}
                                {hasNonVeg && (
                                    <span
                                        className="absolute -top-1 -right-1 text-[10px]"
                                        title="Non-veg meal"
                                    >🍗</span>
                                )}
                                <span className={`text-[9px] font-medium ${isSelected ? 'text-orange-100' : isInRange ? 'text-orange-500' : 'text-gray-500'}`}>
                                    {format(day, 'EEE')}
                                </span>
                                <span className={`text-sm font-bold ${isSelected ? 'text-white' : ''}`}>
                                    {format(day, 'd')}
                                </span>
                                {/* Meal indicators - emoji icons */}
                                <div className="flex gap-0.5 mt-0.5">
                                    <span className={`text-[10px] ${hasBreakfast ? '' : 'opacity-30 grayscale'}`} title="Breakfast">☀️</span>
                                    <span className={`text-[10px] ${hasLunch ? '' : 'opacity-30 grayscale'}`} title="Lunch">🍽️</span>
                                    <span className={`text-[10px] ${hasDinner ? '' : 'opacity-30 grayscale'}`} title="Dinner">🌙</span>
                                </div>
                            </button>
                        );
                    })}

                    {/* Month Navigation - At End */}
                    <button
                        onClick={() => {
                            setCurrentMonth(addMonths(currentMonth, 1));
                            setTimeout(() => {
                                if (firstDayRef.current && scrollContainerRef.current) {
                                    const container = scrollContainerRef.current;
                                    const firstDay = firstDayRef.current;
                                    container.scrollTo({ left: firstDay.offsetLeft - 50, behavior: 'smooth' });
                                }
                            }, 100);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-1"
                        title="Next month"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-xs font-bold text-gray-700 px-1 whitespace-nowrap">
                        {format(addMonths(currentMonth, 1), 'MMM')}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PlannerDateStrip;
