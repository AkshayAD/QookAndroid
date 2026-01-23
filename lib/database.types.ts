/**
 * Supabase Database Types
 * These types match the database schema defined in the implementation plan.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    id: string;
                    display_name: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    display_name?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    display_name?: string | null;
                    updated_at?: string;
                };
            };
            preference_profiles: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    dietary_type: string | null;
                    allergies: string[] | null;
                    dislikes: string[] | null;
                    breakfast_preferences: string[] | null;
                    lunch_preferences: string[] | null;
                    dinner_preferences: string[] | null;
                    special_instructions: string | null;
                    pantry_staples: string[] | null;
                    is_default: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    dietary_type?: string | null;
                    allergies?: string[] | null;
                    dislikes?: string[] | null;
                    breakfast_preferences?: string[] | null;
                    lunch_preferences?: string[] | null;
                    dinner_preferences?: string[] | null;
                    special_instructions?: string | null;
                    pantry_staples?: string[] | null;
                    is_default?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    name?: string;
                    dietary_type?: string | null;
                    allergies?: string[] | null;
                    dislikes?: string[] | null;
                    breakfast_preferences?: string[] | null;
                    lunch_preferences?: string[] | null;
                    dinner_preferences?: string[] | null;
                    special_instructions?: string | null;
                    pantry_staples?: string[] | null;
                    is_default?: boolean;
                    updated_at?: string;
                };
            };
            weekly_plans: {
                Row: {
                    id: string;
                    user_id: string;
                    profile_id: string | null;
                    days: Json;
                    created_at: string;
                    is_current: boolean;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    profile_id?: string | null;
                    days: Json;
                    created_at?: string;
                    is_current?: boolean;
                };
                Update: {
                    days?: Json;
                    is_current?: boolean;
                };
            };
            scheduled_meals: {
                Row: {
                    id: string;
                    user_id: string;
                    date: string;
                    breakfast: string | null;
                    lunch: string | null;
                    dinner: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    date: string;
                    breakfast?: string | null;
                    lunch?: string | null;
                    dinner?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    breakfast?: string | null;
                    lunch?: string | null;
                    dinner?: string | null;
                    updated_at?: string;
                };
            };
            grocery_lists: {
                Row: {
                    id: string;
                    user_id: string;
                    plan_id: string | null;
                    items: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    plan_id?: string | null;
                    items: Json;
                    created_at?: string;
                };
                Update: {
                    items?: Json;
                };
            };
            meal_history: {
                Row: {
                    id: string;
                    user_id: string;
                    date: string;
                    meal_type: 'Breakfast' | 'Lunch' | 'Dinner';
                    meal_name: string;
                    rating: 'liked' | 'disliked' | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    date: string;
                    meal_type: 'Breakfast' | 'Lunch' | 'Dinner';
                    meal_name: string;
                    rating?: 'liked' | 'disliked' | null;
                    created_at?: string;
                };
                Update: {
                    rating?: 'liked' | 'disliked' | null;
                };
            };
        };
    };
}

// Helper types for easier use
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type PreferenceProfileRow = Database['public']['Tables']['preference_profiles']['Row'];
export type WeeklyPlanRow = Database['public']['Tables']['weekly_plans']['Row'];
export type ScheduledMealRow = Database['public']['Tables']['scheduled_meals']['Row'];
export type GroceryListRow = Database['public']['Tables']['grocery_lists']['Row'];
export type MealHistoryRow = Database['public']['Tables']['meal_history']['Row'];
