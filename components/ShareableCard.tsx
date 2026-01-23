import React from 'react';
import { ChefHat } from 'lucide-react';
import { WeeklyPlan, GroceryItem, DayPlan, PrepAhead } from '../types';
import MealList from './MealList';

interface ShareableCardProps {
    type: 'plan' | 'grocery';
    data: WeeklyPlan | GroceryItem[];
    dateRange: string;
    id?: string;
    forCapture?: boolean;
    language?: 'en' | 'hi';
}

const TRANSLATIONS = {
    en: {
        brandName: 'QookCommander',
        mealPlan: 'Weekly Meal Plan',
        groceryList: 'Grocery Shopping List',
        dates: 'Dates',
        breakfast: 'Breakfast',
        lunch: 'Lunch',
        dinner: 'Dinner',
        footer: 'Made with ❤️ by QookCommander',
        website: 'qook.in'
    },
    hi: {
        brandName: 'QookCommander',
        mealPlan: 'साप्ताहिक भोजन योजना',
        groceryList: 'किराने की सूची',
        dates: 'तारीख',
        breakfast: 'नाश्ता',
        lunch: 'दोपहर',
        dinner: 'रात',
        footer: '❤️ के साथ QookCommander द्वारा',
        website: 'qook.in'
    }
};

const ShareableCard: React.FC<ShareableCardProps> = ({
    type,
    data,
    dateRange,
    id = 'share-card',
    forCapture = false,
    language = 'en'
}) => {
    const t = TRANSLATIONS[language];

    const containerClasses = forCapture
        ? "bg-white p-6 rounded-none w-[500px] text-gray-800 font-sans"
        : "bg-white p-4 sm:p-6 rounded-none w-full max-w-[500px] text-gray-800 font-sans";

    const headerTitleClasses = forCapture
        ? "text-xl font-bold text-gray-900 leading-tight"
        : "text-lg sm:text-xl font-bold text-gray-900 leading-tight";

    const dateRangeClasses = forCapture
        ? "block text-lg font-bold text-gray-800"
        : "block text-base sm:text-lg font-bold text-gray-800";

    return (
        <div
            id={id}
            className={containerClasses}
            style={{
                background: 'linear-gradient(to bottom, #ffffff 0%, #fff7ed 100%)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-orange-200 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <img
                        src={`${import.meta.env.BASE_URL}Site header logo.png`}
                        alt="Q"
                        className={forCapture ? "w-10 h-10 object-contain" : "w-8 h-8 sm:w-10 sm:h-10 object-contain"}
                    />
                    <div>
                        <h1 className={headerTitleClasses}>{t.brandName}</h1>
                        <p className="text-[10px] sm:text-xs text-orange-600 font-medium tracking-wide uppercase">
                            {type === 'plan' ? t.mealPlan : t.groceryList}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-xs sm:text-sm font-semibold text-gray-500">{t.dates}</span>
                    <span className={dateRangeClasses}>{dateRange}</span>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3 sm:space-y-4">
                {type === 'plan' ? (
                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                        {(data as WeeklyPlan).days.map((day, idx) => (
                            <div key={idx} className="bg-white/80 border border-orange-100 rounded-lg p-2.5 sm:p-3 shadow-sm">
                                <h3 className="text-xs sm:text-sm font-bold text-orange-800 mb-1.5 sm:mb-2 uppercase border-b border-orange-50 pb-1">
                                    {day.day}
                                </h3>
                                <div className="space-y-1 sm:space-y-1.5">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 w-14 sm:w-16 uppercase shrink-0">{t.breakfast}</span>
                                        <div className="text-xs sm:text-sm text-gray-700 flex-1 break-words">
                                            {day.breakfast ? <MealList content={day.breakfast} textSizeClass="text-xs sm:text-sm" /> : '-'}
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 w-14 sm:w-16 uppercase shrink-0">{t.lunch}</span>
                                        <div className="text-xs sm:text-sm text-gray-700 flex-1 break-words">
                                            {day.lunch ? <MealList content={day.lunch} textSizeClass="text-xs sm:text-sm" /> : '-'}
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 w-14 sm:w-16 uppercase shrink-0">{t.dinner}</span>
                                        <div className="text-xs sm:text-sm text-gray-700 flex-1 break-words">
                                            {day.dinner ? <MealList content={day.dinner} textSizeClass="text-xs sm:text-sm" /> : '-'}
                                        </div>
                                    </div>
                                    {/* Prep Ahead Section - Skip for last day since next day is not planned */}
                                    {idx < (data as WeeklyPlan).days.length - 1 && day.prepAhead && (day.prepAhead.forBreakfast || day.prepAhead.forLunch || day.prepAhead.forDinner) && (
                                        <div className="mt-2 pt-2 border-t border-amber-100 bg-amber-50/50 rounded p-2">
                                            <span className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase block mb-1">🔔 Prep Tonight</span>
                                            <div className="space-y-0.5 text-[10px] sm:text-xs text-amber-800">
                                                {day.prepAhead.forBreakfast && (
                                                    <p>☀️ {day.prepAhead.forBreakfast}</p>
                                                )}
                                                {day.prepAhead.forLunch && (
                                                    <p>🍽️ {day.prepAhead.forLunch}</p>
                                                )}
                                                {day.prepAhead.forDinner && (
                                                    <p>🌙 {day.prepAhead.forDinner}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={forCapture ? "columns-2 gap-4 space-y-4" : "columns-1 sm:columns-2 gap-3 sm:gap-4 space-y-3 sm:space-y-4"}>
                        {Array.from(new Set((data as GroceryItem[]).map((i) => i.category))).map((cat) => (
                            <div key={cat} className="break-inside-avoid bg-white/60 rounded-lg p-2.5 sm:p-3 border border-orange-100">
                                <h3 className="text-[10px] sm:text-xs font-bold text-orange-800 uppercase mb-1.5 sm:mb-2 border-b border-orange-100 pb-1">
                                    {cat || 'Other'}
                                </h3>
                                <ul className="space-y-0.5 sm:space-y-1">
                                    {(data as GroceryItem[])
                                        .filter((i) => i.category === cat)
                                        .map((item, i) => (
                                            <li key={i} className="text-xs sm:text-sm text-gray-700 flex justify-between items-start gap-2">
                                                <span className="break-words flex-1">{item.item}</span>
                                                <span className="text-gray-400 text-[10px] sm:text-xs whitespace-nowrap shrink-0">{item.quantity}</span>
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-orange-100 flex justify-between items-center text-[10px] sm:text-xs text-gray-400">
                <span>{t.footer}</span>
                <span>{t.website}</span>
            </div>
        </div>
    );
};

export default ShareableCard;

