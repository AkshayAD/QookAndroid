import React, { useState, useEffect } from 'react';
import { UserPreferences, PreferenceProfile, MealHistoryEntry } from '../types';
import { LearningSuggestions } from '../services/geminiService';
import { parsePreferencesViaProxy, optimizePreferencesViaProxy, getLearningSuggestionsViaProxy } from '../services/aiProxyService';
import { getHouseholdSettings, saveHouseholdSettings, HouseholdSettings } from '../services/supabaseService';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { getApiBaseUrl, isNative } from '../utils/platform';
import { X, Wand2, Save, History, Plus, User, Coffee, Sun, Moon, AlertCircle, Check, ThumbsUp, ThumbsDown, Trash2, ChevronDown, ChevronUp, Sparkles, Globe, MapPin, RotateCcw, Settings, Home, Camera, Lock, Image } from 'lucide-react';
import { QUICK_COOK_INSTRUCTION_OPTIONS } from '../constants';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Props {
    profiles: PreferenceProfile[];
    currentProfileId: string;
    history: MealHistoryEntry[];
    onSaveProfile: (profile: PreferenceProfile) => void;
    onSwitchProfile: (id: string) => void;
    onDeleteProfile?: (id: string) => void;
    onClose: () => void;
    onRerunOnboarding?: () => void;
}

