import React, { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isToday, startOfMonth, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Schedule } from '../types';
import { resolvePlannerDate } from '../lib/plannerResolution';

interface Props {
    selectedDate: Date;
    rangeStartDate: Date;
    onDateSelect: (date: Date) => void;
    schedule?: Schedule;
}

const NON_VEG_KEYWORDS = ['chicken', 'mutton', 'fish', 'egg', 'meat', 'lamb', 'beef', 'pork', 'prawns', 'shrimp', 'crab', 'lobster', 'turkey', 'duck', 'bacon', 'sausage', 'keema', 'murg', 'murgh', 'gosht', 'machhli', 'jhinga', 'anda'];

function hasNonVeg(day: { breakfast?: string; lunch?: string; dinner?: string }): boolean {
    const meals = [day.breakfast, day.lunch, day.dinner].filter(Boolean).join(' ').toLowerCase();
    return NON_VEG_KEYWORDS.some((keyword) => meals.includes(keyword));
}

/**
 * Scrollable horizontal date picker for planner browsing.
 * Clicking a date requests that the planner load the visible 7-day range from that day.
 */
const PlannerDateStrip: React.FC<Props> = ({
    selectedDate,
    rangeStartDate,
    onDateSelect,
    schedule = {},
}) => {
    const [currentMonth, setCurrentMonth] = useState(selectedDate);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const selectedDateRef = useRef<HTMLButtonElement>(null);
    const firstDayRef = useRef<HTMLButtonElement>(null);

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    });

    useEffect(() => {
        if (
            selectedDate.getMonth() !== currentMonth.getMonth()
            || selectedDate.getFullYear() !== currentMonth.getFullYear()
        ) {
            setCurrentMonth(selectedDate);
        }
    }, [currentMonth, selectedDate]);

    const scrollToDate = useCallback(() => {
        if (!selectedDateRef.current || !scrollContainerRef.current) {
            return;
        }

        const container = scrollContainerRef.current;
        const dateButton = selectedDateRef.current;
        const scrollLeft = dateButton.offsetLeft - (container.clientWidth / 2) + (dateButton.offsetWidth / 2);
        const nextScrollLeft = Math.max(0, scrollLeft);

        if (typeof container.scrollTo === 'function') {
            container.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
            return;
        }

        container.scrollLeft = nextScrollLeft;
    }, []);

    useEffect(() => {
        const timer = setTimeout(scrollToDate, 100);
        return () => clearTimeout(timer);
    }, [scrollToDate, selectedDate, currentMonth]);

    const isInSelectedRange = (date: Date) => (
        Array.from({ length: 7 }, (_, index) => isSameDay(addDays(rangeStartDate, index), date)).some(Boolean)
    );

    const getMealIndicators = (date: Date) => {
        const resolution = resolvePlannerDate(schedule, date);
        const day = resolution.day;

        return {
            hasBreakfast: Boolean(day.breakfast?.trim()),
            hasLunch: Boolean(day.lunch?.trim()),
            hasDinner: Boolean(day.dinner?.trim()),
            hasMeals: resolution.hasMeals,
            hasNonVeg: hasNonVeg(day),
            source: resolution.source,
        };
    };

    return (
        <div className="overflow-hidden rounded-2xl bg-transparent">
            <div ref={scrollContainerRef} className="overflow-x-auto scrollbar-hide">
                <div className="flex min-w-max items-center gap-1 px-1 py-1">
                    <button
                        onClick={() => {
                            setCurrentMonth(subMonths(currentMonth, 1));
                            setTimeout(() => {
                                if (firstDayRef.current && scrollContainerRef.current) {
                                    const nextScrollLeft = Math.max(0, firstDayRef.current.offsetLeft - 50);
                                    if (typeof scrollContainerRef.current.scrollTo === 'function') {
                                        scrollContainerRef.current.scrollTo({
                                            left: nextScrollLeft,
                                            behavior: 'smooth',
                                        });
                                    } else {
                                        scrollContainerRef.current.scrollLeft = nextScrollLeft;
                                    }
                                }
                            }, 100);
                        }}
                        className="flex-shrink-0 rounded-full p-1 hover:bg-white transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="whitespace-nowrap px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                        {format(currentMonth, 'MMM yy')}
                    </span>
                    <button
                        onClick={() => {
                            setCurrentMonth(addMonths(currentMonth, 1));
                            setTimeout(() => {
                                if (firstDayRef.current && scrollContainerRef.current) {
                                    const nextScrollLeft = Math.max(0, firstDayRef.current.offsetLeft - 50);
                                    if (typeof scrollContainerRef.current.scrollTo === 'function') {
                                        scrollContainerRef.current.scrollTo({
                                            left: nextScrollLeft,
                                            behavior: 'smooth',
                                        });
                                    } else {
                                        scrollContainerRef.current.scrollLeft = nextScrollLeft;
                                    }
                                }
                            }, 100);
                        }}
                        className="mr-1 flex-shrink-0 rounded-full p-1 hover:bg-white transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>

                    {days.map((day, index) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentDay = isToday(day);
                        const isInRange = isInSelectedRange(day);
                        const isFirstDay = index === 0;
                        const indicators = getMealIndicators(day);

                        return (
                            <button
                                key={format(day, 'yyyy-MM-dd')}
                                ref={isSelected ? selectedDateRef : isFirstDay ? firstDayRef : undefined}
                                onClick={() => onDateSelect(day)}
                                className={`relative flex min-w-[44px] flex-col items-center rounded-xl px-2 py-1 transition-all ${
                                    isSelected
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : isInRange
                                            ? 'bg-orange-50 text-orange-700'
                                            : isCurrentDay
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'bg-white text-gray-700 hover:bg-gray-100/80'
                                } ${
                                    indicators.hasMeals && !isSelected ? 'ring-1 ring-orange-200' : ''
                                }`}
                                title={indicators.source === 'schedule' ? 'Using saved schedule' : 'No meals planned'}
                            >
                                {indicators.hasNonVeg && (
                                    <span className="absolute -top-1 -right-1 rounded-full bg-gray-900 px-1 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white">
                                        NV
                                    </span>
                                )}

                                <span className={`text-[8px] font-medium uppercase tracking-[0.08em] ${
                                    isSelected ? 'text-orange-100' : isInRange ? 'text-orange-500' : 'text-gray-500'
                                }`}>
                                    {format(day, 'EEE')}
                                </span>
                                <span className={`text-[15px] font-bold ${isSelected ? 'text-white' : ''}`}>
                                    {format(day, 'd')}
                                </span>
                                <div className="mt-0.5 flex gap-1">
                                    <span className={`h-1.5 w-1.5 rounded-full ${indicators.hasBreakfast ? (isSelected ? 'bg-white' : 'bg-amber-400') : 'bg-gray-300'}`} />
                                    <span className={`h-1.5 w-1.5 rounded-full ${indicators.hasLunch ? (isSelected ? 'bg-white' : 'bg-orange-400') : 'bg-gray-300'}`} />
                                    <span className={`h-1.5 w-1.5 rounded-full ${indicators.hasDinner ? (isSelected ? 'bg-white' : 'bg-indigo-400') : 'bg-gray-300'}`} />
                                </div>
                            </button>
                        );
                    })}

                    <button
                        onClick={() => {
                            setCurrentMonth(addMonths(currentMonth, 1));
                            setTimeout(() => {
                                if (firstDayRef.current && scrollContainerRef.current) {
                                    scrollContainerRef.current.scrollTo({
                                        left: Math.max(0, firstDayRef.current.offsetLeft - 50),
                                        behavior: 'smooth',
                                    });
                                }
                            }, 100);
                        }}
                        className="ml-1 flex-shrink-0 rounded-full p-1 hover:bg-white transition-colors"
                        title="Next month"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="whitespace-nowrap px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                        {format(addMonths(currentMonth, 1), 'MMM')}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PlannerDateStrip;
