import React, { useState, useEffect } from 'react';
import { X, Heart, Trash2, Clock, ChefHat, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SavedRecipe {
    id: string;
    meal_name: string;
    main_dish: string;
    youtube_video_id: string;
    video_title: string;
    channel_name: string;
    thumbnail_url: string;
    cook_time_minutes: number | null;
    difficulty: string | null;
    saved_at: string;
}

interface SavedRecipesPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectRecipe?: (mealName: string) => void;
}

const SavedRecipesPanel: React.FC<SavedRecipesPanelProps> = ({ isOpen, onClose, onSelectRecipe }) => {
    const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSavedRecipes();
        }
    }, [isOpen]);

    // Lock body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Mobile specific lock
            const isMobile = window.innerWidth < 1024;
            if (isMobile) {
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            }
        } else {
            document.body.style.overflow = '';
            const isMobile = window.innerWidth < 1024;
            if (isMobile) {
                document.body.style.position = '';
                document.body.style.width = '';
            }
        }
        return () => {
            document.body.style.overflow = '';
            const isMobile = window.innerWidth < 1024;
            if (isMobile) {
                document.body.style.position = '';
                document.body.style.width = '';
            }
        };
    }, [isOpen]);

    const fetchSavedRecipes = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setRecipes([]);
                return;
            }

            const { data, error } = await supabase
                .from('saved_recipes')
                .select('*')
                .eq('user_id', user.id)
                .order('saved_at', { ascending: false });

            if (error) throw error;
            setRecipes(data || []);
        } catch (err) {
            console.error('Failed to fetch saved recipes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (recipeId: string) => {
        setDeletingId(recipeId);
        try {
            const { error } = await supabase
                .from('saved_recipes')
                .delete()
                .eq('id', recipeId);

            if (!error) {
                setRecipes(prev => prev.filter(r => r.id !== recipeId));
            }
        } catch (err) {
            console.error('Failed to delete recipe:', err);
        } finally {
            setDeletingId(null);
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

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Heart className="w-5 h-5 fill-current" />
                        <h2 className="font-bold text-lg">Saved Recipes</h2>
                        <span className="text-sm opacity-80">({recipes.length})</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        overscrollBehaviorY: 'contain'
                    }}
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        </div>
                    ) : recipes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Heart className="w-16 h-16 text-gray-200 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700 mb-2">No saved recipes yet</h3>
                            <p className="text-gray-500 text-sm">
                                Click the heart icon on any recipe to save it here for quick access.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {recipes.map(recipe => (
                                <div key={recipe.id} className="p-3 hover:bg-orange-50 transition-colors">
                                    <div className="flex gap-3">
                                        {/* Thumbnail */}
                                        <button
                                            onClick={() => onSelectRecipe?.(recipe.main_dish)}
                                            className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-gray-100 group"
                                        >
                                            {recipe.thumbnail_url ? (
                                                <img
                                                    src={recipe.thumbnail_url}
                                                    alt={recipe.main_dish}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ChefHat className="w-6 h-6 text-gray-400" />
                                                </div>
                                            )}
                                        </button>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <button
                                                onClick={() => onSelectRecipe?.(recipe.main_dish)}
                                                className="text-left w-full"
                                            >
                                                <h4 className="font-medium text-gray-900 truncate hover:text-orange-600 transition-colors">
                                                    {recipe.main_dish}
                                                </h4>
                                            </button>
                                            <p className="text-xs text-gray-500 truncate mb-1">
                                                {recipe.channel_name}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {recipe.cook_time_minutes && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                        <Clock className="w-3 h-3" />
                                                        {recipe.cook_time_minutes}m
                                                    </span>
                                                )}
                                                {recipe.difficulty && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${getDifficultyColor(recipe.difficulty)}`}>
                                                        {recipe.difficulty}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-400">
                                                    Saved {formatDate(recipe.saved_at)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={`https://www.youtube.com/watch?v=${recipe.youtube_video_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Watch on YouTube"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(recipe.id)}
                                                disabled={deletingId === recipe.id}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                                title="Remove from saved"
                                            >
                                                {deletingId === recipe.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer tip */}
                <div className="px-4 py-3 border-t bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">
                        Click a recipe to view it, or the YouTube icon to watch directly.
                    </p>
                </div>
            </div>
        </>
    );
};

export default SavedRecipesPanel;
