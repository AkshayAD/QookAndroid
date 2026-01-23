import React, { useState, useEffect } from 'react';
import {
    Search, Plus, Trash2, Save, X, Eye, Users, Star,
    Coffee, Sun, Moon, AlertCircle, Globe, Check,
    ChevronDown, Send, Download
} from 'lucide-react';

interface TemplateData {
    name: string;
    dietaryType: string;
    dietaryTypes: string[];
    dietaryDetails: string;
    allergies: string[];
    dislikes: string[];
    breakfastPreferences: string[];
    lunchPreferences: string[];
    dinnerPreferences: string[];
    specialInstructions: string;
    pantryStaples: string[];
    mealsToPrepare: string[];
    nonVegPreferences: string[];
    language: string;
    quickCookInstructions: string[];
}

interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    template_data: TemplateData;
    target_audience: string;
    target_tiers: string[];
    target_segments: string[];
    is_default_for_new_users: boolean;
    is_active: boolean;
    is_featured: boolean;
    download_count: number;
    created_at: string;
}

interface TemplateEditorProps {
    template?: Template | null;
    onSave: (template: any) => void;
    onClose: () => void;
    adminAPI: (action: string, payload?: any) => Promise<any>;
}

// Visual Template Editor - Matches PreferencesModal UI
export function TemplateEditor({ template, onSave, onClose, adminAPI }: TemplateEditorProps) {
    const isEditing = !!template;

    const emptyTemplateData: TemplateData = {
        name: '',
        dietaryType: 'Vegetarian',
        dietaryTypes: ['Vegetarian'],
        dietaryDetails: '',
        allergies: [],
        dislikes: [],
        breakfastPreferences: [],
        lunchPreferences: [],
        dinnerPreferences: [],
        specialInstructions: '',
        pantryStaples: [],
        mealsToPrepare: ['breakfast', 'lunch', 'dinner'],
        nonVegPreferences: [],
        language: 'English',
        quickCookInstructions: []
    };

    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [category, setCategory] = useState(template?.category || 'preference');
    const [targetAudience, setTargetAudience] = useState(template?.target_audience || 'all_users');
    const [targetTiers, setTargetTiers] = useState<string[]>(template?.target_tiers || []);
    const [targetSegments, setTargetSegments] = useState<string[]>(template?.target_segments || []);
    const [isDefault, setIsDefault] = useState(template?.is_default_for_new_users || false);
    const [isFeatured, setIsFeatured] = useState(template?.is_featured || false);

    const [templateData, setTemplateData] = useState<TemplateData>(
        template?.template_data || emptyTemplateData
    );

    const [activeTab, setActiveTab] = useState<'general' | 'breakfast' | 'lunch' | 'dinner'>('general');
    const [saving, setSaving] = useState(false);
    const [segments, setSegments] = useState<any[]>([]);
    const [newItem, setNewItem] = useState('');

    useEffect(() => {
        loadSegments();
    }, []);

    async function loadSegments() {
        const result = await adminAPI('list_segments');
        if (result.success) {
            setSegments(result.data?.segments || []);
        }
    }

    async function handleSave() {
        if (!name.trim()) {
            alert('Template name is required');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                templateId: template?.id,
                name,
                description,
                category,
                templateData,
                targetAudience,
                targetTiers,
                targetSegments,
                isDefaultForNewUsers: isDefault,
                isFeatured
            };

            await onSave(payload);
        } finally {
            setSaving(false);
        }
    }

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    const addItem = (field: keyof TemplateData) => {
        if (!newItem.trim()) return;
        const current = templateData[field] as string[];
        setTemplateData({ ...templateData, [field]: [...current, newItem.trim()] });
        setNewItem('');
    };

    const removeItem = (field: keyof TemplateData, index: number) => {
        const current = [...(templateData[field] as string[])];
        current.splice(index, 1);
        setTemplateData({ ...templateData, [field]: current });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {isEditing ? 'Edit Template' : 'Create New Template'}
                        </h2>
                        <p className="text-orange-100 text-sm">
                            Design a preference template that users can apply
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Template Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., South Indian Breakfast Lover"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="preference">Preference Profile</option>
                                <option value="cuisine">Cuisine Style</option>
                                <option value="dietary">Dietary Plan</option>
                                <option value="meal_plan">Meal Plan</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of what this template includes..."
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                    </div>

                    {/* Targeting Section */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Targeting
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-blue-700 mb-1">Audience</label>
                                <select
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-white"
                                >
                                    <option value="all_users">All Users</option>
                                    <option value="by_tier">By Tier</option>
                                    <option value="by_segment">By Segment</option>
                                </select>
                            </div>

                            {targetAudience === 'by_tier' && (
                                <div>
                                    <label className="block text-sm font-medium text-blue-700 mb-1">Tiers</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['free', 'basic', 'pro'].map((tier) => (
                                            <label key={tier} className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg border cursor-pointer hover:bg-blue-50">
                                                <input
                                                    type="checkbox"
                                                    checked={targetTiers.includes(tier)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setTargetTiers([...targetTiers, tier]);
                                                        } else {
                                                            setTargetTiers(targetTiers.filter(t => t !== tier));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                                <span className="text-sm capitalize">{tier}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {targetAudience === 'by_segment' && (
                                <div>
                                    <label className="block text-sm font-medium text-blue-700 mb-1">Segments</label>
                                    <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                                        {segments.map((seg) => (
                                            <label key={seg.id} className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg border cursor-pointer hover:bg-blue-50">
                                                <input
                                                    type="checkbox"
                                                    checked={targetSegments.includes(seg.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setTargetSegments([...targetSegments, seg.id]);
                                                        } else {
                                                            setTargetSegments(targetSegments.filter(s => s !== seg.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                                <span className="text-sm">{seg.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-3 pt-3 border-t border-blue-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isDefault}
                                    onChange={(e) => setIsDefault(e.target.checked)}
                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                />
                                <span className="text-sm font-medium text-blue-800">Default for new users</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isFeatured}
                                    onChange={(e) => setIsFeatured(e.target.checked)}
                                    className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
                                />
                                <Star className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm font-medium text-blue-800">Featured</span>
                            </label>
                        </div>
                    </div>

                    {/* Preference Editor - Matches PreferencesModal */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b">
                            <h3 className="font-semibold text-gray-800">Template Content (Preview as User Sees)</h3>
                        </div>

                        {/* Tab Navigation */}
                        <div className="px-4 pt-4 flex gap-2 overflow-x-auto border-b border-gray-100 pb-2">
                            <TabButton id="general" label="General" icon={AlertCircle} />
                            <TabButton id="breakfast" label="Breakfast" icon={Coffee} />
                            <TabButton id="lunch" label="Lunch" icon={Sun} />
                            <TabButton id="dinner" label="Dinner" icon={Moon} />
                        </div>

                        {/* Tab Content */}
                        <div className="p-4">
                            {activeTab === 'general' && (
                                <div className="space-y-4">
                                    {/* Language */}
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-bold text-blue-800">Language</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {['English', 'Hindi'].map((lang) => (
                                                <button
                                                    key={lang}
                                                    onClick={() => setTemplateData({ ...templateData, language: lang })}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${templateData.language === lang
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white text-blue-700 hover:bg-blue-100'
                                                        }`}
                                                >
                                                    {lang === 'Hindi' ? 'हिंदी' : lang}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Food Preference */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Food Preference</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {[
                                                { value: 'Vegetarian', label: 'Veg' },
                                                { value: 'Vegetarian (with Eggs)', label: 'Veg + Eggs' },
                                                { value: 'Non-Vegetarian', label: 'Non-Veg' }
                                            ].map((opt) => {
                                                const selected = templateData.dietaryTypes?.includes(opt.value);
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            const current = templateData.dietaryTypes || ['Vegetarian'];
                                                            if (selected) {
                                                                if (current.length > 1) {
                                                                    setTemplateData({
                                                                        ...templateData,
                                                                        dietaryTypes: current.filter(v => v !== opt.value),
                                                                        dietaryType: current.filter(v => v !== opt.value)[0] || 'Vegetarian'
                                                                    });
                                                                }
                                                            } else {
                                                                setTemplateData({
                                                                    ...templateData,
                                                                    dietaryTypes: [...current, opt.value],
                                                                    dietaryType: opt.value
                                                                });
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selected ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <input
                                            type="text"
                                            value={templateData.dietaryDetails || ''}
                                            onChange={(e) => setTemplateData({ ...templateData, dietaryDetails: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                            placeholder="More details (e.g., Jain, No onion/garlic)..."
                                        />
                                    </div>

                                    {/* Dislikes */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Dislikes / Restrictions ({templateData.dislikes.length})
                                        </label>
                                        <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 mb-2">
                                            {templateData.dislikes.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-gray-100">
                                                    <Check className="w-4 h-4 text-green-600" />
                                                    <span className="flex-1 text-sm text-gray-800">{item}</span>
                                                    <button onClick={() => removeItem('dislikes', idx)} className="p-1 text-gray-400 hover:text-red-500">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {templateData.dislikes.length === 0 && (
                                                <p className="text-center text-gray-400 text-xs py-2">No dislikes added</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newItem}
                                                onChange={(e) => setNewItem(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addItem('dislikes')}
                                                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                                                placeholder="Add dislike..."
                                            />
                                            <button
                                                onClick={() => addItem('dislikes')}
                                                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(activeTab === 'breakfast' || activeTab === 'lunch' || activeTab === 'dinner') && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-bold text-gray-700 capitalize">
                                            {activeTab} Preferences
                                        </label>
                                        <span className="text-xs text-gray-400">
                                            {templateData[`${activeTab}Preferences`].length} items
                                        </span>
                                    </div>

                                    <div className="space-y-1 max-h-[40vh] overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50">
                                        {templateData[`${activeTab}Preferences`].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-orange-200">
                                                <Check className="w-4 h-4 text-green-600" />
                                                <span className="flex-1 text-sm text-gray-800">{item}</span>
                                                <button
                                                    onClick={() => {
                                                        const key = `${activeTab}Preferences` as keyof TemplateData;
                                                        removeItem(key, idx);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {templateData[`${activeTab}Preferences`].length === 0 && (
                                            <p className="text-center text-gray-400 text-sm py-4">
                                                No {activeTab} preferences yet. Add some below!
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newItem}
                                            onChange={(e) => setNewItem(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const key = `${activeTab}Preferences` as keyof TemplateData;
                                                    addItem(key);
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                                            placeholder={`Add ${activeTab} item...`}
                                        />
                                        <button
                                            onClick={() => {
                                                const key = `${activeTab}Preferences` as keyof TemplateData;
                                                addItem(key);
                                            }}
                                            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <>Saving...</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Template</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Enhanced Templates Tab with Search and Visual Editor
interface TemplatesTabProps {
    adminAPI: (action: string, payload?: any) => Promise<any>;
    setMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export default function TemplatesTab({ adminAPI, setMessage }: TemplatesTabProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    async function loadTemplates() {
        setLoading(true);
        const result = await adminAPI('list_templates');
        if (result.success) {
            setTemplates(result.data.templates || []);
        }
        setLoading(false);
    }

    async function handleSave(payload: any) {
        const action = payload.templateId ? 'update_template' : 'create_template';
        const result = await adminAPI(action, payload);
        if (result.success) {
            setMessage({ type: 'success', text: payload.templateId ? 'Template updated!' : 'Template created!' });
            setShowEditor(false);
            setEditingTemplate(null);
            loadTemplates();
        } else {
            setMessage({ type: 'error', text: result.error || 'Failed to save template' });
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this template?')) return;
        const result = await adminAPI('delete_template', { templateId: id });
        if (result.success) {
            setMessage({ type: 'success', text: 'Template deleted' });
            loadTemplates();
        }
    }

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Meal Template Library</h2>
                <button
                    onClick={() => { setEditingTemplate(null); setShowEditor(true); }}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Template
                </button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                </div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                    <option value="all">All Categories</option>
                    <option value="preference">Preference Profile</option>
                    <option value="cuisine">Cuisine Style</option>
                    <option value="dietary">Dietary Plan</option>
                    <option value="meal_plan">Meal Plan</option>
                </select>
            </div>

            {/* Templates Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            {searchQuery ? 'No templates match your search' : 'No templates yet. Create your first template!'}
                        </div>
                    ) : (
                        filteredTemplates.map((t) => (
                            <div key={t.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{t.name}</h3>
                                            <p className="text-sm text-gray-500 line-clamp-2">{t.description || 'No description'}</p>
                                        </div>
                                        {t.is_featured && (
                                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.category === 'cuisine' ? 'bg-purple-100 text-purple-700' :
                                            t.category === 'dietary' ? 'bg-green-100 text-green-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                            {t.category}
                                        </span>
                                        {t.is_default_for_new_users && (
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                                Default
                                            </span>
                                        )}
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                            <Download className="w-3 h-3 inline mr-1" />{t.download_count}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex justify-between">
                                    <button
                                        onClick={() => { setEditingTemplate(t); setShowEditor(true); }}
                                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t.id)}
                                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Editor Modal */}
            {showEditor && (
                <TemplateEditor
                    template={editingTemplate}
                    onSave={handleSave}
                    onClose={() => { setShowEditor(false); setEditingTemplate(null); }}
                    adminAPI={adminAPI}
                />
            )}
        </div>
    );
}
