import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Eye, Search, Loader2, ChefHat, Heart, Share2, Clock, Flame, ShoppingCart, Check, Plus } from 'lucide-react';
import YouTubeEmbed from './YouTubeEmbed';
import { supabase } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';

interface StructuredIngredient {
    name: string;
    quantity: string;
    category: string;
}

interface NutritionInfo {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface RecipeData {
    mealName: string;
    mainDish: string;
    sides: string[];
    youtubeVideoId: string;
    videoTitle: string;
    channelName: string;
    viewCount: number;
    thumbnailUrl: string;
    description: string;
    cookTimeMinutes: number | null;
    difficulty: 'Easy' | 'Medium' | 'Moderate' | 'Advanced' | null;
    ingredients: StructuredIngredient[] | string[];
    nutrition: NutritionInfo | null;
    isAiGenerated?: boolean;
    fromCache?: boolean;
}

interface RecipePanelProps {
    mealName: string | null;
    onClose: () => void;
    isOpen: boolean;
}

const RecipePanel: React.FC<RecipePanelProps> = ({ mealName, onClose, isOpen }) => {
    const { isFamilyModeActive, familyGroup } = useFamily();

    const [recipe, setRecipe] = useState<RecipeData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [shareMessage, setShareMessage] = useState<string | null>(null);

    // Grocery integration state
    const [groceryItems, setGroceryItems] = useState<Set<string>>(new Set());
    const [addingItem, setAddingItem] = useState<string | null>(null);
    const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
    const [addingAll, setAddingAll] = useState(false);

    // Auto-play video on mobile (no thumbnail tap needed)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const [showVideo, setShowVideo] = useState(isMobile);

    // Get pantry staples to filter out (common Indian kitchen staples)
    const pantryStaples = ['salt', 'oil', 'water', 'turmeric', 'cumin', 'coriander', 'chili powder', 'garam masala', 'mustard seeds'];

    // Helper to normalize ingredient for comparison
    const normalizeIngredient = (name: string): string => {
        return name.toLowerCase().trim().replace(/s$/, ''); // Simple singular form
    };

    // Check if ingredient is in pantry
    const isPantryItem = (name: string): boolean => {
        const normalized = normalizeIngredient(name);
        return pantryStaples.some(p => normalizeIngredient(p).includes(normalized) || normalized.includes(normalizeIngredient(p)));
    };

    // Check if ingredient is already in grocery list
    const isInGrocery = (name: string): boolean => {
        const normalized = normalizeIngredient(name);
        return Array.from(groceryItems).some(g => normalizeIngredient(g).includes(normalized) || normalized.includes(normalizeIngredient(g)));
    };

    // Get display name for ingredient (works with both string and object)
    const getIngredientDisplay = (ing: StructuredIngredient | string): { name: string; quantity: string } => {
        if (typeof ing === 'string') {
            return { name: ing, quantity: '' };
        }
        return { name: ing.name, quantity: ing.quantity };
    };

    useEffect(() => {
        if (!mealName || !isOpen) {
            setRecipe(null);
            setError(null);
            setShowVideo(isMobile);
            setIsSaved(false);
            return;
        }

        const fetchRecipe = async () => {
            setLoading(true);
            setError(null);
            setShowVideo(isMobile);

            try {
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://igcmhlfonulqtxsiiisb.supabase.co';
                const response = await fetch(`${SUPABASE_URL}/functions/v1/recipe-search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mealName }),
                });

                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'Failed to find recipe');
                    return;
                }

                setRecipe(data);
                if (isMobile) setShowVideo(true);

                // Check if recipe is saved
                const { data: { user } } = await supabase.auth.getUser();
                if (user && data.youtubeVideoId) {
                    const { data: saved } = await supabase
                        .from('saved_recipes')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('youtube_video_id', data.youtubeVideoId)
                        .single();
                    setIsSaved(!!saved);

                    // Track as recently viewed (upsert to update viewed_at)
                    try {
                        await supabase.from('recently_viewed_recipes').upsert({
                            user_id: user.id,
                            meal_name: data.mealName,
                            main_dish: data.mainDish,
                            youtube_video_id: data.youtubeVideoId,
                            thumbnail_url: data.thumbnailUrl,
                            viewed_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,meal_name' });
                    } catch (e) {
                        console.error('Failed to track recently viewed:', e);
                    }
                }
            } catch (err) {
                console.error('Recipe fetch error:', err);
                setError('Failed to load recipe');
            } finally {
                setLoading(false);
            }
        };

        fetchRecipe();
    }, [mealName, isOpen, isMobile]);

    // Fetch current grocery list to check what's already there
    useEffect(() => {
        const fetchGroceryList = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            try {
                let query = supabase.from('grocery_items').select('item');

                if (isFamilyModeActive && familyGroup?.id) {
                    query = query.eq('family_group_id', familyGroup.id);
                } else {
                    query = query.eq('user_id', user.id);
                }

                const { data } = await query;
                if (data) {
                    setGroceryItems(new Set(data.map(d => d.item)));
                }
            } catch (err) {
                console.error('Failed to fetch grocery list:', err);
            }
        };

        if (isOpen && recipe) {
            fetchGroceryList();
        }
    }, [isOpen, recipe, isFamilyModeActive, familyGroup?.id]);

    // Add single ingredient to grocery
    const addToGrocery = async (ingredient: StructuredIngredient | string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { name, quantity } = getIngredientDisplay(ingredient);
        const category = typeof ingredient === 'object' ? ingredient.category : 'other';

        setAddingItem(name);

        try {
            const insertData: any = {
                item: name,
                quantity: quantity,
                category: category,
                source: 'recipe',
                source_recipe: recipe?.mainDish || mealName || 'Unknown'
            };

            if (isFamilyModeActive && familyGroup?.id) {
                insertData.family_group_id = familyGroup.id;
            } else {
                insertData.user_id = user.id;
            }

            await supabase.from('grocery_items').insert(insertData);

            setGroceryItems(prev => new Set([...prev, name]));
            setAddedItems(prev => new Set([...prev, name]));
        } catch (err) {
            console.error('Failed to add to grocery:', err);
        } finally {
            setAddingItem(null);
        }
    };

    // Add all missing ingredients to grocery
    const addAllMissing = async () => {
        if (!recipe?.ingredients) return;

        const missing = recipe.ingredients.filter(ing => {
            const { name } = getIngredientDisplay(ing);
            return !isPantryItem(name) && !isInGrocery(name) && !addedItems.has(name);
        });

        if (missing.length === 0) return;

        setAddingAll(true);

        for (const ing of missing) {
            await addToGrocery(ing);
        }

        setAddingAll(false);
    };

    const formatViewCount = (count: number): string => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
        return count.toString();
    };

    const extractMainDishName = (text: string): string => {
        // Remove parenthetical content first (like "(250g paneer)")
        const cleaned = text.replace(/\s*\([^)]*\)/g, '');
        const firstPart = cleaned.split(/[•·,\n]/)[0]?.trim() || cleaned;
        // Strip leading quantities
        return firstPart.replace(/^\d+[\s\-]*(cups?|grams?|g|pcs?|pieces?|slices?|eggs?|ml|liters?|tbsp|tsp|oz|lb|kg|servings?)?\s*/i, '').trim() || firstPart;
    };

    const openYouTubeSearch = () => {
        const searchTerm = recipe?.mainDish || extractMainDishName(mealName || '');
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + ' recipe')}`, '_blank');
    };

    const handleSaveRecipe = async () => {
        if (!recipe) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setSavingState('saving');

        try {
            if (isSaved) {
                // Unsave
                await supabase
                    .from('saved_recipes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('youtube_video_id', recipe.youtubeVideoId);
                setIsSaved(false);
            } else {
                // Save
                await supabase.from('saved_recipes').insert({
                    user_id: user.id,
                    meal_name: recipe.mealName,
                    main_dish: recipe.mainDish,
                    youtube_video_id: recipe.youtubeVideoId,
                    video_title: recipe.videoTitle,
                    channel_name: recipe.channelName,
                    thumbnail_url: recipe.thumbnailUrl,
                    cook_time_minutes: recipe.cookTimeMinutes,
                    difficulty: recipe.difficulty,
                });
                setIsSaved(true);
            }
            setSavingState('saved');
            setTimeout(() => setSavingState('idle'), 1500);
        } catch (err) {
            console.error('Save recipe error:', err);
            setSavingState('idle');
        }
    };

    const handleShare = async () => {
        if (!recipe) return;

        const shareUrl = `https://www.youtube.com/watch?v=${recipe.youtubeVideoId}`;
        const shareText = `Check out this ${recipe.mainDish} recipe! 🍳`;

        if (navigator.share) {
            try {
                await navigator.share({ title: recipe.mainDish, text: shareText, url: shareUrl });
            } catch (err) {
                // User cancelled or error
            }
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
            setShareMessage('Link copied!');
            setTimeout(() => setShareMessage(null), 2000);
        }
    };

    const getDifficultyColor = (difficulty: string | null) => {
        switch (difficulty) {
            case 'Easy': return 'bg-green-100 text-green-700';
            case 'Medium': return 'bg-yellow-100 text-yellow-700';
            case 'Moderate': return 'bg-orange-100 text-orange-700';
            case 'Advanced': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    if (!isOpen) return null;

    const displayMainDish = recipe?.mainDish || extractMainDishName(mealName || '');
    const displaySides = recipe?.sides || [];

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`
                fixed z-50 bg-white shadow-2xl overflow-hidden transition-transform duration-300
                inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh]
                lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[440px] lg:max-h-none lg:rounded-none lg:rounded-l-2xl
                ${isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}
            `}>
                {/* Drag handle - mobile only */}
                <div className="lg:hidden flex justify-center py-2">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-4 py-3 border-b bg-gradient-to-r from-orange-500 to-red-500">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-white mb-1">
                                <ChefHat className="w-5 h-5 flex-shrink-0" />
                                <h2 className="font-bold text-lg truncate">{displayMainDish}</h2>
                            </div>

                            {/* Cook time & Difficulty badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                {recipe?.cookTimeMinutes && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-white/25 rounded-full text-white">
                                        <Clock className="w-3 h-3" />
                                        {recipe.cookTimeMinutes} min
                                    </span>
                                )}
                                {recipe?.difficulty && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(recipe.difficulty)}`}>
                                        {recipe.difficulty}
                                    </span>
                                )}
                            </div>

                            {/* Sides as tags */}
                            {displaySides.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {displaySides.map((side, idx) => (
                                        <span key={idx} className="text-xs px-2 py-0.5 bg-white/20 rounded-full text-white/90">
                                            + {side}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Header actions */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleSaveRecipe}
                                className={`p-1.5 rounded-full transition-colors ${isSaved ? 'bg-white/30' : 'hover:bg-white/20'} text-white`}
                                title={isSaved ? 'Remove from favorites' : 'Save to favorites'}
                            >
                                <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                onClick={handleShare}
                                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                                title="Share recipe"
                            >
                                <Share2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Share message toast */}
                    {shareMessage && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg">
                            {shareMessage}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(90vh - 110px)' }}>
                    {/* Loading state */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                            <p className="text-gray-500">Finding best {displayMainDish} recipe...</p>
                        </div>
                    )}

                    {/* Error state */}
                    {error && !loading && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 mb-4">{error}</p>
                            <button
                                onClick={openYouTubeSearch}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <Search className="w-4 h-4" />
                                Search on YouTube
                            </button>
                        </div>
                    )}

                    {/* Recipe content */}
                    {recipe && !loading && (
                        <>
                            {/* Video section */}
                            <div className="relative">
                                {showVideo ? (
                                    <YouTubeEmbed videoId={recipe.youtubeVideoId} title={recipe.videoTitle} />
                                ) : (
                                    <button
                                        onClick={() => setShowVideo(true)}
                                        className="relative w-full aspect-video rounded-xl overflow-hidden group"
                                    >
                                        <img
                                            src={recipe.thumbnailUrl}
                                            alt={recipe.videoTitle}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>
                                )}
                            </div>

                            {/* Video info */}
                            <div className="space-y-1">
                                <h3 className="font-semibold text-gray-900 line-clamp-2">{recipe.videoTitle}</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <span className="font-medium text-gray-700">{recipe.channelName}</span>
                                    <span className="flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5" />
                                        {formatViewCount(recipe.viewCount)} views
                                    </span>
                                </div>
                            </div>

                            {/* Ingredients section with grocery integration */}
                            {recipe.ingredients && recipe.ingredients.length > 0 && (
                                <div className="bg-orange-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                            <ShoppingCart className="w-4 h-4 text-orange-600" />
                                            Ingredients ({recipe.ingredients.length})
                                            {recipe.isAiGenerated && (
                                                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                                                    AI
                                                </span>
                                            )}
                                        </h4>
                                        {isFamilyModeActive && (
                                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                                👨‍👩‍👧 Family
                                            </span>
                                        )}
                                    </div>

                                    {recipe.isAiGenerated && (
                                        <p className="text-xs text-amber-600 mb-3 bg-amber-50 rounded px-2 py-1">
                                            ⚠️ AI-generated list. Check video for exact ingredients.
                                        </p>
                                    )}

                                    <ul className="space-y-2">
                                        {recipe.ingredients.map((ing, idx) => {
                                            const { name, quantity } = getIngredientDisplay(ing);
                                            const inPantry = isPantryItem(name);
                                            const inGrocery = isInGrocery(name) || addedItems.has(name);
                                            const isAdding = addingItem === name;

                                            return (
                                                <li key={idx} className={`flex items-center justify-between text-sm ${inPantry ? 'text-gray-400' : 'text-gray-700'}`}>
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {inPantry ? (
                                                            <span className="w-4 h-4 text-gray-400 flex-shrink-0">─</span>
                                                        ) : inGrocery ? (
                                                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                        ) : (
                                                            <span className="w-4 h-4 border border-gray-300 rounded flex-shrink-0" />
                                                        )}
                                                        <span className={`truncate ${inPantry ? 'line-through' : ''}`}>
                                                            {quantity && <span className="font-medium">{quantity} </span>}
                                                            {name}
                                                        </span>
                                                    </div>

                                                    {/* Status / Action button */}
                                                    {inPantry ? (
                                                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">Pantry</span>
                                                    ) : inGrocery ? (
                                                        <span className="text-xs text-green-600 flex-shrink-0 ml-2">✓ In List</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => addToGrocery(ing)}
                                                            disabled={isAdding}
                                                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-100 px-2 py-1 rounded transition-colors flex-shrink-0 ml-2"
                                                        >
                                                            {isAdding ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Plus className="w-3 h-3" />
                                                            )}
                                                            <span className="hidden sm:inline">Add</span>
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    {/* Add All Missing button */}
                                    {(() => {
                                        const missingCount = recipe.ingredients.filter(ing => {
                                            const { name } = getIngredientDisplay(ing);
                                            return !isPantryItem(name) && !isInGrocery(name) && !addedItems.has(name);
                                        }).length;

                                        return missingCount > 0 && (
                                            <button
                                                onClick={addAllMissing}
                                                disabled={addingAll}
                                                className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                            >
                                                {addingAll ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Adding...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="w-4 h-4" />
                                                        Add {missingCount} to Grocery
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Nutrition pills */}
                            {recipe.nutrition && (
                                <div className="bg-green-50 rounded-xl p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Flame className="w-4 h-4 text-green-600" />
                                        Nutrition
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                            per serving
                                        </span>
                                        {recipe.isAiGenerated && (
                                            <span className="text-xs text-gray-400 ml-auto">AI estimate</span>
                                        )}
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                                            <div className="text-lg font-bold text-gray-900">{recipe.nutrition.calories}</div>
                                            <div className="text-xs text-gray-500">kcal</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                                            <div className="text-lg font-bold text-blue-600">{recipe.nutrition.protein}g</div>
                                            <div className="text-xs text-gray-500">protein</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                                            <div className="text-lg font-bold text-amber-600">{recipe.nutrition.carbs}g</div>
                                            <div className="text-xs text-gray-500">carbs</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                                            <div className="text-lg font-bold text-red-500">{recipe.nutrition.fat}g</div>
                                            <div className="text-xs text-gray-500">fat</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Description preview */}
                            {recipe.description && !recipe.ingredients?.length && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-sm text-gray-600 line-clamp-4">{recipe.description}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <a
                                    href={`https://www.youtube.com/watch?v=${recipe.youtubeVideoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Watch on YouTube
                                </a>
                                <button
                                    onClick={openYouTubeSearch}
                                    className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm flex items-center gap-1.5"
                                    title="Search for more recipes on YouTube"
                                >
                                    <Search className="w-4 h-4" />
                                    <span className="hidden sm:inline">More</span>
                                </button>
                            </div>

                            {/* Attribution */}
                            <p className="text-xs text-gray-400 text-center">
                                Video via YouTube • {recipe.fromCache ? 'Cached' : 'Fresh'}
                                {recipe.isAiGenerated && ' • Time/ingredients by AI'}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default RecipePanel;
