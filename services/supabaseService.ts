/**
 * Supabase Data Service
 * Handles all CRUD operations for QookCommander with Supabase backend.
 * Falls back gracefully to localStorage when Supabase is not configured or user is in offline mode.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { buildInventorySummary, summarizePreferenceSignals } from './plannerMemoryService';
import { sanitizeDayPlan, sanitizeWeeklyPlan } from '../lib/mealSanitizer';

// Re-export supabase for direct use in realtime subscriptions
export { supabase };
import {
    PreferenceProfile,
    WeeklyPlan,
    DayPlan,
    Schedule,
    GroceryItem,
    InventoryItem,
    MealHistoryEntry,
    MealType,
    PreferenceSignal,
    SavedGroceryList
} from '../types';

// Helper to check if we should use localStorage instead of Supabase
// Returns true if Supabase is not configured OR if user is in "local/offline" mode
export const isOfflineMode = (userId: string): boolean => {
    const offline = !isSupabaseConfigured || !supabase || userId === 'local';
    console.log('[SUPABASE DEBUG] isOfflineMode check:', { isSupabaseConfigured, supabaseExists: !!supabase, userId, result: offline });
    return offline;
};

const INVENTORY_ITEMS_KEY = 'qookcommander_inventory_items';
const PREFERENCE_SIGNALS_KEY = 'qookcommander_preference_signals';

function isMissingRelationError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const message = 'message' in error ? String(error.message || '') : '';
    const details = 'details' in error ? String(error.details || '') : '';
    return /relation .* does not exist/i.test(message) || /relation .* does not exist/i.test(details);
}

function readLocalCollection<T>(key: string): T[] {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
}

function writeLocalCollection<T>(key: string, data: T[]) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ============================================================================
// USER SETTINGS (Cross-device sync for API key, Cook contact)
// ============================================================================

export interface UserSettings {
    geminiApiKey: string;
    cookName: string;
    cookWhatsappNumber: string;
    currentProfileId?: string;
    preferredLanguage?: 'English' | 'Hindi';
    onboardingCompleted?: boolean;
    displayName?: string;
}

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        return {
            geminiApiKey: localStorage.getItem('gemini_api_key') || '',
            cookName: localStorage.getItem('cook_name') || '',
            cookWhatsappNumber: localStorage.getItem('cook_number') || '',
            currentProfileId: localStorage.getItem('cookcommander_current_profile_id') || undefined,
            preferredLanguage: (localStorage.getItem('cookcommander_preferred_language') as 'English' | 'Hindi') || 'English',
            onboardingCompleted: localStorage.getItem('qook_onboarding_completed') === 'true',
            displayName: localStorage.getItem('cookcommander_display_name') || ''
        };
    }

    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error fetching user settings:', error);
            return null;
        }

        if (!data) return null;

        return {
            geminiApiKey: data.gemini_api_key || '',
            cookName: data.cook_name || '',
            cookWhatsappNumber: data.cook_whatsapp_number || '',
            currentProfileId: data.current_profile_id || undefined,
            preferredLanguage: (data.preferred_language as 'English' | 'Hindi') || 'English',
            onboardingCompleted: data.onboarding_completed ?? false,
            displayName: data.display_name || ''
        };
    } catch (err) {
        console.error('Error in getUserSettings:', err);
        return null;
    }
};

export const saveUserSettings = async (userId: string, settings: Partial<UserSettings>): Promise<void> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        if (settings.geminiApiKey !== undefined) localStorage.setItem('gemini_api_key', settings.geminiApiKey);
        if (settings.cookName !== undefined) localStorage.setItem('cook_name', settings.cookName);
        if (settings.cookWhatsappNumber !== undefined) localStorage.setItem('cook_number', settings.cookWhatsappNumber);
        if (settings.currentProfileId !== undefined) localStorage.setItem('cookcommander_current_profile_id', settings.currentProfileId);
        if (settings.preferredLanguage !== undefined) localStorage.setItem('cookcommander_preferred_language', settings.preferredLanguage);
        if (settings.onboardingCompleted !== undefined) localStorage.setItem('qook_onboarding_completed', String(settings.onboardingCompleted));
        if (settings.displayName !== undefined) localStorage.setItem('cookcommander_display_name', settings.displayName);
        return;
    }

    try {
        const updateData: any = { user_id: userId, updated_at: new Date().toISOString() };
        if (settings.geminiApiKey !== undefined) updateData.gemini_api_key = settings.geminiApiKey;
        if (settings.cookName !== undefined) updateData.cook_name = settings.cookName;
        if (settings.cookWhatsappNumber !== undefined) updateData.cook_whatsapp_number = settings.cookWhatsappNumber;
        if (settings.currentProfileId !== undefined) updateData.current_profile_id = settings.currentProfileId;
        if (settings.preferredLanguage !== undefined) updateData.preferred_language = settings.preferredLanguage;
        if (settings.onboardingCompleted !== undefined) updateData.onboarding_completed = settings.onboardingCompleted;
        if (settings.displayName !== undefined) updateData.display_name = settings.displayName;

        const { error } = await supabase
            .from('user_settings')
            .upsert(updateData, { onConflict: 'user_id' });

        if (error) {
            console.error('Error saving user settings:', error);
            throw error;
        }
    } catch (err) {
        console.error('Error in saveUserSettings:', err);
        throw err;
    }
};

// ============================================================================
// USER PROFILE (From user_profiles table - display_name, phone, city)
// ============================================================================

export interface UserProfile {
    displayName: string;
    phone: string;
    city: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('display_name, phone, city')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching user profile:', error);
            return null;
        }

        if (!data) return null;

        return {
            displayName: data.display_name || '',
            phone: data.phone || '',
            city: data.city || ''
        };
    } catch (err) {
        console.error('Error in getUserProfile:', err);
        return null;
    }
};

export const saveUserProfile = async (userId: string, profile: Partial<UserProfile>): Promise<void> => {
    try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (profile.displayName !== undefined) updateData.display_name = profile.displayName;
        if (profile.phone !== undefined) updateData.phone = profile.phone;
        if (profile.city !== undefined) updateData.city = profile.city;

        const { error } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', userId);

        if (error) {
            console.error('Error saving user profile:', error);
            throw error;
        }
    } catch (err) {
        console.error('Error in saveUserProfile:', err);
        throw err;
    }
};

// ============================================================================
// HOUSEHOLD SETTINGS (Global settings shared across all profiles)
// ============================================================================

export interface HouseholdSettings {
    city: string;
    country: string;
    language: 'English' | 'Hindi';
    householdSize: number;
    portionSize: 'light' | 'regular' | 'hearty';
    pantryStaples: string[];
    hasTiffin: boolean;
    tiffinDays: string[];
    tiffinFor: string[];
    showPrepReminders: boolean;
    showQuantities: boolean;
}

const defaultHouseholdSettings: HouseholdSettings = {
    city: '',
    country: 'India',
    language: 'English',
    householdSize: 4,
    portionSize: 'regular',
    pantryStaples: [],
    hasTiffin: false,
    tiffinDays: [],
    tiffinFor: [],
    showPrepReminders: true,
    showQuantities: true,
};

export const getHouseholdSettings = async (userId: string): Promise<HouseholdSettings> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        const saved = localStorage.getItem('cookcommander_household_settings');
        if (saved) {
            return { ...defaultHouseholdSettings, ...JSON.parse(saved) };
        }
        return defaultHouseholdSettings;
    }

    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('city, country, household_size, portion_size, pantry_staples, has_tiffin, tiffin_days, tiffin_for, show_prep_reminders, show_quantities, preferred_language')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching household settings:', error);
            return defaultHouseholdSettings;
        }

        if (!data) return defaultHouseholdSettings;

        return {
            city: data.city || '',
            country: data.country || 'India',
            language: (data.preferred_language as 'English' | 'Hindi') || 'English',
            householdSize: data.household_size || 4,
            portionSize: (data.portion_size as 'light' | 'regular' | 'hearty') || 'regular',
            pantryStaples: data.pantry_staples || [],
            hasTiffin: data.has_tiffin ?? false,
            tiffinDays: data.tiffin_days || [],
            tiffinFor: data.tiffin_for || [],
            showPrepReminders: data.show_prep_reminders ?? true,
            showQuantities: data.show_quantities ?? true,
        };
    } catch (err) {
        console.error('Error in getHouseholdSettings:', err);
        return defaultHouseholdSettings;
    }
};

export const saveHouseholdSettings = async (userId: string, settings: Partial<HouseholdSettings>): Promise<void> => {
    console.log('[SUPABASE DEBUG] saveHouseholdSettings called:', { userId, settings });
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        console.log('[SUPABASE DEBUG] OFFLINE MODE - saving to localStorage only!');
        const current = await getHouseholdSettings(userId);
        const updated = { ...current, ...settings };
        localStorage.setItem('cookcommander_household_settings', JSON.stringify(updated));
        return;
    }
    console.log('[SUPABASE DEBUG] ONLINE MODE - saving to Supabase');

    try {
        const updateData: any = { user_id: userId, updated_at: new Date().toISOString() };
        if (settings.city !== undefined) updateData.city = settings.city;
        if (settings.country !== undefined) updateData.country = settings.country;
        if (settings.language !== undefined) updateData.preferred_language = settings.language;
        if (settings.householdSize !== undefined) updateData.household_size = settings.householdSize;
        if (settings.portionSize !== undefined) updateData.portion_size = settings.portionSize;
        if (settings.pantryStaples !== undefined) updateData.pantry_staples = settings.pantryStaples;
        if (settings.hasTiffin !== undefined) updateData.has_tiffin = settings.hasTiffin;
        if (settings.tiffinDays !== undefined) updateData.tiffin_days = settings.tiffinDays;
        if (settings.tiffinFor !== undefined) updateData.tiffin_for = settings.tiffinFor;
        if (settings.showPrepReminders !== undefined) updateData.show_prep_reminders = settings.showPrepReminders;
        if (settings.showQuantities !== undefined) updateData.show_quantities = settings.showQuantities;

        console.log('[SUPABASE DEBUG] Upserting to user_settings:', updateData);
        const { error } = await supabase
            .from('user_settings')
            .upsert(updateData, { onConflict: 'user_id' });

        if (error) {
            console.error('[SUPABASE DEBUG] ERROR saving household settings:', error);
            throw error;
        }
        console.log('[SUPABASE DEBUG] SUCCESS - household settings saved to Supabase');
    } catch (err) {
        console.error('Error in saveHouseholdSettings:', err);
        throw err;
    }
};

// ============================================================================
// HELPER: Convert between app types and database types
// ============================================================================

interface PreferenceProfileRow {
    id: string;
    user_id: string;
    name: string;
    dietary_type: string | null;
    dietary_types: string[] | null;
    dietary_details: string | null;
    allergies: string[] | null;
    dislikes: string[] | null;
    breakfast_preferences: string[] | null;
    lunch_preferences: string[] | null;
    dinner_preferences: string[] | null;
    special_instructions: string | null;
    pantry_staples: string[] | null;
    meals_to_prepare: string[] | null;
    non_veg_preferences: string[] | null;
    language: string | null;
    quick_cook_instructions: string[] | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

interface ScheduledMealRow {
    id: string;
    user_id: string;
    date: string;
    breakfast: string | null;
    lunch: string | null;
    dinner: string | null;
    created_at: string;
    updated_at: string;
}

const profileRowToApp = (row: PreferenceProfileRow): PreferenceProfile => ({
    id: row.id,
    name: row.name,
    dietaryType: row.dietary_type || '',
    dietaryTypes: row.dietary_types || [],
    dietaryDetails: row.dietary_details || '',
    allergies: row.allergies || [],
    dislikes: row.dislikes || [],
    breakfastPreferences: row.breakfast_preferences || [],
    lunchPreferences: row.lunch_preferences || [],
    dinnerPreferences: row.dinner_preferences || [],
    specialInstructions: row.special_instructions || '',
    pantryStaples: row.pantry_staples || [],
    mealsToPrepare: (row.meals_to_prepare || ['breakfast', 'lunch', 'dinner']) as ('breakfast' | 'lunch' | 'dinner')[],
    nonVegPreferences: row.non_veg_preferences || [],
    language: (row.language || 'English') as 'English' | 'Hindi',
    quickCookInstructions: row.quick_cook_instructions || [],
});

const profileAppToRow = (profile: PreferenceProfile, userId: string) => ({
    id: profile.id,
    user_id: userId,
    name: profile.name,
    dietary_type: profile.dietaryType,
    dietary_types: profile.dietaryTypes || [],
    dietary_details: profile.dietaryDetails || '',
    allergies: profile.allergies,
    dislikes: profile.dislikes,
    breakfast_preferences: profile.breakfastPreferences,
    lunch_preferences: profile.lunchPreferences,
    dinner_preferences: profile.dinnerPreferences,
    special_instructions: profile.specialInstructions,
    pantry_staples: profile.pantryStaples,
    meals_to_prepare: profile.mealsToPrepare || ['breakfast', 'lunch', 'dinner'],
    non_veg_preferences: profile.nonVegPreferences || [],
    language: profile.language || 'English',
    quick_cook_instructions: profile.quickCookInstructions || [],
});

const scheduledMealRowToDay = (row: ScheduledMealRow): DayPlan => ({
    day: row.date,
    breakfast: row.breakfast || '',
    lunch: row.lunch || '',
    dinner: row.dinner || '',
});

// ============================================================================
// PREFERENCE PROFILES
// ============================================================================

export const getPreferenceProfiles = async (userId: string): Promise<PreferenceProfile[]> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_profiles');
        return saved ? JSON.parse(saved) : [];
    }

    const { data, error } = await supabase
        .from('preference_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching profiles:', error);
        throw error;
    }

    return (data || []).map((row: any) => profileRowToApp(row as PreferenceProfileRow));
};

export const savePreferenceProfile = async (
    profile: PreferenceProfile,
    userId: string
): Promise<PreferenceProfile> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        const saved = localStorage.getItem('qookcommander_profiles');
        const profiles: PreferenceProfile[] = saved ? JSON.parse(saved) : [];
        const existingIdx = profiles.findIndex(p => p.id === profile.id);

        if (existingIdx >= 0) {
            profiles[existingIdx] = profile;
        } else {
            profiles.push(profile);
        }

        localStorage.setItem('qookcommander_profiles', JSON.stringify(profiles));
        return profile;
    }

    const rowData = profileAppToRow(profile, userId);

    const { data, error } = await supabase
        .from('preference_profiles')
        .upsert(rowData as any)
        .select()
        .single();

    if (error) {
        console.error('Error saving profile:', error);
        throw error;
    }

    return profileRowToApp(data as PreferenceProfileRow);
};

export const deletePreferenceProfile = async (profileId: string, userId: string = 'local'): Promise<void> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_profiles');
        const profiles: PreferenceProfile[] = saved ? JSON.parse(saved) : [];
        const filtered = profiles.filter(p => p.id !== profileId);
        localStorage.setItem('qookcommander_profiles', JSON.stringify(filtered));
        return;
    }

    const { error } = await supabase
        .from('preference_profiles')
        .delete()
        .eq('id', profileId);

    if (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
};

// ============================================================================
// WEEKLY PLANS
// ============================================================================

export const getCurrentPlan = async (userId: string, familyGroupId?: string | null): Promise<WeeklyPlan | null> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_plan');
        return saved ? sanitizeWeeklyPlan(JSON.parse(saved)) : null;
    }

    let query = supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current', true);

    // Filter by family or personal
    if (familyGroupId) {
        query = query.eq('family_group_id', familyGroupId);
    } else {
        query = query.is('family_group_id', null);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        // PGRST116 = no rows returned for single(), 406 = Not Acceptable (often means no/multiple rows)
        if (error.code === 'PGRST116' || error.message?.includes('406')) return null;
        console.error('Error fetching plan:', error);
        throw error;
    }

    return sanitizeWeeklyPlan({ days: data.days as DayPlan[] });
};

export const savePlan = async (
    plan: WeeklyPlan,
    userId: string,
    profileId?: string,
    familyGroupId?: string | null
): Promise<string> => {
    const sanitizedPlan = sanitizeWeeklyPlan(plan);
    if (isOfflineMode(userId)) {
        localStorage.setItem('qookcommander_plan', JSON.stringify(sanitizedPlan));
        return 'local';
    }

    // Mark all existing as not current (for this user/family context)
    let updateQuery = supabase
        .from('weekly_plans')
        .update({ is_current: false })
        .eq('user_id', userId);

    if (familyGroupId) {
        updateQuery = updateQuery.eq('family_group_id', familyGroupId);
    } else {
        updateQuery = updateQuery.is('family_group_id', null);
    }
    await updateQuery;

    const insertData: any = {
        user_id: userId,
        profile_id: profileId,
        days: sanitizedPlan.days as any,
        is_current: true,
    };

    if (familyGroupId) {
        insertData.family_group_id = familyGroupId;
    }

    const { data, error } = await supabase
        .from('weekly_plans')
        .insert(insertData)
        .select('id')
        .single();

    if (error) {
        console.error('Error saving plan:', error);
        throw error;
    }

    return data.id;
};

export const clearCurrentPlan = async (userId: string, familyGroupId?: string | null): Promise<void> => {
    if (isOfflineMode(userId)) {
        localStorage.removeItem('qookcommander_plan');
        return;
    }

    let updateQuery = supabase
        .from('weekly_plans')
        .update({ is_current: false })
        .eq('user_id', userId)
        .eq('is_current', true);

    if (familyGroupId) {
        updateQuery = updateQuery.eq('family_group_id', familyGroupId);
    } else {
        updateQuery = updateQuery.is('family_group_id', null);
    }

    await updateQuery;
};

// ============================================================================
// SCHEDULED MEALS (Calendar)
// ============================================================================

export const getSchedule = async (
    userId: string,
    startDate?: string,
    endDate?: string,
    familyGroupId?: string | null  // Optional: when provided, fetch family meals instead of personal
): Promise<Schedule> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        const rawSchedule: Schedule = saved ? JSON.parse(saved) : {};
        return Object.fromEntries(
            Object.entries(rawSchedule).map(([date, dayPlan]) => [date, sanitizeDayPlan(dayPlan)])
        );
    }

    let query = supabase
        .from('scheduled_meals')
        .select('*');

    // If familyGroupId is provided, fetch family meals; otherwise fetch personal meals
    if (familyGroupId) {
        query = query.eq('family_group_id', familyGroupId);
    } else {
        query = query.eq('user_id', userId).is('family_group_id', null);
    }

    if (startDate) {
        query = query.gte('date', startDate);
    }
    if (endDate) {
        query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }

    const schedule: Schedule = {};
    (data || []).forEach((row: any) => {
        schedule[row.date] = sanitizeDayPlan({
            day: row.date,
            breakfast: row.breakfast || '',
            lunch: row.lunch || '',
            dinner: row.dinner || '',
            prepAhead: row.prep_ahead || undefined,
            alternatives: row.alternatives || null  // Load alternatives
        });
    });

    return schedule;
};

export const saveScheduledMeal = async (
    date: string,
    dayPlan: DayPlan,
    userId: string,
    familyGroupId?: string | null  // Optional: when provided, save as family meal
): Promise<void> => {
    const sanitizedDayPlan = sanitizeDayPlan(dayPlan);
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        const schedule: Schedule = saved ? JSON.parse(saved) : {};
        schedule[date] = sanitizedDayPlan;
        localStorage.setItem('qookcommander_schedule', JSON.stringify(schedule));
        return;
    }

    // First, delete any existing row for this user+date+family combination
    // This ensures we don't violate the unique constraint
    let deleteQuery = supabase
        .from('scheduled_meals')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);

    if (familyGroupId) {
        deleteQuery = deleteQuery.eq('family_group_id', familyGroupId);
    } else {
        deleteQuery = deleteQuery.is('family_group_id', null);
    }

    await deleteQuery;

    // Now insert the new/updated row
    const mealData: any = {
        user_id: userId,
        date: date,
        breakfast: sanitizedDayPlan.breakfast || null,
        lunch: sanitizedDayPlan.lunch || null,
        dinner: sanitizedDayPlan.dinner || null,
        prep_ahead: sanitizedDayPlan.prepAhead || null,
        alternatives: sanitizedDayPlan.alternatives || null,
    };

    // If saving as family meal, set family_group_id and last_modified_by
    if (familyGroupId) {
        mealData.family_group_id = familyGroupId;
        mealData.last_modified_by = userId;
    }

    const { error } = await supabase
        .from('scheduled_meals')
        .insert(mealData);

    if (error) {
        console.error('Error saving scheduled meal:', error);
        throw error;
    }
};

export const archivePlanToSchedule = async (
    plan: WeeklyPlan,
    startDate: string,
    userId: string,
    familyGroupId?: string | null  // Optional: save as family meals
): Promise<void> => {
    const sanitizedPlan = sanitizeWeeklyPlan(plan);
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        const schedule: Schedule = saved ? JSON.parse(saved) : {};

        sanitizedPlan.days.forEach((day, idx) => {
            const date = addDays(startDate, idx);
            schedule[date] = { ...day, day: date };
        });

        localStorage.setItem('qookcommander_schedule', JSON.stringify(schedule));
        localStorage.removeItem('qookcommander_plan');
        return;
    }

    const rows = sanitizedPlan.days.map((day, idx) => {
        const row: any = {
            user_id: userId,
            date: addDays(startDate, idx),
            breakfast: day.breakfast || null,
            lunch: day.lunch || null,
            dinner: day.dinner || null,
            prep_ahead: day.prepAhead || null,
            alternatives: sanitizedPlan.alternatives || null,
        };
        // Add family_group_id if saving for family
        if (familyGroupId) {
            row.family_group_id = familyGroupId;
            row.last_modified_by = userId;
        }
        return row;
    });

    // Delete existing meals for these dates (respecting family/personal isolation)
    const dates = rows.map(r => r.date);
    let deleteQuery = supabase
        .from('scheduled_meals')
        .delete()
        .eq('user_id', userId)
        .in('date', dates);

    if (familyGroupId) {
        deleteQuery = deleteQuery.eq('family_group_id', familyGroupId);
    } else {
        deleteQuery = deleteQuery.is('family_group_id', null);
    }

    await deleteQuery;

    // Insert the new rows
    const { error } = await supabase
        .from('scheduled_meals')
        .insert(rows as any);

    if (error) {
        console.error('Error archiving plan:', error);
        throw error;
    }

    // Clear current plan (for this context - personal or family)
    await clearCurrentPlan(userId, familyGroupId);
};

// Helper to add days to a date string
const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

// ============================================================================
// GROCERY LISTS
// ============================================================================

export const saveGroceryList = async (
    items: GroceryItem[],
    userId: string,
    planId?: string
): Promise<void> => {
    if (isOfflineMode(userId)) {
        // Grocery list is ephemeral in the app, not saved to localStorage currently
        return;
    }

    const { error } = await supabase
        .from('grocery_lists')
        .insert({
            user_id: userId,
            plan_id: planId,
            items: items as any,
        });

    if (error) {
        console.error('Error saving grocery list:', error);
        throw error;
    }
};

// ============================================================================
// MEAL HISTORY (for AI learning)
// ============================================================================

export const getMealHistory = async (
    userId: string,
    limit: number = 100
): Promise<MealHistoryEntry[]> => {
    if (isOfflineMode(userId)) {
        // Derive from schedule in offline mode
        const saved = localStorage.getItem('qookcommander_schedule');
        const schedule: Schedule = saved ? JSON.parse(saved) : {};

        const history: MealHistoryEntry[] = [];
        Object.entries(schedule).forEach(([date, plan]) => {
            const dayPlan = plan as DayPlan;
            if (dayPlan.breakfast) history.push({ date, type: 'Breakfast', mealName: dayPlan.breakfast });
            if (dayPlan.lunch) history.push({ date, type: 'Lunch', mealName: dayPlan.lunch });
            if (dayPlan.dinner) history.push({ date, type: 'Dinner', mealName: dayPlan.dinner });
        });

        return history.slice(-limit);
    }

    const { data, error } = await supabase
        .from('meal_history')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching meal history:', error);
        throw error;
    }

    return (data || []).map((row: any) => ({
        date: row.date,
        type: row.meal_type as MealType,
        mealName: row.meal_name,
        rating: row.rating as 'liked' | 'disliked' | undefined,
    }));
};

export const saveMealHistory = async (
    entries: MealHistoryEntry[],
    userId: string
): Promise<void> => {
    if (isOfflineMode(userId)) {
        return; // History is derived from schedule in offline mode
    }

    const rows = entries.map(entry => ({
        user_id: userId,
        date: entry.date,
        meal_type: entry.type,
        meal_name: entry.mealName,
        rating: entry.rating || null,
    }));

    const { error } = await supabase
        .from('meal_history')
        .insert(rows as any);

    if (error) {
        console.error('Error saving meal history:', error);
        throw error;
    }
};

// ============================================================================
// INVENTORY ITEMS
// ============================================================================

function filterInventoryByContext(items: InventoryItem[], familyGroupId?: string | null): InventoryItem[] {
    return items.filter((item) => (item.familyGroupId || null) === (familyGroupId || null));
}

function mapInventoryRow(row: any): InventoryItem {
    return {
        id: row.id,
        name: row.name,
        source: row.source,
        capturedAt: row.captured_at || row.capturedAt || new Date().toISOString(),
        expiresAt: row.expires_at || row.expiresAt || null,
        status: row.status || 'active',
        confidence: row.confidence ?? null,
        familyGroupId: row.family_group_id || row.familyGroupId || null,
    };
}

export const getInventoryItems = async (
    userId: string,
    familyGroupId?: string | null
): Promise<InventoryItem[]> => {
    if (isOfflineMode(userId)) {
        return filterInventoryByContext(readLocalCollection<InventoryItem>(INVENTORY_ITEMS_KEY), familyGroupId)
            .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    }

    try {
        let query = supabase
            .from('inventory_items')
            .select('*')
            .eq('user_id', userId)
            .order('captured_at', { ascending: false });

        if (familyGroupId) {
            query = query.eq('family_group_id', familyGroupId);
        } else {
            query = query.is('family_group_id', null);
        }

        const { data, error } = await query;

        if (error) {
            if (isMissingRelationError(error)) {
                return filterInventoryByContext(readLocalCollection<InventoryItem>(INVENTORY_ITEMS_KEY), familyGroupId)
                    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
            }
            throw error;
        }

        return (data || []).map(mapInventoryRow);
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        return filterInventoryByContext(readLocalCollection<InventoryItem>(INVENTORY_ITEMS_KEY), familyGroupId)
            .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    }
};

export const addInventoryItems = async (
    names: string[],
    userId: string,
    familyGroupId?: string | null,
    source: InventoryItem['source'] = 'manual',
    confidence: number = 0.8
): Promise<InventoryItem[]> => {
    const normalizedNames = Array.from(
        new Set(
            names
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => name.replace(/\s+/g, ' '))
        )
    );

    if (normalizedNames.length === 0) {
        return getInventoryItems(userId, familyGroupId);
    }

    const createdItems: InventoryItem[] = normalizedNames.map((name) => ({
        id: crypto.randomUUID(),
        name,
        source,
        capturedAt: new Date().toISOString(),
        expiresAt: null,
        status: 'active',
        confidence,
        familyGroupId: familyGroupId || null,
    }));

    const existingLocal = readLocalCollection<InventoryItem>(INVENTORY_ITEMS_KEY);
    const existingForContext = filterInventoryByContext(existingLocal, familyGroupId);
    const existingNames = new Set(existingForContext.map((item) => item.name.toLowerCase()));
    const mergedLocal = [
        ...existingLocal,
        ...createdItems.filter((item) => !existingNames.has(item.name.toLowerCase())),
    ];
    writeLocalCollection(INVENTORY_ITEMS_KEY, mergedLocal);

    if (isOfflineMode(userId)) {
        return filterInventoryByContext(mergedLocal, familyGroupId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    }

    try {
        const rows = createdItems.map((item) => ({
            id: item.id,
            user_id: userId,
            family_group_id: item.familyGroupId,
            name: item.name,
            source: item.source,
            status: item.status,
            confidence: item.confidence,
            captured_at: item.capturedAt,
            expires_at: item.expiresAt,
        }));

        const { error } = await supabase
            .from('inventory_items')
            .upsert(rows as any, { onConflict: 'user_id,family_group_id,name' });

        if (error && !isMissingRelationError(error)) {
            throw error;
        }
    } catch (error) {
        console.error('Error saving inventory items:', error);
    }

    return getInventoryItems(userId, familyGroupId);
};

export const removeInventoryItem = async (
    itemId: string,
    userId: string,
    familyGroupId?: string | null
): Promise<void> => {
    const localItems = readLocalCollection<InventoryItem>(INVENTORY_ITEMS_KEY).filter((item) => item.id !== itemId);
    writeLocalCollection(INVENTORY_ITEMS_KEY, localItems);

    if (isOfflineMode(userId)) {
        return;
    }

    try {
        let query = supabase
            .from('inventory_items')
            .delete()
            .eq('id', itemId)
            .eq('user_id', userId);

        if (familyGroupId) {
            query = query.eq('family_group_id', familyGroupId);
        }

        const { error } = await query;
        if (error && !isMissingRelationError(error)) {
            throw error;
        }
    } catch (error) {
        console.error('Error removing inventory item:', error);
    }
};

// ============================================================================
// PREFERENCE SIGNALS
// ============================================================================

function filterSignalsByContext(signals: PreferenceSignal[], familyGroupId?: string | null): PreferenceSignal[] {
    return signals.filter((signal) => (signal.familyGroupId || null) === (familyGroupId || null));
}

function mapPreferenceSignalRow(row: any): PreferenceSignal {
    return {
        id: row.id,
        mealType: row.meal_type || row.mealType || null,
        actionType: row.action_type || row.actionType,
        originalValue: row.original_value || row.originalValue || null,
        newValue: row.new_value || row.newValue || null,
        rawInstruction: row.raw_instruction || row.rawInstruction || null,
        positiveTags: row.positive_tags || row.positiveTags || [],
        negativeTags: row.negative_tags || row.negativeTags || [],
        confidence: Number(row.confidence ?? 0.7),
        requiresConfirmation: row.requires_confirmation ?? row.requiresConfirmation ?? true,
        appliedAt: row.applied_at || row.appliedAt || null,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        familyGroupId: row.family_group_id || row.familyGroupId || null,
    };
}

export const getPreferenceSignals = async (
    userId: string,
    familyGroupId?: string | null
): Promise<PreferenceSignal[]> => {
    if (isOfflineMode(userId)) {
        return filterSignalsByContext(readLocalCollection<PreferenceSignal>(PREFERENCE_SIGNALS_KEY), familyGroupId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    try {
        let query = supabase
            .from('preference_signals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (familyGroupId) {
            query = query.eq('family_group_id', familyGroupId);
        } else {
            query = query.is('family_group_id', null);
        }

        const { data, error } = await query;
        if (error) {
            if (isMissingRelationError(error)) {
                return filterSignalsByContext(readLocalCollection<PreferenceSignal>(PREFERENCE_SIGNALS_KEY), familyGroupId)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            }
            throw error;
        }

        return (data || []).map(mapPreferenceSignalRow);
    } catch (error) {
        console.error('Error fetching preference signals:', error);
        return filterSignalsByContext(readLocalCollection<PreferenceSignal>(PREFERENCE_SIGNALS_KEY), familyGroupId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
};

export const savePreferenceSignal = async (
    signal: Omit<PreferenceSignal, 'id' | 'createdAt' | 'familyGroupId'>,
    userId: string,
    familyGroupId?: string | null
): Promise<PreferenceSignal> => {
    const newSignal: PreferenceSignal = {
        ...signal,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        familyGroupId: familyGroupId || null,
    };

    const localSignals = readLocalCollection<PreferenceSignal>(PREFERENCE_SIGNALS_KEY);
    writeLocalCollection(PREFERENCE_SIGNALS_KEY, [newSignal, ...localSignals]);

    if (isOfflineMode(userId)) {
        return newSignal;
    }

    try {
        const { error } = await supabase
            .from('preference_signals')
            .insert({
                id: newSignal.id,
                user_id: userId,
                family_group_id: newSignal.familyGroupId,
                meal_type: newSignal.mealType,
                action_type: newSignal.actionType,
                original_value: newSignal.originalValue,
                new_value: newSignal.newValue,
                raw_instruction: newSignal.rawInstruction,
                positive_tags: newSignal.positiveTags,
                negative_tags: newSignal.negativeTags,
                confidence: newSignal.confidence,
                requires_confirmation: newSignal.requiresConfirmation,
                applied_at: newSignal.appliedAt,
                created_at: newSignal.createdAt,
            } as any);

        if (error && !isMissingRelationError(error)) {
            throw error;
        }
    } catch (error) {
        console.error('Error saving preference signal:', error);
    }

    return newSignal;
};

async function updateSignalsInLocalStorage(
    signalIds: string[],
    updater: (signal: PreferenceSignal) => PreferenceSignal
) {
    const localSignals = readLocalCollection<PreferenceSignal>(PREFERENCE_SIGNALS_KEY).map((signal) => (
        signalIds.includes(signal.id) ? updater(signal) : signal
    ));
    writeLocalCollection(PREFERENCE_SIGNALS_KEY, localSignals);
}

export const markPreferenceSignalsApplied = async (
    signalIds: string[],
    userId: string
): Promise<void> => {
    const appliedAt = new Date().toISOString();
    await updateSignalsInLocalStorage(signalIds, (signal) => ({ ...signal, appliedAt, requiresConfirmation: false }));

    if (isOfflineMode(userId) || signalIds.length === 0) {
        return;
    }

    try {
        const { error } = await supabase
            .from('preference_signals')
            .update({ applied_at: appliedAt, requires_confirmation: false })
            .in('id', signalIds);

        if (error && !isMissingRelationError(error)) {
            throw error;
        }
    } catch (error) {
        console.error('Error marking preference signals applied:', error);
    }
};

export const dismissPreferenceSignals = async (
    signalIds: string[],
    userId: string
): Promise<void> => {
    await updateSignalsInLocalStorage(signalIds, (signal) => ({ ...signal, requiresConfirmation: false }));

    if (isOfflineMode(userId) || signalIds.length === 0) {
        return;
    }

    try {
        const { error } = await supabase
            .from('preference_signals')
            .update({ requires_confirmation: false })
            .in('id', signalIds);

        if (error && !isMissingRelationError(error)) {
            throw error;
        }
    } catch (error) {
        console.error('Error dismissing preference signals:', error);
    }
};

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export const subscribeToScheduleChanges = (
    userId: string,
    callback: (schedule: Schedule) => void
) => {
    if (isOfflineMode(userId)) {
        return { unsubscribe: () => { } };
    }

    const subscription = supabase
        .channel('scheduled_meals_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'scheduled_meals',
                filter: `user_id=eq.${userId}`,
            },
            async () => {
                // Refetch schedule on any change
                const schedule = await getSchedule(userId);
                callback(schedule);
            }
        )
        .subscribe();

    return {
        unsubscribe: () => {
            supabase.removeChannel(subscription);
        },
    };
};

// Subscribe to plan changes for family mode (real-time updates when family members edit meals)
export const subscribeToPlanChanges = (
    familyGroupId: string,
    callback: (plan: WeeklyPlan | null) => void
) => {
    const subscription = supabase
        .channel(`weekly_plans_family_${familyGroupId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'weekly_plans',
                filter: `family_group_id=eq.${familyGroupId}`,
            },
            async (payload) => {
                // Only react to the current plan (is_current=true)
                if (payload.new && (payload.new as any).is_current === true) {
                    const plan = {
                        days: (payload.new as any).days as DayPlan[],
                        alternatives: (payload.new as any).alternatives || null
                    };
                    callback(plan);
                } else if (payload.eventType === 'UPDATE' && payload.old && (payload.old as any).is_current === true) {
                    // Plan was updated or archived - refetch to ensure we have latest
                    // Note: This handles edge cases where is_current changed
                    callback(null);
                }
            }
        )
        .subscribe();

    return {
        unsubscribe: () => {
            supabase.removeChannel(subscription);
        },
    };
};

// ============================================================================
// SMART LEARNING: Build meal history summary for AI context
// ============================================================================

export interface MealLearningSummary {
    acceptedBreakfasts: string[];
    acceptedLunches: string[];
    acceptedDinners: string[];
    recentMeals: string[]; // Last 3-4 weeks for variety checking
    totalMealCount: number;
    oldestDate: string | null;
    newestDate: string | null;
    activeInventorySummary?: string;
    activeInventoryItems?: string[];
    softPositiveSignals?: string[];
    softNegativeSignals?: string[];
    useInventoryFirst?: boolean;
}

export const getMealLearningSummary = async (
    userId: string,
    monthsBack: number = 3,
    familyGroupId?: string | null
): Promise<MealLearningSummary> => {
    const emptySummary: MealLearningSummary = {
        acceptedBreakfasts: [],
        acceptedLunches: [],
        acceptedDinners: [],
        recentMeals: [],
        totalMealCount: 0,
        oldestDate: null,
        newestDate: null,
        activeInventorySummary: '',
        activeInventoryItems: [],
        softPositiveSignals: [],
        softNegativeSignals: [],
        useInventoryFirst: false,
    };

    if (isOfflineMode(userId)) {
        // For local mode, use localStorage schedule
        const saved = localStorage.getItem('qookcommander_schedule');
        if (!saved) return emptySummary;

        const schedule: Schedule = JSON.parse(saved);
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

        const breakfasts: string[] = [];
        const lunches: string[] = [];
        const dinners: string[] = [];
        const allMeals: string[] = [];

        Object.entries(schedule).forEach(([dateKey, dayPlan]) => {
            const date = new Date(dateKey);
            if (date >= cutoffDate) {
                if (dayPlan.breakfast) breakfasts.push(dayPlan.breakfast);
                if (dayPlan.lunch) lunches.push(dayPlan.lunch);
                if (dayPlan.dinner) dinners.push(dayPlan.dinner);
                allMeals.push(dayPlan.breakfast, dayPlan.lunch, dayPlan.dinner);
            }
        });

        const inventoryItems = await getInventoryItems(userId, familyGroupId);
        const signalSummary = summarizePreferenceSignals(
            await getPreferenceSignals(userId, familyGroupId)
        );
        const inventorySummary = buildInventorySummary(inventoryItems);

        return {
            acceptedBreakfasts: [...new Set(breakfasts.filter(Boolean))],
            acceptedLunches: [...new Set(lunches.filter(Boolean))],
            acceptedDinners: [...new Set(dinners.filter(Boolean))],
            recentMeals: allMeals.filter(Boolean).slice(-21), // Last 3 weeks
            totalMealCount: allMeals.filter(Boolean).length,
            oldestDate: null,
            newestDate: null,
            activeInventorySummary: inventorySummary.label,
            activeInventoryItems: inventorySummary.names,
            softPositiveSignals: signalSummary.positiveFocus,
            softNegativeSignals: signalSummary.negativeFocus,
            useInventoryFirst: inventorySummary.names.length > 0,
        };
    }

    try {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Fetch scheduled meals from last N months
        const { data: scheduledMeals, error } = await supabase
            .from('scheduled_meals')
            .select('date, breakfast, lunch, dinner')
            .eq('user_id', userId)
            .gte('date', cutoffStr)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching learning summary:', error);
            return emptySummary;
        }

        if (!scheduledMeals || scheduledMeals.length === 0) {
            return emptySummary;
        }

        const breakfasts: string[] = [];
        const lunches: string[] = [];
        const dinners: string[] = [];
        const recentMeals: string[] = [];

        scheduledMeals.forEach((meal, index) => {
            if (meal.breakfast) {
                breakfasts.push(meal.breakfast);
                if (index < 21) recentMeals.push(meal.breakfast); // Last 3 weeks
            }
            if (meal.lunch) {
                lunches.push(meal.lunch);
                if (index < 21) recentMeals.push(meal.lunch);
            }
            if (meal.dinner) {
                dinners.push(meal.dinner);
                if (index < 21) recentMeals.push(meal.dinner);
            }
        });

        const inventoryItems = await getInventoryItems(userId, familyGroupId);
        const signalSummary = summarizePreferenceSignals(
            await getPreferenceSignals(userId, familyGroupId)
        );
        const inventorySummary = buildInventorySummary(inventoryItems);

        return {
            acceptedBreakfasts: [...new Set(breakfasts)],
            acceptedLunches: [...new Set(lunches)],
            acceptedDinners: [...new Set(dinners)],
            recentMeals,
            totalMealCount: breakfasts.length + lunches.length + dinners.length,
            oldestDate: scheduledMeals[scheduledMeals.length - 1]?.date || null,
            newestDate: scheduledMeals[0]?.date || null,
            activeInventorySummary: inventorySummary.label,
            activeInventoryItems: inventorySummary.names,
            softPositiveSignals: signalSummary.positiveFocus,
            softNegativeSignals: signalSummary.negativeFocus,
            useInventoryFirst: inventorySummary.names.length > 0,
        };
    } catch (error) {
        console.error('Error in getMealLearningSummary:', error);
        return emptySummary;
    }
};

// ============================================================================
// GROCERY LIST HISTORY
// ============================================================================

const GROCERY_HISTORY_KEY = 'qookcommander_grocery_history';

export const saveGroceryListToHistory = async (
    items: GroceryItem[],
    dateRange: string,
    userId: string,
    customName?: string
): Promise<SavedGroceryList> => {
    // 1. Supabase Storage
    if (!isOfflineMode(userId)) {
        const { data, error } = await supabase
            .from('grocery_list_history')
            .insert({
                user_id: userId,
                name: customName || `Grocery List - ${dateRange}`,
                items: items,
                date_range: dateRange
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving grocery list to Supabase:', error);
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            items: data.items,
            dateRange: data.date_range,
            createdAt: data.created_at
        };
    }

    // 2. Offline Fallback
    const newList: SavedGroceryList = {
        id: `local_${Date.now()}`,
        name: customName || `Grocery List - ${dateRange}`,
        items,
        dateRange,
        createdAt: new Date().toISOString()
    };

    const saved = localStorage.getItem(GROCERY_HISTORY_KEY);
    const history: SavedGroceryList[] = saved ? JSON.parse(saved) : [];

    // Add new list at the beginning
    history.unshift(newList);

    // Keep only last N lists
    const trimmed = history.slice(0, 10);

    localStorage.setItem(GROCERY_HISTORY_KEY, JSON.stringify(trimmed));

    return newList;
};

export const getGroceryListHistory = async (userId: string): Promise<SavedGroceryList[]> => {
    // 1. Supabase Storage
    if (!isOfflineMode(userId)) {
        const { data, error } = await supabase
            .from('grocery_list_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching grocery history:', error);
            return [];
        }

        return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            items: d.items,
            dateRange: d.date_range,
            createdAt: d.created_at
        }));
    }

    // 2. Offline Fallback
    const saved = localStorage.getItem(GROCERY_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
};

export const deleteGroceryList = async (listId: string, userId: string): Promise<void> => {
    // 1. Supabase Storage
    if (!isOfflineMode(userId) && !listId.startsWith('local_')) {
        const { error } = await supabase
            .from('grocery_list_history')
            .delete()
            .eq('id', listId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error deleting grocery list:', error);
            throw error;
        }
        return;
    }

    // 2. Offline Fallback
    const saved = localStorage.getItem(GROCERY_HISTORY_KEY);
    if (!saved) return;

    const history: SavedGroceryList[] = JSON.parse(saved);
    const filtered = history.filter(list => list.id !== listId);
    localStorage.setItem(GROCERY_HISTORY_KEY, JSON.stringify(filtered));
};

// ============================================================================
// FEEDBACK SYSTEM
// ============================================================================

export interface FeedbackData {
    rating: number;
    whatWorks: string;
    whatNeedsImprovement: string;
    suggestions: string;
}

export const submitFeedback = async (data: FeedbackData, userId: string = 'anon'): Promise<void> => {
    if (isOfflineMode(userId) && userId !== 'anon') {
        // Feedback requires online connection
        throw new Error("Cannot submit feedback in offline mode");
    }

    const { error } = await supabase
        .from('feedback')
        .insert({
            user_id: userId === 'anon' || userId === 'local' ? null : userId,
            rating: data.rating,
            what_works: data.whatWorks,
            what_needs_improvement: data.whatNeedsImprovement,
            suggestions: data.suggestions
        });

    if (error) {
        console.error('Error submitting feedback:', error);
        throw error;
    }
};

// ============================================================================
// WEEKLY DRAFTS (Persist plan with alternatives across sessions)
// ============================================================================

export interface WeeklyDraft {
    weekStartDate: string;
    plan: WeeklyPlan;
    alternatives: {
        breakfast: string[];
        lunch: string[];
        dinner: string[];
    } | null;
}

export const saveWeeklyDraft = async (
    userId: string,
    weekStartDate: string,
    plan: WeeklyPlan,
    alternatives: WeeklyDraft['alternatives']
): Promise<void> => {
    if (isOfflineMode(userId)) {
        const key = `qookcommander_draft_${weekStartDate}`;
        localStorage.setItem(key, JSON.stringify({ plan, alternatives }));
        return;
    }

    const { error } = await supabase
        .from('weekly_drafts')
        .upsert({
            user_id: userId,
            week_start_date: weekStartDate,
            plan_data: plan,
            alternatives: alternatives,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_start_date' });

    if (error) {
        console.error('Error saving weekly draft:', error);
        throw error;
    }
};

export const getWeeklyDraft = async (
    userId: string,
    weekStartDate: string
): Promise<WeeklyDraft | null> => {
    if (isOfflineMode(userId)) {
        const key = `qookcommander_draft_${weekStartDate}`;
        const saved = localStorage.getItem(key);
        if (!saved) return null;
        const { plan, alternatives } = JSON.parse(saved);
        return { weekStartDate, plan, alternatives };
    }

    const { data, error } = await supabase
        .from('weekly_drafts')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // No row found
        console.error('Error fetching weekly draft:', error);
        return null;
    }

    if (!data) return null;

    return {
        weekStartDate: data.week_start_date,
        plan: data.plan_data as WeeklyPlan,
        alternatives: data.alternatives as WeeklyDraft['alternatives']
    };
};

// Get meals from schedule for a specific week (for loading saved weeks into planner view)
export const getWeekFromSchedule = async (
    userId: string,
    weekStartDate: string,
    familyGroupId?: string | null
): Promise<WeeklyPlan | null> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        if (!saved) return null;

        const schedule: Schedule = JSON.parse(saved);
        const days: DayPlan[] = [];

        for (let i = 0; i < 7; i++) {
            const date = addDays(weekStartDate, i);
            const dayPlan = schedule[date];
            if (dayPlan) {
                days.push(dayPlan);
            } else {
                days.push({ day: date, breakfast: '', lunch: '', dinner: '' });
            }
        }

        // Only return if at least one day has meals
        const hasMeals = days.some(d => d.breakfast || d.lunch || d.dinner);
        return hasMeals ? { days } : null;
    }

    const endDate = addDays(weekStartDate, 6);

    let query = supabase
        .from('scheduled_meals')
        .select('*')
        .gte('date', weekStartDate)
        .lte('date', endDate);

    // Filter by family or personal
    if (familyGroupId) {
        query = query.eq('family_group_id', familyGroupId);
    } else {
        query = query.eq('user_id', userId).is('family_group_id', null);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
        console.error('Error fetching week from schedule:', error);
        return null;
    }

    if (!data || data.length === 0) return null;

    // Build the 7-day plan
    const days: DayPlan[] = [];
    for (let i = 0; i < 7; i++) {
        const date = addDays(weekStartDate, i);
        const meal = data.find((m: any) => m.date === date);
        if (meal) {
            days.push(sanitizeDayPlan({
                day: meal.date,
                breakfast: meal.breakfast || '',
                lunch: meal.lunch || '',
                dinner: meal.dinner || '',
                prepAhead: meal.prep_ahead || undefined
            }));
        } else {
            days.push({ day: date, breakfast: '', lunch: '', dinner: '' });
        }
    }

    return { days };
};

// Get count of existing meals in a week (for conflict detection)
export const getWeekMealCount = async (
    userId: string,
    startDate: string,
    familyGroupId?: string | null
): Promise<{ total: number; days: Record<string, { breakfast: boolean; lunch: boolean; dinner: boolean }> }> => {
    const endDate = addDays(startDate, 6);
    const schedule = await getSchedule(userId, startDate, endDate, familyGroupId);

    let total = 0;
    const days: Record<string, { breakfast: boolean; lunch: boolean; dinner: boolean }> = {};

    for (let i = 0; i < 7; i++) {
        const date = addDays(startDate, i);
        const day = schedule[date];
        const hasBreakfast = !!day?.breakfast;
        const hasLunch = !!day?.lunch;
        const hasDinner = !!day?.dinner;

        days[date] = { breakfast: hasBreakfast, lunch: hasLunch, dinner: hasDinner };
        if (hasBreakfast) total++;
        if (hasLunch) total++;
        if (hasDinner) total++;
    }

    return { total, days };
};

// Merge new plan with existing schedule (fill-empty mode)
export const mergeWeekMeals = async (
    plan: WeeklyPlan,
    startDate: string,
    userId: string,
    mode: 'overwrite' | 'fill-empty',
    familyGroupId?: string | null  // Optional: save as family meals
): Promise<void> => {
    if (mode === 'overwrite') {
        await archivePlanToSchedule(plan, startDate, userId, familyGroupId);
        return;
    }

    // Fill-empty mode: only save where no meal exists
    const { days: existingDays } = await getWeekMealCount(userId, startDate, familyGroupId);

    for (let i = 0; i < plan.days.length; i++) {
        const date = addDays(startDate, i);
        const newDay = plan.days[i];
        const existing = existingDays[date] || { breakfast: false, lunch: false, dinner: false };

        const mergedDay: DayPlan = {
            day: date,
            breakfast: existing.breakfast ? '' : newDay.breakfast,
            lunch: existing.lunch ? '' : newDay.lunch,
            dinner: existing.dinner ? '' : newDay.dinner,
        };

        // Only save if we're adding something new
        if (mergedDay.breakfast || mergedDay.lunch || mergedDay.dinner) {
            // Get existing to merge
            const schedule = await getSchedule(userId, date, date);
            const existingMeals = schedule[date] || { day: date, breakfast: '', lunch: '', dinner: '' };

            await saveScheduledMeal(date, {
                day: date,
                breakfast: existing.breakfast ? existingMeals.breakfast : newDay.breakfast,
                lunch: existing.lunch ? existingMeals.lunch : newDay.lunch,
                dinner: existing.dinner ? existingMeals.dinner : newDay.dinner,
            }, userId, familyGroupId);
        }
    }

    // Clear current plan
    await clearCurrentPlan(userId);
};
