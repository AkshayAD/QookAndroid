import React, { useState, useEffect } from 'react';
import { ChefHat, X, Plus, Search, RefreshCw, Sparkles, ChevronRight, Heart, Clock, Loader2 } from 'lucide-react';
import MealSlotPicker from './MealSlotPicker';
import { WeeklyPlan } from '../types';
import { supabase } from '../lib/supabase';

interface SavedRecipe {
    id: string;
    main_dish: string;
    thumbnail_url: string | null;
    cook_time_minutes: number | null;
    difficulty: string | null;
}

interface RecentRecipe {
    id: string;
    main_dish: string;
    thumbnail_url: string | null;
    viewed_at: string;
}

interface MealAlternativesSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    alternatives: {
        breakfast: string[];
        lunch: string[];
        dinner: string[];
    } | null;
    onSelectAlternative: (meal: string, dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
    selectedMeal: { dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner' } | null;
    onRegenerateAlternatives?: () => void;
    isLoading?: boolean;
    weeklyPlan?: WeeklyPlan | null;
}

const MEAL_TABS = ['Breakfast', 'Lunch', 'Dinner'] as const;
type MainTab = 'saved' | 'recent' | 'ai';

export default function MealAlternativesSidebar({
    isOpen,
    onClose,
    alternatives,
    onSelectAlternative,
    selectedMeal,
    onRegenerateAlternatives,
    isLoading = false,
    weeklyPlan
}: MealAlternativesSidebarProps) {
    const [mainTab, setMainTab] = useState<MainTab>('saved');
    const [mealTab, setMealTab] = useState<typeof MEAL_TABS[number]>('Lunch');
    const [slotPickerMeal, setSlotPickerMeal] = useState<string | null>(null);
    const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
    const [recentRecipes, setRecentRecipes] = useState<RecentRecipe[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(false);
    const [loadingRecent, setLoadingRecent] = useState(false);

    // Fetch saved recipes when panel opens
    useEffect(() => {
        if (isOpen && mainTab === 'saved') {
            fetchSavedRecipes();
        }
        if (isOpen && mainTab === 'recent') {
            fetchRecentRecipes();
        }
    }, [isOpen, mainTab]);

    useEffect(() => {
        if (selectedMeal) {
            const nextTab = `${selectedMeal.mealType.charAt(0).toUpperCase()}${selectedMeal.mealType.slice(1)}` as typeof MEAL_TABS[number];
            setMealTab(nextTab);
        }
    }, [selectedMeal]);

    const fetchSavedRecipes = async () => {
        setLoadingSaved(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('saved_recipes')
                .select('id, main_dish, thumbnail_url, cook_time_minutes, difficulty')
                .eq('user_id', user.id)
                .order('saved_at', { ascending: false });

            setSavedRecipes(data || []);
        } catch (err) {
            console.error('Failed to fetch saved recipes:', err);
        } finally {
            setLoadingSaved(false);
        }
    };

    const fetchRecentRecipes = async () => {
        setLoadingRecent(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('recently_viewed_recipes')
                .select('id, main_dish, thumbnail_url, viewed_at')
                .eq('user_id', user.id)
                .order('viewed_at', { ascending: false })
                .limit(15);

            setRecentRecipes(data || []);
        } catch (err) {
            console.error('Failed to fetch recent recipes:', err);
        } finally {
            setLoadingRecent(false);
        }
    };

    // Helper function for relative time display
    const getTimeAgo = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const currentAlternatives = alternatives?.[mealTab.toLowerCase() as 'breakfast' | 'lunch' | 'dinner'] || [];

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop overlay - click to close */}
            <div
                className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sidebar drawer */}
            <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out border-l border-gray-100">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-orange-500 to-red-600 text-white">
                    <div className="flex items-center gap-2">
                        <ChefHat className="w-5 h-5" />
                        <h2 className="font-bold text-lg">Quick Swaps</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {mainTab === 'ai' && onRegenerateAlternatives && (
                            <button
                                onClick={onRegenerateAlternatives}
                                disabled={isLoading}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                                title="Refresh Alternatives"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" title="Close panel">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Tabs: Saved, Recent, AI */}
                <div className="flex border-b">
                    <button
                        onClick={() => setMainTab('saved')}
                        className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${mainTab === 'saved'
                            ? 'text-red-600 bg-red-50 border-b-2 border-red-500'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Heart className={`w-3.5 h-3.5 ${mainTab === 'saved' ? 'fill-red-500' : ''}`} />
                        Saved
                    </button>
                    <button
                        onClick={() => setMainTab('recent')}
                        className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${mainTab === 'recent'
                            ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-500'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Recent
                    </button>
                    <button
                        onClick={() => setMainTab('ai')}
                        className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${mainTab === 'ai'
                            ? 'text-orange-600 bg-orange-50 border-b-2 border-orange-500'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Ideas
                    </button>
                </div>

                {/* Selected Meal Indicator */}
                {selectedMeal && (
                    <div className="p-2.5 bg-green-50 border-b border-green-200 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">
                            Swapping: <strong className="capitalize">{selectedMeal.mealType}</strong>
                        </span>
                    </div>
                )}

                <p className="text-xs text-gray-500 px-4 pt-2 pb-1">
                    {selectedMeal ? 'Click any meal to replace the selected slot.' : 'Select a meal slot first, then pick a replacement.'}
                </p>

                {/* Content based on main tab */}
                {mainTab === 'saved' ? (
                    /* SAVED RECIPES TAB */
                    <div className="flex-1 overflow-y-auto p-3">
                        {loadingSaved ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                            </div>
                        ) : savedRecipes.length > 0 ? (
                            <div className="space-y-2">
                                {savedRecipes.map((recipe) => (
                                    <div
                                        key={recipe.id}
                                        className="group bg-white border rounded-xl p-2.5 hover:shadow-md transition-all cursor-pointer flex items-center gap-3 border-gray-200 hover:border-red-300"
                                        onClick={() => setSlotPickerMeal(recipe.main_dish)}
                                        title="Click to add to meal plan"
                                    >
                                        {/* Thumbnail */}
                                        {recipe.thumbnail_url ? (
                                            <img
                                                src={recipe.thumbnail_url}
                                                alt=""
                                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                <Heart className="w-5 h-5 text-gray-300" />
                                            </div>
                                        )}
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {recipe.main_dish}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {recipe.cook_time_minutes && (
                                                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {recipe.cook_time_minutes}m
                                                    </span>
                                                )}
                                                {recipe.difficulty && (
                                                    <span className="text-xs text-gray-500">
                                                        {recipe.difficulty}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Add button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSlotPickerMeal(recipe.main_dish);
                                            }}
                                            className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-red-100 text-red-600 hover:bg-red-200"
                                            title="Add to meal plan"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <Heart className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                <p className="font-medium text-gray-600">No saved recipes</p>
                                <p className="text-xs mt-1">Save recipes from the Recipe panel to see them here.</p>
                            </div>
                        )}
                    </div>
                ) : mainTab === 'recent' ? (
                    /* RECENTLY VIEWED TAB */
                    <div className="flex-1 overflow-y-auto p-3">
                        {loadingRecent ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                        ) : recentRecipes.length > 0 ? (
                            <div className="space-y-2">
                                {recentRecipes.map((recipe) => {
                                    const timeAgo = getTimeAgo(recipe.viewed_at);
                                    return (
                                        <div
                                            key={recipe.id}
                                            className="group bg-white border rounded-xl p-2.5 hover:shadow-md transition-all cursor-pointer flex items-center gap-3 border-gray-200 hover:border-blue-300"
                                            onClick={() => setSlotPickerMeal(recipe.main_dish)}
                                            title="Click to add to meal plan"
                                        >
                                            {/* Thumbnail */}
                                            {recipe.thumbnail_url ? (
                                                <img
                                                    src={recipe.thumbnail_url}
                                                    alt=""
                                                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <Clock className="w-5 h-5 text-gray-300" />
                                                </div>
                                            )}
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">
                                                    {recipe.main_dish}
                                                </p>
                                                <span className="text-xs text-gray-400">{timeAgo}</span>
                                            </div>
                                            {/* Add button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSlotPickerMeal(recipe.main_dish);
                                                }}
                                                className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-blue-100 text-blue-600 hover:bg-blue-200"
                                                title="Add to meal plan"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                <p className="font-medium text-gray-600">No recent recipes</p>
                                <p className="text-xs mt-1">Recipes you view will appear here.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* AI IDEAS TAB */
                    <>
                        {/* Meal type tabs */}
                        <div className="flex border-b bg-gray-50">
                            {MEAL_TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setMealTab(tab)}
                                    className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${mealTab === tab
                                        ? 'text-orange-600 bg-white'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    {tab}
                                    {mealTab === tab && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* AI alternatives content */}
                        <div className="flex-1 overflow-y-auto p-3">
                            {isLoading ? (
                                <div className="text-center py-10 text-gray-400">
                                    <RefreshCw className="w-10 h-10 mx-auto mb-2 animate-spin text-orange-400" />
                                    <p>Generating fresh ideas...</p>
                                </div>
                            ) : currentAlternatives.length > 0 ? (
                                <div className="space-y-2">
                                    {currentAlternatives.map((meal, idx) => (
                                        <div
                                            key={idx}
                                            className="group bg-white border rounded-xl p-3 hover:shadow-md transition-all cursor-pointer flex justify-between items-center border-gray-200 hover:border-orange-300"
                                            onClick={() => setSlotPickerMeal(meal)}
                                            title="Click to select where to use this meal"
                                        >
                                            <span className="text-gray-700 text-sm font-medium leading-tight">
                                                {meal}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSlotPickerMeal(meal);
                                                }}
                                                className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-orange-100 text-orange-600 hover:bg-orange-200"
                                                title="Add to meal plan"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-400">
                                    <Search className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p>No alternatives yet.</p>
                                    {onRegenerateAlternatives && (
                                        <button
                                            onClick={onRegenerateAlternatives}
                                            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                                        >
                                            Generate AI Ideas
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Meal Slot Picker Modal */}
                <MealSlotPicker
                    isOpen={!!slotPickerMeal}
                    onClose={() => setSlotPickerMeal(null)}
                    onSelectSlot={(dayIndex, mealType) => {
                        if (slotPickerMeal) {
                            onSelectAlternative(slotPickerMeal, dayIndex, mealType);
                            setSlotPickerMeal(null);
                        }
                    }}
                    weeklyPlan={weeklyPlan || null}
                    selectedMealName={slotPickerMeal || ''}
                />
            </div>
        </>
    );
}
