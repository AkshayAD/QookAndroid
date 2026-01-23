import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    Search, Download, Check, X, Star, Coffee, Sun, Moon,
    ChefHat, Leaf, Globe, Filter
} from 'lucide-react';

interface TemplateData {
    name: string;
    dietaryType?: string;
    dietaryTypes?: string[];
    dislikes?: string[];
    breakfastPreferences?: string[];
    lunchPreferences?: string[];
    dinnerPreferences?: string[];
    specialInstructions?: string;
    language?: string;
}

interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    template_data: TemplateData;
    is_featured: boolean;
    download_count: number;
    is_downloaded: boolean;
}

interface TemplateLibraryProps {
    onApplyTemplate: (templateData: TemplateData) => void;
    onClose: () => void;
}

export default function TemplateLibrary({ onApplyTemplate, onClose }: TemplateLibraryProps) {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    async function loadTemplates() {
        if (!supabase || !user) return;

        setLoading(true);
        try {
            // Use the database function to get templates filtered for this user
            const { data, error } = await supabase.rpc('get_templates_for_user', {
                p_user_id: user.id
            });

            if (error) {
                console.error('Error loading templates:', error);
                // Fallback: load all active templates
                const { data: fallbackData } = await supabase
                    .from('custom_templates')
                    .select('*')
                    .eq('is_active', true)
                    .order('is_featured', { ascending: false })
                    .order('download_count', { ascending: false });

                setTemplates((fallbackData || []).map(t => ({ ...t, is_downloaded: false })));
            } else {
                setTemplates(data || []);
            }
        } catch (err) {
            console.error('Template load error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleApply(template: Template) {
        if (!supabase || !user) return;

        setApplying(true);
        try {
            // Record the download
            await supabase.from('user_template_downloads').upsert({
                user_id: user.id,
                template_id: template.id
            }, { onConflict: 'user_id,template_id' });

            // Increment download count
            await supabase.rpc('increment_template_downloads', {
                p_template_id: template.id
            });

            // Apply the template
            onApplyTemplate(template.template_data);
            onClose();
        } catch (err) {
            console.error('Apply template error:', err);
            alert('Failed to apply template. Please try again.');
        } finally {
            setApplying(false);
        }
    }

    async function handleRemove(template: Template) {
        if (!supabase || !user) return;

        try {
            await supabase
                .from('user_template_downloads')
                .delete()
                .eq('user_id', user.id)
                .eq('template_id', template.id);

            // Refresh the list
            loadTemplates();
        } catch (err) {
            console.error('Remove template error:', err);
        }
    }

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const myTemplates = filteredTemplates.filter(t => t.is_downloaded);
    const availableTemplates = filteredTemplates.filter(t => !t.is_downloaded);

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'cuisine': return <ChefHat className="w-4 h-4" />;
            case 'dietary': return <Leaf className="w-4 h-4" />;
            default: return <Coffee className="w-4 h-4" />;
        }
    };

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'cuisine': return 'bg-purple-100 text-purple-700';
            case 'dietary': return 'bg-green-100 text-green-700';
            case 'meal_plan': return 'bg-amber-100 text-amber-700';
            default: return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <ChefHat className="w-6 h-6" />
                            Preference Templates
                        </h2>
                        <p className="text-violet-200 text-sm">
                            Apply pre-made preference profiles to quickly set up your account
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="p-4 border-b bg-gray-50 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                    >
                        <option value="all">All Categories</option>
                        <option value="preference">Preference Profiles</option>
                        <option value="cuisine">Cuisine Styles</option>
                        <option value="dietary">Dietary Plans</option>
                    </select>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
                        </div>
                    ) : (
                        <>
                            {/* My Templates Section */}
                            {myTemplates.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Download className="w-4 h-4" /> My Templates ({myTemplates.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {myTemplates.map((t) => (
                                            <div key={t.id} className="bg-violet-50 rounded-xl border border-violet-200 p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                                            {t.name}
                                                            {t.is_featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                                        </h4>
                                                        <p className="text-sm text-gray-500 line-clamp-1">{t.description}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(t.category)}`}>
                                                        {t.category}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleApply(t)}
                                                        disabled={applying}
                                                        className="flex-1 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                                                    >
                                                        Apply to Profile
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemove(t)}
                                                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Available Templates Section */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                                    {myTemplates.length > 0 ? 'Discover More' : 'Available Templates'} ({availableTemplates.length})
                                </h3>

                                {availableTemplates.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        {searchQuery ? 'No templates match your search' : 'No templates available yet'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {availableTemplates.map((t) => (
                                            <div
                                                key={t.id}
                                                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                                onClick={() => setPreviewTemplate(t)}
                                            >
                                                <div className="p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                                            {t.is_featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                                            {t.name}
                                                        </h4>
                                                    </div>
                                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{t.description || 'No description'}</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getCategoryColor(t.category)}`}>
                                                            {getCategoryIcon(t.category)}
                                                            {t.category}
                                                        </span>
                                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                                            <Download className="w-3 h-3" /> {t.download_count}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex justify-between items-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPreviewTemplate(t);
                                                        }}
                                                        className="text-violet-600 hover:text-violet-700 text-sm font-medium"
                                                    >
                                                        Preview
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleApply(t);
                                                        }}
                                                        disabled={applying}
                                                        className="px-3 py-1 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Add
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-bold text-lg">{previewTemplate.name}</h3>
                            <button onClick={() => setPreviewTemplate(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <p className="text-gray-600">{previewTemplate.description}</p>

                            {previewTemplate.template_data.dietaryTypes && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Dietary Preferences</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {previewTemplate.template_data.dietaryTypes.map((d, i) => (
                                            <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">{d}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {previewTemplate.template_data.breakfastPreferences?.length ? (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <Coffee className="w-4 h-4" /> Breakfast ({previewTemplate.template_data.breakfastPreferences.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {previewTemplate.template_data.breakfastPreferences.slice(0, 5).map((item, i) => (
                                            <span key={i} className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm">{item}</span>
                                        ))}
                                        {previewTemplate.template_data.breakfastPreferences.length > 5 && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm">
                                                +{previewTemplate.template_data.breakfastPreferences.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {previewTemplate.template_data.lunchPreferences?.length ? (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <Sun className="w-4 h-4" /> Lunch ({previewTemplate.template_data.lunchPreferences.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {previewTemplate.template_data.lunchPreferences.slice(0, 5).map((item, i) => (
                                            <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm">{item}</span>
                                        ))}
                                        {previewTemplate.template_data.lunchPreferences.length > 5 && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm">
                                                +{previewTemplate.template_data.lunchPreferences.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {previewTemplate.template_data.dinnerPreferences?.length ? (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <Moon className="w-4 h-4" /> Dinner ({previewTemplate.template_data.dinnerPreferences.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {previewTemplate.template_data.dinnerPreferences.slice(0, 5).map((item, i) => (
                                            <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm">{item}</span>
                                        ))}
                                        {previewTemplate.template_data.dinnerPreferences.length > 5 && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm">
                                                +{previewTemplate.template_data.dinnerPreferences.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {previewTemplate.template_data.dislikes?.length ? (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Dislikes</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {previewTemplate.template_data.dislikes.map((item, i) => (
                                            <span key={i} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-sm">{item}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    handleApply(previewTemplate);
                                    setPreviewTemplate(null);
                                }}
                                disabled={applying}
                                className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Apply Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
