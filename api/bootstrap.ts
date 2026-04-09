import { createClient } from '@supabase/supabase-js';
import type { PreferenceProfile } from '../types.js';
import { authenticateSupabaseUser } from '../lib/supabaseAuth.js';

type UserSettingsPayload = {
    geminiApiKey: string;
    cookName: string;
    cookWhatsappNumber: string;
    currentProfileId?: string;
    preferredLanguage?: 'English' | 'Hindi';
    onboardingCompleted?: boolean;
    tourCompletedAt?: string | null;
    displayName?: string;
};

type UserProfilePayload = {
    displayName: string;
    phone: string;
    city: string;
};

type HouseholdSettingsPayload = {
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
};

type PreferenceProfileRow = {
    id: string;
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
};

const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettingsPayload = {
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

const mapPreferenceProfileRow = (row: PreferenceProfileRow): PreferenceProfile => ({
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
    mealsToPrepare: ((row.meals_to_prepare || ['breakfast', 'lunch', 'dinner']) as ('breakfast' | 'lunch' | 'dinner')[]),
    nonVegPreferences: row.non_veg_preferences || [],
    language: (row.language as 'English' | 'Hindi') || 'English',
    quickCookInstructions: row.quick_cook_instructions || [],
});

const mapUserSettings = (row: any): UserSettingsPayload | null => {
    if (!row) {
        return null;
    }

    return {
        geminiApiKey: row.gemini_api_key || '',
        cookName: row.cook_name || '',
        cookWhatsappNumber: row.cook_whatsapp_number || '',
        currentProfileId: row.current_profile_id || undefined,
        preferredLanguage: (row.preferred_language as 'English' | 'Hindi') || 'English',
        onboardingCompleted: row.onboarding_completed ?? false,
        tourCompletedAt: row.tour_completed_at ?? null,
        displayName: row.display_name || '',
    };
};

const mapHouseholdSettings = (row: any): HouseholdSettingsPayload => {
    if (!row) {
        return DEFAULT_HOUSEHOLD_SETTINGS;
    }

    return {
        city: row.city || '',
        country: row.country || 'India',
        language: (row.preferred_language as 'English' | 'Hindi') || 'English',
        householdSize: row.household_size || 4,
        portionSize: (row.portion_size as 'light' | 'regular' | 'hearty') || 'regular',
        pantryStaples: row.pantry_staples || [],
        hasTiffin: row.has_tiffin ?? false,
        tiffinDays: row.tiffin_days || [],
        tiffinFor: row.tiffin_for || [],
        showPrepReminders: row.show_prep_reminders ?? true,
        showQuantities: row.show_quantities ?? true,
    };
};

const mapUserProfile = (row: any): UserProfilePayload | null => {
    if (!row) {
        return null;
    }

    return {
        displayName: row.display_name || '',
        phone: row.phone || '',
        city: row.city || '',
    };
};

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const { userId } = await authenticateSupabaseUser(req.headers.authorization);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const [{ data: userSettingsRow, error: settingsError }, { data: userProfileRow, error: profileError }, { data: profileRows, error: preferencesError }] = await Promise.all([
            supabase
                .from('user_settings')
                .select('gemini_api_key, cook_name, cook_whatsapp_number, current_profile_id, preferred_language, onboarding_completed, tour_completed_at, display_name, city, country, household_size, portion_size, pantry_staples, has_tiffin, tiffin_days, tiffin_for, show_prep_reminders, show_quantities')
                .eq('user_id', userId)
                .maybeSingle(),
            supabase
                .from('user_profiles')
                .select('display_name, phone, city')
                .eq('id', userId)
                .maybeSingle(),
            supabase
                .from('preference_profiles')
                .select('id, name, dietary_type, dietary_types, dietary_details, allergies, dislikes, breakfast_preferences, lunch_preferences, dinner_preferences, special_instructions, pantry_staples, meals_to_prepare, non_veg_preferences, language, quick_cook_instructions')
                .eq('user_id', userId)
                .is('deleted_at', null)
                .order('created_at', { ascending: true }),
        ]);

        if (settingsError) {
            throw settingsError;
        }
        if (profileError) {
            throw profileError;
        }
        if (preferencesError) {
            throw preferencesError;
        }

        return res.status(200).json({
            profiles: (profileRows || []).map((row) => mapPreferenceProfileRow(row as PreferenceProfileRow)),
            userSettings: mapUserSettings(userSettingsRow),
            userProfile: mapUserProfile(userProfileRow),
            householdSettings: mapHouseholdSettings(userSettingsRow),
        });
    } catch (error: any) {
        console.error('Bootstrap API error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to load bootstrap data',
        });
    }
}