const PreferencesModal: React.FC<Props> = ({ profiles, currentProfileId, history, onSaveProfile, onSwitchProfile, onDeleteProfile, onClose, onRerunOnboarding }) => {
    const { apiKey, modelName } = useSettings();
    const { user } = useAuth();
    const { canAccess } = useFeatureGate();
    const userId = user?.id || 'local';
    const aiConfig = { apiKey, modelName };

    // Feature access checks
    const canShowQuantities = canAccess('show_quantity');
    const canShowPrepAhead = canAccess('prep_ahead');

    const currentProfile = profiles.find(p => p.id === currentProfileId) || profiles[0];

    const [localPrefs, setLocalPrefs] = useState<UserPreferences>(currentProfile);
    const [profileName, setProfileName] = useState(currentProfile.name);
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [activeTab, setActiveTab] = useState<'settings' | 'general' | 'breakfast' | 'lunch' | 'dinner'>('general');
    const [learningSuggestions, setLearningSuggestions] = useState<LearningSuggestions | null>(null);
    const [showLearningModal, setShowLearningModal] = useState(false);
    const [mobileProfilesExpanded, setMobileProfilesExpanded] = useState(false);
    const [showAiImportPopup, setShowAiImportPopup] = useState(false);
    const [newMealItem, setNewMealItem] = useState('');

    // Sidebar navigation: 'household' for global settings, 'profile' for profile-specific
    const [sidebarMode, setSidebarMode] = useState<'household' | 'profile'>('profile');
    const [householdSettings, setHouseholdSettings] = useState<HouseholdSettings | null>(null);
    const [isSavingHousehold, setIsSavingHousehold] = useState(false);
    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Load household settings on mount
    useEffect(() => {
        const loadHouseholdSettings = async () => {
            const settings = await getHouseholdSettings(userId);
            setHouseholdSettings(settings);
        };
        loadHouseholdSettings();
    }, [userId]);

    // Handler to save household settings
    const handleSaveHouseholdSettings = async () => {
        if (!householdSettings) return;
        setIsSavingHousehold(true);
        try {
            await saveHouseholdSettings(userId, householdSettings);
            alert('Household settings saved!');
        } catch (err) {
            console.error('Error saving household settings:', err);
            alert('Failed to save settings.');
        }
        setIsSavingHousehold(false);
    };

    // Delete profile handler
    const handleDeleteProfile = (id: string) => {
        if (!onDeleteProfile) return;
        const profile = profiles.find(p => p.id === id);
        if (window.confirm(`Delete "${profile?.name}"? This cannot be undone.`)) {
            onDeleteProfile(id);
        }
    };

    // When switching profiles via internal dropdown
    const handleProfileSelect = (id: string) => {
        const newProfile = profiles.find(p => p.id === id);
        if (newProfile) {
            setLocalPrefs(newProfile);
            setProfileName(newProfile.name);
            onSwitchProfile(id);
        }
        setMobileProfilesExpanded(false); // Close mobile dropdown
    };

    const handleCreateNew = () => {
        // Generate proper UUID for Supabase compatibility
        const newId = crypto.randomUUID();
        // Keep General settings (dietaryType, allergies, dislikes, specialInstructions, pantryStaples)
        // BUT clear specific meal preferences so they can be fresh
        const newProfile: PreferenceProfile = {
            ...localPrefs,
            id: newId,
            name: "New Profile",
            breakfastPreferences: [],
            lunchPreferences: [],
            dinnerPreferences: []
        };

        onSaveProfile(newProfile);
        onSwitchProfile(newId);
        setProfileName("New Profile");
        setLocalPrefs(newProfile);
    };

    const handleAnalyze = async () => {
        if (!rawText.trim()) return;
        setIsAnalyzing(true);
        try {
            // Use Proxy for Parsing (Free)
            const newPrefs = await parsePreferencesViaProxy(userId, rawText, apiKey);
            // const newPrefs = await parsePreferencesFromText(rawText, aiConfig);

            setLocalPrefs(prev => {
                const updated = { ...prev };

                // Helper to append unique items to array
                const appendUnique = (current: string[], incoming: string[]) => {
                    return Array.from(new Set([...current, ...incoming]));
                };

                // Helper to append text with deduplication logic (simple includes check)
                const appendText = (current: string, incoming: string, separator: string = '\n') => {
                    if (!incoming || incoming === 'null' || incoming.trim() === '') return current;
                    if (!current) return incoming;
                    if (current.toLowerCase().includes(incoming.toLowerCase())) return current;
                    return `${current}${separator}${incoming}`;
                };

                // Merge Dietary Type
                if (newPrefs.dietaryType && newPrefs.dietaryType !== 'null') {
                    updated.dietaryType = appendText(prev.dietaryType, newPrefs.dietaryType, ', ');
                }

                // Merge Lists
                if (newPrefs.dislikes?.length) updated.dislikes = appendUnique(prev.dislikes, newPrefs.dislikes);
                if (newPrefs.allergies?.length) updated.allergies = appendUnique(prev.allergies, newPrefs.allergies);
                if (newPrefs.pantryStaples?.length) updated.pantryStaples = appendUnique(prev.pantryStaples, newPrefs.pantryStaples);

                // Merge Special Instructions (Crucial requirement: Append, don't replace)
                if (newPrefs.specialInstructions) {
                    updated.specialInstructions = appendText(prev.specialInstructions, newPrefs.specialInstructions, '\n\n');
                }

                // Merge Meal Preferences
                if (newPrefs.breakfastPreferences?.length) updated.breakfastPreferences = appendUnique(prev.breakfastPreferences, newPrefs.breakfastPreferences);
                if (newPrefs.lunchPreferences?.length) updated.lunchPreferences = appendUnique(prev.lunchPreferences, newPrefs.lunchPreferences);
                if (newPrefs.dinnerPreferences?.length) updated.dinnerPreferences = appendUnique(prev.dinnerPreferences, newPrefs.dinnerPreferences);

                return updated;
            });

            // Move to the relevant tab if specific meals were imported, else general
            if (newPrefs.breakfastPreferences?.length > 0) setActiveTab('breakfast');
            else if (newPrefs.lunchPreferences?.length > 0) setActiveTab('lunch');
            else if (newPrefs.dinnerPreferences?.length > 0) setActiveTab('dinner');
            else setActiveTab('general');

            setRawText(''); // Clear input after successful extract

        } catch (e: any) {
            const errorMessage = e?.message || 'Unknown error';
            if (errorMessage.includes('API Key') || errorMessage.includes('API key')) {
                alert(`API Key Error: ${errorMessage}`);
            } else {
                alert(`Failed to analyze text: ${errorMessage}`);
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOptimizeFromHistory = async () => {
        if (history.length === 0) {
            alert("No meal history available to learn from yet.");
            return;
        }
        setIsOptimizing(true);
        try {
            // Use Proxy for Learning Suggestions (Charged)
            const suggestions = await getLearningSuggestionsViaProxy(userId, localPrefs, history, apiKey);
            setLearningSuggestions(suggestions);
            setShowLearningModal(true);
        } catch (e) {
            alert("Failed to analyze history.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleApplyLearning = async () => {
        if (!learningSuggestions) return;
        setIsOptimizing(true);
        try {
            // Use Proxy for Optimization (Charged)
            const optimized = await optimizePreferencesViaProxy(userId, localPrefs, history, apiKey);
            setLocalPrefs(optimized);
            setShowLearningModal(false);
            setLearningSuggestions(null);
        } catch (e) {
            alert("Failed to apply learning.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleChange = (field: keyof UserPreferences, value: string) => {
        if (Array.isArray(localPrefs[field])) {
            setLocalPrefs({ ...localPrefs, [field]: value.split(',').map(s => s.trim()) });
        } else {
            setLocalPrefs({ ...localPrefs, [field]: value });
        }
    };

    const handleSave = () => {
        onSaveProfile({
            ...localPrefs,
            id: currentProfileId,
            name: profileName
        });
        onClose();
    }

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/50 md:bg-black/50 flex md:items-center md:justify-center z-50" style={{ minHeight: '100dvh' }}>
            <div className="bg-white w-full h-full md:rounded-2xl md:shadow-xl md:max-w-5xl md:h-[85vh] md:m-4 overflow-hidden flex flex-col">

                {/* Mobile Header - Redesigned */}
                <div className="md:hidden shrink-0 bg-white border-b border-gray-200">
                    {/* Row 1: Title with Close Button */}
                    <div className="flex items-center justify-between p-3 pb-2">
                        <h2 className="text-lg font-bold text-gray-900">
                            {sidebarMode === 'household' ? 'Household Settings' : 'Meal Preferences'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" title="Close">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Row 2: Mode Toggle Buttons */}
                    <div className="flex gap-2 px-3 pb-3">
                        <button
                            onClick={() => setSidebarMode('household')}
                            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${sidebarMode === 'household'
                                ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                                : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                                }`}
                        >
                            <Home className="w-4 h-4" />
                            Household
                        </button>
                        <button
                            onClick={() => setSidebarMode('profile')}
                            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${sidebarMode === 'profile'
                                ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                                : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                                }`}
                        >
                            <User className="w-4 h-4" />
                            Profiles
                        </button>
                    </div>

                    {/* Row 3: Profile-specific controls (only show when in profile mode) */}
                    {sidebarMode === 'profile' && (
                        <>
                            {/* Profile Name Editable Input */}
                            <div className="px-3 pb-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Profile Name</label>
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                                    placeholder="Enter profile name..."
                                />
                            </div>

                            {/* Profile Switcher + Actions */}
                            <div className="flex items-center gap-2 px-3 pb-3">
                                <div className="relative flex-1">
                                    <select
                                        value={currentProfileId}
                                        onChange={(e) => handleProfileSelect(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none pr-8"
                                    >
                                        {profiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                <button
                                    onClick={handleCreateNew}
                                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                                    title="New Profile"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                                {profiles.length > 1 && onDeleteProfile && (
                                    <button
                                        onClick={() => handleDeleteProfile(currentProfileId)}
                                        className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                        title="Delete Profile"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowAiImportPopup(!showAiImportPopup)}
                                    className="px-3 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl hover:opacity-90 flex items-center gap-1.5 transition-opacity"
                                    title="AI Import"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span className="text-xs font-bold">AI</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Mobile AI Import Popup */}
                {showAiImportPopup && (
                    <div className="md:hidden shrink-0 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3">
                        <div className="flex items-center gap-2 text-violet-800 mb-1">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm font-bold">Append with AI</span>
                            <button onClick={() => setShowAiImportPopup(false)} className="ml-auto p-1 hover:bg-violet-100 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-violet-500 mb-2">
                            Upload available groceries or modifications to the current meal plan
                        </p>
                        <textarea
                            className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none text-gray-900 resize-none"
                            placeholder="Paste meal ideas, grocery list, dietary needs..."
                            rows={2}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !rawText}
                                className="flex-1 px-3 py-2 bg-violet-600 text-white text-xs rounded-lg font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                                {isAnalyzing ? 'Extracting...' : <><Wand2 className="w-3 h-3" /> Append to List</>}
                            </button>
                        </div>

                        {/* Mobile Grocery Photo Upload */}
                        <div className="mt-3 flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <input
                                type="file"
                                id="mobileGroceryUpload"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    setIsAnalyzing(true);
                                    try {
                                        const reader = new FileReader();
                                        reader.onload = async () => {
                                            const base64 = (reader.result as string).split(',')[1];
                                            try {
                                                const response = await fetch(`${getApiBaseUrl()}/api/grocery-vision`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        userId,
                                                        imageData: base64,
                                                        imageType: file.type || 'image/jpeg'
                                                    })
                                                });
                                                const result = await response.json();
                                                if (result.success && result.groceries?.length > 0) {
                                                    const groceryText = result.groceries.map((g: any) =>
                                                        g.quantity && g.quantity !== 'some' ? `- ${g.item} (${g.quantity})` : `- ${g.item}`
                                                    ).join('\n');
                                                    setLocalPrefs(prev => ({
                                                        ...prev,
                                                        specialInstructions: (prev.specialInstructions || '') + '\n\nAvailable groceries:\n' + groceryText
                                                    }));
                                                    alert(`Found ${result.groceries.length} items! Added to your preferences.`);
                                                } else {
                                                    alert(result.error || 'No groceries detected. Try a clearer photo.');
                                                }
                                            } catch { alert('Failed to process image.'); }
                                            setIsAnalyzing(false);
                                        };
                                        reader.readAsDataURL(file);
                                    } catch { setIsAnalyzing(false); }
                                    e.target.value = '';
                                }}
                            />
                            <label
                                htmlFor="mobileGroceryUpload"
                                className={`flex-1 flex items-center gap-2 cursor-pointer hover:bg-emerald-100 rounded-lg p-2 -m-2 transition-colors ${isAnalyzing ? 'opacity-50' : ''}`}
                            >
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    {isAnalyzing ? <RotateCcw className="w-5 h-5 text-emerald-600 animate-spin" /> : <span className="text-lg">📷</span>}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-emerald-800">{isAnalyzing ? 'Analyzing...' : 'Upload Grocery Photo'}</p>
                                    <p className="text-xs text-emerald-600">Fridge, pantry, receipt, or order</p>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* Desktop + Mobile Content Wrapper */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                    {/* Desktop Sidebar - Hidden on Mobile */}
                    <div className="hidden md:flex w-64 bg-gray-50 border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto flex-col">
                        {/* Household Settings Button */}
                        <button
                            onClick={() => setSidebarMode('household')}
                            className={`w-full mb-4 px-3 py-2.5 flex items-center gap-3 rounded-xl transition-all ${sidebarMode === 'household'
                                ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 shadow-sm'
                                : 'bg-white border border-gray-200 hover:bg-amber-50 hover:border-amber-200'
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${sidebarMode === 'household' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                <Home className={`w-4 h-4 ${sidebarMode === 'household' ? 'text-amber-600' : 'text-gray-500'}`} />
                            </div>
                            <div className="text-left">
                                <span className={`text-sm font-semibold ${sidebarMode === 'household' ? 'text-amber-700' : 'text-gray-700'}`}>Household</span>
                                <p className="text-[10px] text-gray-400">Global settings</p>
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="border-t border-gray-200 mb-4"></div>

                        {/* Meal Profiles Section */}
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Meal Profiles</h3>
                        <div className="space-y-1 flex-1">
                            {profiles.map(p => (
                                <div key={p.id} className={`flex items-center rounded-lg transition-colors ${sidebarMode === 'profile' && currentProfileId === p.id ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-gray-100'}`}>
                                    <button
                                        onClick={() => { setSidebarMode('profile'); handleProfileSelect(p.id); }}
                                        className="flex-1 text-left px-3 py-2 flex items-center gap-2"
                                    >
                                        <User className="w-4 h-4 opacity-70" />
                                        <span className={`truncate text-sm font-medium ${sidebarMode === 'profile' && currentProfileId === p.id ? 'text-indigo-600' : 'text-gray-600'}`}>{p.name}</span>
                                    </button>
                                    {profiles.length > 1 && onDeleteProfile && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ opacity: 1 }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleCreateNew}
                            className="mt-4 w-full py-3 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> New Profile
                        </button>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Smart Learning</h3>
                            <p className="text-[10px] text-gray-500 mb-3 leading-tight">Refine this profile based on meals you've accepted in the past.</p>
                            <button
                                onClick={handleOptimizeFromHistory}
                                disabled={isOptimizing || history.length === 0}
                                className="w-full py-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-lg text-xs font-bold hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                            >
                                {isOptimizing ? <Wand2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                                Learn from History
                            </button>
                        </div>

                        {/* Re-run Onboarding Wizard */}
                        {onRerunOnboarding && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Setup Wizard</h3>
                                <p className="text-[10px] text-gray-500 mb-3 leading-tight">Re-run the guided setup to update preferences easily.</p>
                                <button
                                    onClick={() => {
                                        onClose();
                                        onRerunOnboarding();
                                    }}
                                    className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-xs font-bold hover:shadow-md flex items-center justify-center gap-2 transition-all"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Re-run Setup Wizard
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {sidebarMode === 'household' ? (
                            /* ===== HOUSEHOLD SETTINGS CONTENT ===== */
                            <>
                                {/* Header */}
                                <div className="hidden md:flex bg-white p-6 border-b justify-between items-center z-10 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-lg">
                                            <Home className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900">Household Settings</h2>
                                            <p className="text-sm text-gray-400">Global settings that apply to all meal profiles</p>
                                        </div>
                                    </div>
                                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                        <X className="w-6 h-6 text-gray-500" />
                                    </button>
                                </div>

                                {/* Household Form Content */}
                                <div className="p-6 overflow-y-auto flex-1 bg-white">
                                    {householdSettings ? (
                                        <div className="max-w-2xl space-y-6">
                                            {/* Location & Language */}
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                                        <MapPin className="w-4 h-4" /> Location & Language
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (!navigator.geolocation) {
                                                                alert('Geolocation is not supported by your browser');
                                                                return;
                                                            }
                                                            try {
                                                                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                                                                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                                                                });
                                                                const { latitude, longitude } = position.coords;
                                                                const response = await fetch(
                                                                    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                                                                    { headers: { 'Accept-Language': 'en' } }
                                                                );
                                                                const data = await response.json();
                                                                const detectedCity = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
                                                                const detectedCountry = data.address?.country || '';
                                                                if (detectedCity || detectedCountry) {
                                                                    // Use functional update to avoid stale closure
                                                                    setHouseholdSettings(prev => ({
                                                                        ...prev,
                                                                        city: detectedCity,
                                                                        country: detectedCountry || prev.country
                                                                    }));
                                                                }
                                                            } catch (error) {
                                                                alert('Unable to detect location. Please enter manually.');
                                                            }
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
                                                    >
                                                        <MapPin className="w-3 h-3" /> Auto-detect
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">City / Town</label>
                                                        <input
                                                            type="text"
                                                            value={householdSettings.city || ''}
                                                            onChange={(e) => setHouseholdSettings({ ...householdSettings, city: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                            placeholder="e.g., Mumbai, Delhi, Chandrapur"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                                                        <input
                                                            type="text"
                                                            value={householdSettings.country}
                                                            onChange={(e) => setHouseholdSettings({ ...householdSettings, country: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                            placeholder="e.g., India"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
                                                        <select
                                                            value={householdSettings.language}
                                                            onChange={(e) => setHouseholdSettings({ ...householdSettings, language: e.target.value as 'English' | 'Hindi' })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                        >
                                                            <option value="English">English</option>
                                                            <option value="Hindi">Hindi</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Household Size</label>
                                                        <select
                                                            value={householdSettings.householdSize}
                                                            onChange={(e) => setHouseholdSettings({ ...householdSettings, householdSize: parseInt(e.target.value) || 4 })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                        >
                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Portion Size</label>
                                                        <select
                                                            value={householdSettings.portionSize}
                                                            onChange={(e) => setHouseholdSettings({ ...householdSettings, portionSize: e.target.value as 'light' | 'regular' | 'hearty' })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                        >
                                                            <option value="light">Light</option>
                                                            <option value="regular">Regular</option>
                                                            <option value="hearty">Hearty</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pantry Staples */}
                                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-amber-800">🍳 Pantry Staples</h3>
                                                        <p className="text-xs text-amber-600">Meals will PRIORITIZE using these ingredients!</p>
                                                    </div>
                                                </div>

                                                {/* Camera/Gallery buttons for native, file upload for web */}
                                                <div className="flex gap-2 mb-3">
                                                    {isNative() ? (
                                                        <>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        setIsAnalyzing(true);
                                                                        const photo = await CapCamera.getPhoto({
                                                                            quality: 80,
                                                                            resultType: CameraResultType.Base64,
                                                                            source: CameraSource.Camera,
                                                                            allowEditing: false,
                                                                        });

                                                                        if (photo.base64String) {
                                                                            const response = await fetch(`${getApiBaseUrl()}/api/grocery-vision`, {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    userId,
                                                                                    imageData: photo.base64String,
                                                                                    imageType: `image/${photo.format || 'jpeg'}`
                                                                                })
                                                                            });
                                                                            const result = await response.json();
                                                                            if (result.success && result.groceries?.length > 0) {
                                                                                const newItems = result.groceries.map((g: any) => g.item);
                                                                                const currentItems = householdSettings.pantryStaples;
                                                                                const merged = [...new Set([...currentItems, ...newItems])];
                                                                                setHouseholdSettings({ ...householdSettings, pantryStaples: merged });
                                                                                alert(`Added ${newItems.length} items from photo to pantry!`);
                                                                            } else {
                                                                                alert('No items detected. Try a clearer photo.');
                                                                            }
                                                                        }
                                                                    } catch (e: any) {
                                                                        if (!e?.message?.includes('cancelled')) {
                                                                            console.error('Camera error:', e);
                                                                        }
                                                                    } finally {
                                                                        setIsAnalyzing(false);
                                                                    }
                                                                }}
                                                                disabled={isAnalyzing}
                                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-colors ${isAnalyzing ? 'opacity-50' : ''}`}
                                                            >
                                                                {isAnalyzing ? (
                                                                    <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                                                                ) : (
                                                                    <><Camera className="w-3.5 h-3.5" /> Camera</>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        setIsAnalyzing(true);
                                                                        let allNewItems: string[] = [];
                                                                        let photoCount = 0;
                                                                        let continueSelecting = true;

                                                                        // Loop to allow multiple photo selections
                                                                        while (continueSelecting) {
                                                                            try {
                                                                                const photo = await CapCamera.getPhoto({
                                                                                    quality: 80,
                                                                                    resultType: CameraResultType.Base64,
                                                                                    source: CameraSource.Photos,
                                                                                    allowEditing: false,
                                                                                });

                                                                                if (photo.base64String) {
                                                                                    photoCount++;
                                                                                    const response = await fetch(`${getApiBaseUrl()}/api/grocery-vision`, {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({
                                                                                            userId,
                                                                                            imageData: photo.base64String,
                                                                                            imageType: `image/${photo.format || 'jpeg'}`
                                                                                        })
                                                                                    });
                                                                                    const result = await response.json();
                                                                                    if (result.success && result.groceries?.length > 0) {
                                                                                        const newItems = result.groceries.map((g: any) => g.item);
                                                                                        allNewItems = [...allNewItems, ...newItems];
                                                                                    }
                                                                                }

                                                                                // Ask if user wants to add more photos
                                                                                continueSelecting = window.confirm(`Photo ${photoCount} processed. Add another photo?`);
                                                                            } catch (e: any) {
                                                                                if (e?.message?.includes('cancelled')) {
                                                                                    continueSelecting = false;
                                                                                } else {
                                                                                    throw e;
                                                                                }
                                                                            }
                                                                        }

                                                                        // Update pantry with all collected items
                                                                        if (allNewItems.length > 0) {
                                                                            const currentItems = householdSettings.pantryStaples;
                                                                            const merged = [...new Set([...currentItems, ...allNewItems])];
                                                                            setHouseholdSettings({ ...householdSettings, pantryStaples: merged });
                                                                            alert(`Added ${allNewItems.length} items from ${photoCount} photo(s) to pantry!`);
                                                                        } else if (photoCount > 0) {
                                                                            alert('No items detected. Try clearer photos.');
                                                                        }
                                                                    } catch (e: any) {
                                                                        if (!e?.message?.includes('cancelled')) {
                                                                            console.error('Gallery error:', e);
                                                                        }
                                                                    } finally {
                                                                        setIsAnalyzing(false);
                                                                    }
                                                                }}
                                                                disabled={isAnalyzing}
                                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors ${isAnalyzing ? 'opacity-50' : ''}`}
                                                            >
                                                                <Image className="w-3.5 h-3.5" /> Gallery +
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="file"
                                                                id="pantryGroceryUpload"
                                                                accept="image/*"
                                                                multiple
                                                                className="hidden"
                                                                onChange={async (e) => {
                                                                    const files = e.target.files;
                                                                    if (!files || files.length === 0) return;

                                                                    setIsAnalyzing(true);
                                                                    let allNewItems: string[] = [];
                                                                    let successCount = 0;

                                                                    for (let i = 0; i < files.length; i++) {
                                                                        const file = files[i];
                                                                        try {
                                                                            const base64 = await new Promise<string>((resolve) => {
                                                                                const reader = new FileReader();
                                                                                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                                                                                reader.readAsDataURL(file);
                                                                            });

                                                                            const response = await fetch('/api/grocery-vision', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    userId,
                                                                                    imageData: base64,
                                                                                    imageType: file.type || 'image/jpeg'
                                                                                })
                                                                            });
                                                                            const result = await response.json();
                                                                            if (result.success && result.groceries?.length > 0) {
                                                                                const newItems = result.groceries.map((g: any) => g.item);
                                                                                allNewItems = [...allNewItems, ...newItems];
                                                                                successCount++;
                                                                            }
                                                                        } catch { /* continue */ }
                                                                    }

                                                                    if (allNewItems.length > 0) {
                                                                        const currentItems = householdSettings.pantryStaples;
                                                                        const merged = [...new Set([...currentItems, ...allNewItems])];
                                                                        setHouseholdSettings({ ...householdSettings, pantryStaples: merged });
                                                                        alert(`Added ${allNewItems.length} items from ${successCount} photo(s)!`);
                                                                    } else {
                                                                        alert('No groceries detected. Try clearer images.');
                                                                    }
                                                                    setIsAnalyzing(false);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor="pantryGroceryUpload"
                                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium cursor-pointer hover:bg-emerald-200 transition-colors ${isAnalyzing ? 'opacity-50' : ''}`}
                                                            >
                                                                {isAnalyzing ? (
                                                                    <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                                                                ) : (
                                                                    <><Camera className="w-3.5 h-3.5" /> Upload Photo</>
                                                                )}
                                                            </label>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mb-3">Ingredients always available in your kitchen - these will be excluded from grocery lists</p>

                                                {/* Pill-based UI */}
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {householdSettings.pantryStaples.map((item, index) => (
                                                        <span
                                                            key={`${item}-${index}`}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium group hover:bg-amber-200 transition-colors"
                                                        >
                                                            {item}
                                                            <button
                                                                onClick={() => {
                                                                    const newStaples = householdSettings.pantryStaples.filter((_, i) => i !== index);
                                                                    setHouseholdSettings({ ...householdSettings, pantryStaples: newStaples });
                                                                }}
                                                                className="p-0.5 hover:bg-amber-300 rounded-full transition-colors"
                                                                title="Remove"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Add new staple input */}
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        id="newStapleInput"
                                                        placeholder="Add item (press Enter or comma)"
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                        onKeyDown={(e) => {
                                                            const input = e.target as HTMLInputElement;
                                                            const value = input.value.trim();

                                                            if ((e.key === 'Enter' || e.key === ',') && value) {
                                                                e.preventDefault();
                                                                // Split by comma in case user types multiple items
                                                                const newItems = value.split(',').map(s => s.trim()).filter(Boolean);
                                                                const currentItems = householdSettings.pantryStaples;
                                                                const merged = [...new Set([...currentItems, ...newItems])];
                                                                setHouseholdSettings({ ...householdSettings, pantryStaples: merged });
                                                                input.value = '';
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const input = document.getElementById('newStapleInput') as HTMLInputElement;
                                                            const value = input?.value.trim();
                                                            if (value) {
                                                                const newItems = value.split(',').map(s => s.trim()).filter(Boolean);
                                                                const currentItems = householdSettings.pantryStaples;
                                                                const merged = [...new Set([...currentItems, ...newItems])];
                                                                setHouseholdSettings({ ...householdSettings, pantryStaples: merged });
                                                                input.value = '';
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors flex items-center gap-1"
                                                    >
                                                        <Plus className="w-4 h-4" /> Add
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tiffin Settings */}
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                                <h3 className="text-sm font-semibold text-gray-700 mb-4">Tiffin / Packed Lunch</h3>
                                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={householdSettings.hasTiffin}
                                                        onChange={(e) => setHouseholdSettings({ ...householdSettings, hasTiffin: e.target.checked })}
                                                        className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">We pack tiffin/lunchbox</span>
                                                </label>
                                                {householdSettings.hasTiffin && (
                                                    <div className="space-y-4 mt-3 pl-7">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-2">Tiffin Days</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const days = householdSettings.tiffinDays;
                                                                            if (days.includes(day)) {
                                                                                setHouseholdSettings({ ...householdSettings, tiffinDays: days.filter(d => d !== day) });
                                                                            } else {
                                                                                setHouseholdSettings({ ...householdSettings, tiffinDays: [...days, day] });
                                                                            }
                                                                        }}
                                                                        className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${householdSettings.tiffinDays.includes(day)
                                                                            ? 'bg-amber-500 text-white'
                                                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                                            }`}
                                                                    >
                                                                        {day}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-2">Tiffin For</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['Office', 'School', 'College', 'Kids'].map(option => (
                                                                    <button
                                                                        key={option}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const forList = householdSettings.tiffinFor;
                                                                            if (forList.includes(option)) {
                                                                                setHouseholdSettings({ ...householdSettings, tiffinFor: forList.filter(f => f !== option) });
                                                                            } else {
                                                                                setHouseholdSettings({ ...householdSettings, tiffinFor: [...forList, option] });
                                                                            }
                                                                        }}
                                                                        className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${householdSettings.tiffinFor.includes(option)
                                                                            ? 'bg-amber-500 text-white'
                                                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                                            }`}
                                                                    >
                                                                        {option}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Display Preferences */}
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                                <h3 className="text-sm font-semibold text-gray-700 mb-4">Display Preferences</h3>
                                                <div className="space-y-3">
                                                    {/* Show Prep Reminders Toggle */}
                                                    <div className={`flex items-center justify-between p-3 rounded-xl ${canShowPrepAhead ? 'bg-amber-50 border border-amber-200' : 'bg-gray-100 border border-gray-300'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={canShowPrepAhead ? 'text-amber-600' : 'text-gray-400'}>🔔</span>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-sm font-bold ${canShowPrepAhead ? 'text-amber-800' : 'text-gray-500'}`}>Prep-Ahead Reminders</span>
                                                                    {!canShowPrepAhead && (
                                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                                                            <Lock className="w-3 h-3" /> Standard+
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={`text-xs ${canShowPrepAhead ? 'text-amber-600' : 'text-gray-400'}`}>
                                                                    {canShowPrepAhead ? 'Show overnight prep tasks on meal cards' : 'Upgrade to unlock this feature'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => canShowPrepAhead && setHouseholdSettings({ ...householdSettings, showPrepReminders: !householdSettings.showPrepReminders })}
                                                            disabled={!canShowPrepAhead}
                                                            className={`relative w-12 h-6 rounded-full transition-colors ${!canShowPrepAhead ? 'bg-gray-200 cursor-not-allowed' : householdSettings.showPrepReminders ? 'bg-amber-500' : 'bg-gray-300'}`}
                                                        >
                                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${canShowPrepAhead && householdSettings.showPrepReminders ? 'translate-x-6' : ''}`} />
                                                        </button>
                                                    </div>

                                                    {/* Show Quantities Toggle */}
                                                    <div className={`flex items-center justify-between p-3 rounded-xl ${canShowQuantities ? 'bg-blue-50 border border-blue-200' : 'bg-gray-100 border border-gray-300'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={canShowQuantities ? 'text-blue-600' : 'text-gray-400'}>📊</span>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-sm font-bold ${canShowQuantities ? 'text-blue-800' : 'text-gray-500'}`}>Show Quantities</span>
                                                                    {!canShowQuantities && (
                                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                                                            <Lock className="w-3 h-3" /> Standard+
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={`text-xs ${canShowQuantities ? 'text-blue-600' : 'text-gray-400'}`}>
                                                                    {canShowQuantities ? 'Display ingredient quantities on meal cards' : 'Upgrade to unlock this feature'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => canShowQuantities && setHouseholdSettings({ ...householdSettings, showQuantities: !householdSettings.showQuantities })}
                                                            disabled={!canShowQuantities}
                                                            className={`relative w-12 h-6 rounded-full transition-colors ${!canShowQuantities ? 'bg-gray-200 cursor-not-allowed' : householdSettings.showQuantities ? 'bg-blue-500' : 'bg-gray-300'}`}
                                                        >
                                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${canShowQuantities && householdSettings.showQuantities ? 'translate-x-6' : ''}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-32">
                                            <p className="text-gray-400">Loading...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Save Button Footer */}
                                <div className="hidden md:flex p-6 border-t justify-end gap-3 shrink-0 bg-white">
                                    <button onClick={onClose} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                    <button
                                        onClick={handleSaveHouseholdSettings}
                                        disabled={isSavingHousehold}
                                        className="px-8 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> {isSavingHousehold ? 'Saving...' : 'Save Household'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* ===== PROFILE SETTINGS CONTENT ===== */
                            <>
                                {/* Header - Hidden on mobile (already in profile bar) */}
                                <div className="hidden md:flex bg-white p-6 border-b justify-between items-center z-10 shrink-0">
                                    <div className="flex-1 mr-8">
                                        <input
                                            type="text"
                                            value={profileName}
                                            onChange={(e) => setProfileName(e.target.value)}
                                            className="text-2xl font-bold text-gray-900 border-none focus:ring-0 p-0 w-full placeholder-gray-300 focus:outline-none"
                                            placeholder="Profile Name"
                                        />
                                        <p className="text-sm text-gray-400">Manage detailed dietary preferences for the AI.</p>
                                    </div>
                                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                        <X className="w-6 h-6 text-gray-500" />
                                    </button>
                                </div>
                                {/* Tab Navigation */}
                                <div className="px-3 pt-3 sm:px-6 sm:pt-4 flex gap-2 overflow-x-auto shrink-0 border-b border-gray-100 pb-1">
                                    <TabButton id="general" label="Diet & Preferences" icon={AlertCircle} />
                                    <TabButton id="breakfast" label="Breakfast" icon={Coffee} />
                                    <TabButton id="lunch" label="Lunch" icon={Sun} />
                                    <TabButton id="dinner" label="Dinner" icon={Moon} />
                                </div>

                                {/* Tab Content */}
                                <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-white overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    <div className="max-w-3xl">
                                        {activeTab === 'general' && (
                                            <div className="space-y-5 animate-in fade-in duration-200">
                                                {/* AI Quick Import - Moved inside scrollable content */}
                                                <div data-tour="ai-extract" className="hidden md:block bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden">
                                                    <button
                                                        onClick={() => setShowAiImportPopup(!showAiImportPopup)}
                                                        className="w-full p-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-blue-900">
                                                            <Wand2 className="w-4 h-4" />
                                                            <span className="text-sm font-medium">Append with AI</span>
                                                        </div>
                                                        <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${showAiImportPopup ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    <p className="px-3 pb-2 text-xs text-blue-500/70 -mt-1">
                                                        Upload available groceries or modifications to the current meal plan
                                                    </p>
                                                    {showAiImportPopup && (
                                                        <div className="p-3 pt-0 space-y-3 border-t border-blue-100">
                                                            {/* Text Input */}
                                                            <div className="flex gap-2 items-start">
                                                                <textarea
                                                                    className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 resize-none"
                                                                    placeholder="Paste meal ideas, grocery list, dietary needs..."
                                                                    rows={2}
                                                                    value={rawText}
                                                                    onChange={(e) => setRawText(e.target.value)}
                                                                />
                                                                <button
                                                                    onClick={handleAnalyze}
                                                                    disabled={isAnalyzing || !rawText}
                                                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center justify-center gap-1"
                                                                >
                                                                    <Wand2 className="w-4 h-4" />
                                                                    {isAnalyzing ? '...' : 'Append'}
                                                                </button>
                                                            </div>

                                                            {/* Image Upload for Groceries */}
                                                            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                                                <input
                                                                    type="file"
                                                                    id="groceryImageUpload"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;

                                                                        setIsAnalyzing(true);
                                                                        try {
                                                                            const reader = new FileReader();
                                                                            reader.onload = async () => {
                                                                                const base64 = (reader.result as string).split(',')[1];
                                                                                try {
                                                                                    const response = await fetch('/api/grocery-vision', {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({
                                                                                            userId,
                                                                                            imageData: base64,
                                                                                            imageType: file.type || 'image/jpeg'
                                                                                        })
                                                                                    });
                                                                                    const result = await response.json();
                                                                                    if (result.success && result.groceries?.length > 0) {
                                                                                        const groceryText = result.groceries.map((g: any) =>
                                                                                            g.quantity && g.quantity !== 'some' ? `- ${g.item} (${g.quantity})` : `- ${g.item}`
                                                                                        ).join('\n');
                                                                                        setLocalPrefs(prev => ({
                                                                                            ...prev,
                                                                                            specialInstructions: (prev.specialInstructions || '') + '\n\nAvailable groceries:\n' + groceryText
                                                                                        }));
                                                                                        alert(`Found ${result.groceries.length} items! Added to your preferences.`);
                                                                                    } else {
                                                                                        alert(result.error || 'No groceries detected. Try a clearer photo.');
                                                                                    }
                                                                                } catch { alert('Failed to process image.'); }
                                                                                setIsAnalyzing(false);
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        } catch { setIsAnalyzing(false); }
                                                                        e.target.value = '';
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor="groceryImageUpload"
                                                                    className={`flex-1 flex items-center gap-2 cursor-pointer hover:bg-emerald-100 rounded-lg p-2 -m-2 transition-colors ${isAnalyzing ? 'opacity-50' : ''}`}
                                                                >
                                                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                                                        {isAnalyzing ? <RotateCcw className="w-5 h-5 text-emerald-600 animate-spin" /> : <span className="text-lg">📷</span>}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-emerald-800">{isAnalyzing ? 'Analyzing...' : 'Upload Grocery Photo'}</p>
                                                                        <p className="text-xs text-emerald-600">Fridge, pantry, receipt, or order screenshot</p>
                                                                    </div>
                                                                </label>
                                                            </div>

                                                            <p className="text-xs text-blue-600/60 text-center">
                                                                Add groceries to get meal suggestions using ingredients you already have
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Meals to Prepare */}
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">Meals to Prepare</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => {
                                                            const isSelected = localPrefs.mealsToPrepare?.includes(meal) ?? true;
                                                            return (
                                                                <button
                                                                    key={meal}
                                                                    onClick={() => {
                                                                        const current = localPrefs.mealsToPrepare ?? ['breakfast', 'lunch', 'dinner'];
                                                                        if (isSelected) {
                                                                            setLocalPrefs(prev => ({ ...prev, mealsToPrepare: current.filter(m => m !== meal) }));
                                                                        } else {
                                                                            setLocalPrefs(prev => ({ ...prev, mealsToPrepare: [...current, meal] }));
                                                                        }
                                                                    }}
                                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isSelected
                                                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 transform scale-105'
                                                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    {meal === 'breakfast' && <Sun className="w-4 h-4" />}
                                                                    {meal === 'lunch' && <Coffee className="w-4 h-4" />}
                                                                    {meal === 'dinner' && <Moon className="w-4 h-4" />}
                                                                    <span className="capitalize">{meal}</span>
                                                                    {isSelected && <Check className="w-3.5 h-3.5 ml-1" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Food Preference - Multi-select */}
                                                <div data-tour="dietary-type">
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">Food Preference (Multi-select)</label>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {[
                                                            { value: 'Vegetarian', label: 'Veg' },
                                                            { value: 'Vegetarian (with Eggs)', label: 'Veg + Eggs' },
                                                            { value: 'Non-Vegetarian', label: 'Non-Veg' }
                                                        ].map((opt) => {
                                                            const selected = localPrefs.dietaryTypes?.includes(opt.value) ?? (opt.value === 'Vegetarian');
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = localPrefs.dietaryTypes ?? ['Vegetarian'];
                                                                        if (selected) {
                                                                            if (current.length > 1) {
                                                                                setLocalPrefs(prev => ({ ...prev, dietaryTypes: current.filter(v => v !== opt.value), dietaryType: current.filter(v => v !== opt.value)[0] || 'Vegetarian' }));
                                                                            }
                                                                        } else {
                                                                            setLocalPrefs(prev => ({ ...prev, dietaryTypes: [...current, opt.value], dietaryType: opt.value }));
                                                                        }
                                                                    }}
                                                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                        }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={localPrefs.dietaryDetails ?? ''}
                                                        onChange={(e) => setLocalPrefs(prev => ({ ...prev, dietaryDetails: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        placeholder="More details (e.g., Jain, No onion/garlic)..."
                                                    />
                                                </div>

                                                {/* Non-Veg Preferences (conditional) */}
                                                {(localPrefs.dietaryTypes?.includes('Non-Vegetarian') || localPrefs.dietaryType === 'Non-Vegetarian') && (
                                                    <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                                                        <label className="block text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                            Select Meats & Eggs
                                                        </label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['Chicken', 'Mutton', 'Fish', 'Prawns', 'Crabs', 'Eggs'].map((item) => {
                                                                const isSelected = localPrefs.nonVegPreferences?.includes(item) ?? false;
                                                                return (
                                                                    <button
                                                                        key={item}
                                                                        onClick={() => {
                                                                            const current = localPrefs.nonVegPreferences ?? [];
                                                                            if (isSelected) {
                                                                                setLocalPrefs(prev => ({ ...prev, nonVegPreferences: current.filter(i => i !== item) }));
                                                                            } else {
                                                                                setLocalPrefs(prev => ({ ...prev, nonVegPreferences: [...current, item] }));
                                                                            }
                                                                        }}
                                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isSelected
                                                                            ? 'bg-amber-600 text-white shadow-sm'
                                                                            : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                                                                            }`}
                                                                    >
                                                                        {item}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Dislikes - Editable Checkbox List */}
                                                {/* Dislikes - Chips Layout */}
                                                <div data-tour="dislikes-input">
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">Dislikes / Restrictions ({localPrefs.dislikes.length})</label>

                                                    <div className="flex gap-2 mb-3">
                                                        <input
                                                            type="text"
                                                            id="newDislike"
                                                            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                                                            placeholder="Add dislike (e.g. Mushroom)..."
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                                    setLocalPrefs(prev => ({ ...prev, dislikes: [...prev.dislikes, (e.target as HTMLInputElement).value.trim()] }));
                                                                    (e.target as HTMLInputElement).value = '';
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const input = document.getElementById('newDislike') as HTMLInputElement;
                                                                if (input.value.trim()) {
                                                                    setLocalPrefs(prev => ({ ...prev, dislikes: [...prev.dislikes, input.value.trim()] }));
                                                                    input.value = '';
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 min-h-[40px] p-1">
                                                        {localPrefs.dislikes.map((item, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-100 group animate-in fade-in zoom-in duration-200">
                                                                <span className="text-sm font-medium">{item}</span>
                                                                <button
                                                                    onClick={() => setLocalPrefs(prev => ({ ...prev, dislikes: prev.dislikes.filter((_, i) => i !== idx) }))}
                                                                    className="p-0.5 hover:bg-red-200 rounded-full transition-colors"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {localPrefs.dislikes.length === 0 && (
                                                            <p className="text-sm text-gray-400 italic py-1">No restrictions added yet.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quick Cook Instructions (Toggles - Unticked by default) */}
                                                {/* Quick Cook Instructions (Cards) */}
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">Quick Cook Guidelines</label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {QUICK_COOK_INSTRUCTION_OPTIONS.map((instruction) => {
                                                            const isSelected = localPrefs.quickCookInstructions?.includes(instruction) ?? false;
                                                            return (
                                                                <button
                                                                    key={instruction}
                                                                    onClick={() => {
                                                                        const current = localPrefs.quickCookInstructions ?? [];
                                                                        if (isSelected) {
                                                                            setLocalPrefs(prev => ({ ...prev, quickCookInstructions: current.filter(i => i !== instruction) }));
                                                                        } else {
                                                                            setLocalPrefs(prev => ({ ...prev, quickCookInstructions: [...current, instruction] }));
                                                                        }
                                                                    }}
                                                                    className={`text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-2 ${isSelected
                                                                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                                                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>{instruction}</span>
                                                                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Special Instructions - Editable Checkbox List */}
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">Custom Instructions for Cook</label>
                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
                                                        {localPrefs.specialInstructions.split('\n').filter(Boolean).map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md group">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                                    <span className="text-sm font-medium text-gray-700">{item}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const lines = localPrefs.specialInstructions.split('\n').filter(Boolean);
                                                                        lines.splice(idx, 1);
                                                                        setLocalPrefs(prev => ({ ...prev, specialInstructions: lines.join('\n') }));
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {!localPrefs.specialInstructions.trim() && <p className="text-center text-gray-400 text-xs py-2">No custom instructions</p>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input type="text" id="newInstruction" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Add custom instruction..." onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                                const newLine = (e.target as HTMLInputElement).value.trim();
                                                                setLocalPrefs(prev => ({ ...prev, specialInstructions: prev.specialInstructions ? prev.specialInstructions + '\n' + newLine : newLine }));
                                                                (e.target as HTMLInputElement).value = '';
                                                            }
                                                        }} />
                                                        <button onClick={() => {
                                                            const input = document.getElementById('newInstruction') as HTMLInputElement;
                                                            if (input.value.trim()) {
                                                                const newLine = input.value.trim();
                                                                setLocalPrefs(prev => ({ ...prev, specialInstructions: prev.specialInstructions ? prev.specialInstructions + '\n' + newLine : newLine }));
                                                                input.value = '';
                                                            }
                                                        }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Plus className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(activeTab === 'breakfast' || activeTab === 'lunch' || activeTab === 'dinner') && (
                                            <div className="space-y-3 animate-in fade-in duration-200">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-sm font-bold text-gray-700 capitalize">{activeTab} Preferences</label>
                                                    <span className="text-xs text-gray-400">{localPrefs[`${activeTab}Preferences`].length} items</span>
                                                </div>

                                                {/* Checkbox List */}
                                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                                                    {localPrefs[`${activeTab}Preferences`].map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                                <span className="text-sm font-medium text-gray-700">{item}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                                    const current = [...(localPrefs[key] as string[])];
                                                                    current.splice(idx, 1);
                                                                    setLocalPrefs(prev => ({ ...prev, [key]: current }));
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {localPrefs[`${activeTab}Preferences`].length === 0 && (
                                                        <p className="text-center text-gray-400 text-sm py-4">No {activeTab} preferences yet. Add some below!</p>
                                                    )}
                                                </div>

                                                {/* Sample meals quick-add */}
                                                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                                    <p className="text-xs font-medium text-indigo-700 mb-2">Quick add popular {activeTab} items:</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(activeTab === 'breakfast' ? [
                                                            'Poha', 'Upma', 'Idli Sambar', 'Paratha with Curd', 'Dosa', 'Aloo Paratha',
                                                            'Besan Chilla', 'Bread Omelette', 'Masala Oats', 'Cornflakes with Milk'
                                                        ] : activeTab === 'lunch' ? [
                                                            'Dal Chawal', 'Rajma Rice', 'Chole Bhature', 'Roti Sabzi', 'Paneer Curry',
                                                            'Biryani', 'Khichdi', 'Kadhi Chawal', 'Sambar Rice', 'Thali'
                                                        ] : [
                                                            'Light Roti Sabzi', 'Dal Khichdi', 'Soup with Bread', 'Paratha with Dal',
                                                            'Pulao', 'Fried Rice', 'Paneer Tikka', 'Chapati with Curry', 'Dosa', 'Pasta'
                                                        ]).map(item => {
                                                            const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                            const isAdded = (localPrefs[key] as string[]).includes(item);
                                                            return (
                                                                <button
                                                                    key={item}
                                                                    onClick={() => {
                                                                        if (!isAdded) {
                                                                            setLocalPrefs(prev => ({
                                                                                ...prev,
                                                                                [key]: [...(prev[key] as string[]), item]
                                                                            }));
                                                                        }
                                                                    }}
                                                                    disabled={isAdded}
                                                                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${isAdded
                                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                                        : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                                                        }`}
                                                                >
                                                                    {item} {isAdded && '✓'}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Add New Item */}
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newMealItem}
                                                        onChange={(e) => setNewMealItem(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && newMealItem.trim()) {
                                                                const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                                setLocalPrefs(prev => ({
                                                                    ...prev,
                                                                    [key]: [...(prev[key] as string[]), newMealItem.trim()]
                                                                }));
                                                                setNewMealItem('');
                                                            }
                                                        }}
                                                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                        placeholder={`Add new ${activeTab} item...`}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (newMealItem.trim()) {
                                                                const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                                setLocalPrefs(prev => ({
                                                                    ...prev,
                                                                    [key]: [...(prev[key] as string[]), newMealItem.trim()]
                                                                }));
                                                                setNewMealItem('');
                                                            }
                                                        }}
                                                        disabled={!newMealItem.trim()}
                                                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Desktop Footer */}
                                <div className="hidden md:flex p-6 border-t justify-end gap-3 shrink-0 bg-white z-20">
                                    <button onClick={onClose} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                    <button
                                        onClick={handleSave}
                                        data-tour="save-preferences"
                                        className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                                    >
                                        <Save className="w-4 h-4" /> Save Profile
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Mobile Sticky Footer */}
                    <div className="md:hidden shrink-0 bg-white border-t border-gray-200 p-3 safe-area-pb">
                        <div className="flex items-center gap-2">
                            {onRerunOnboarding && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        onRerunOnboarding();
                                    }}
                                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:opacity-90 flex items-center justify-center gap-2 text-sm font-semibold transition-opacity"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Re-run Setup
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 flex items-center justify-center gap-2 text-sm font-bold shadow-lg transition-all"
                            >
                                <Check className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Learning Insights Modal */}
                    {showLearningModal && learningSuggestions && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-2 sm:p-4" style={{ minHeight: '100dvh' }}>
                            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                                <div className="p-5 border-b bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white">
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <History className="w-5 h-5" />
                                        What I Learned from Your History
                                    </h3>
                                    <p className="text-sm text-white/80 mt-1">
                                        Analyzed {learningSuggestions.totalMealsAnalyzed} rated meals
                                    </p>
                                </div>

                                <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                                    <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                                        <p className="text-gray-800 font-medium">{learningSuggestions.summary}</p>
                                    </div>

                                    {learningSuggestions.likedPatterns.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
                                                <ThumbsUp className="w-4 h-4 text-green-600" /> Patterns You Like
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {learningSuggestions.likedPatterns.map((p, i) => (
                                                    <span key={i} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">{p}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {learningSuggestions.dislikedPatterns.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
                                                <ThumbsDown className="w-4 h-4 text-red-500" /> Patterns to Avoid
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {learningSuggestions.dislikedPatterns.map((p, i) => (
                                                    <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">{p}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700 mb-2">Suggested Changes</h4>
                                        <div className="space-y-2 text-sm">
                                            {learningSuggestions.suggestedAdditions.breakfastPreferences.length > 0 && (
                                                <div className="flex items-start gap-2">
                                                    <Coffee className="w-4 h-4 text-amber-600 mt-0.5" />
                                                    <span className="text-gray-600"><strong>Breakfast:</strong> {learningSuggestions.suggestedAdditions.breakfastPreferences.join(', ')}</span>
                                                </div>
                                            )}
                                            {learningSuggestions.suggestedAdditions.lunchPreferences.length > 0 && (
                                                <div className="flex items-start gap-2">
                                                    <Sun className="w-4 h-4 text-orange-600 mt-0.5" />
                                                    <span className="text-gray-600"><strong>Lunch:</strong> {learningSuggestions.suggestedAdditions.lunchPreferences.join(', ')}</span>
                                                </div>
                                            )}
                                            {learningSuggestions.suggestedAdditions.dinnerPreferences.length > 0 && (
                                                <div className="flex items-start gap-2">
                                                    <Moon className="w-4 h-4 text-indigo-600 mt-0.5" />
                                                    <span className="text-gray-600"><strong>Dinner:</strong> {learningSuggestions.suggestedAdditions.dinnerPreferences.join(', ')}</span>
                                                </div>
                                            )}
                                            {learningSuggestions.suggestedAdditions.dislikes.length > 0 && (
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                                                    <span className="text-gray-600"><strong>Add to Dislikes:</strong> {learningSuggestions.suggestedAdditions.dislikes.join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
                                    <button onClick={() => { setShowLearningModal(false); setLearningSuggestions(null); }} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button onClick={handleApplyLearning} disabled={isOptimizing} className="px-6 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all">
                                        {isOptimizing ? <Wand2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Apply to Profile
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PreferencesModal;