-- QookCommander Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preference Profiles
CREATE TABLE IF NOT EXISTS public.preference_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dietary_type TEXT,
  dietary_types TEXT[] DEFAULT '{}',
  dietary_details TEXT,
  allergies TEXT[],
  dislikes TEXT[],
  breakfast_preferences TEXT[],
  lunch_preferences TEXT[],
  dinner_preferences TEXT[],
  special_instructions TEXT,
  pantry_staples TEXT[],
  meals_to_prepare TEXT[] DEFAULT ARRAY['breakfast', 'lunch', 'dinner'],
  non_veg_preferences TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'English',
  quick_cook_instructions TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly Plans (Draft)
CREATE TABLE IF NOT EXISTS public.weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.preference_profiles(id) ON DELETE SET NULL,
  days JSONB NOT NULL,  -- Array of DayPlan objects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE
);

-- Scheduled Meals (Calendar Archive)
CREATE TABLE IF NOT EXISTS public.scheduled_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  breakfast TEXT,
  lunch TEXT,
  dinner TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Grocery Lists
CREATE TABLE IF NOT EXISTS public.grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  items JSONB NOT NULL,  -- Array of GroceryItem objects
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal History (for AI learning)
CREATE TABLE IF NOT EXISTS public.meal_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
  meal_name TEXT NOT NULL,
  rating TEXT CHECK (rating IN ('liked', 'disliked') OR rating IS NULL),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_preference_profiles_user ON public.preference_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meals_user_date ON public.scheduled_meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_history_user ON public.meal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON public.weekly_plans(user_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preference_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data

-- User Profiles
CREATE POLICY "Users manage own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);

-- Preference Profiles
CREATE POLICY "Users manage own preferences" ON public.preference_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Weekly Plans
CREATE POLICY "Users manage own plans" ON public.weekly_plans
  FOR ALL USING (auth.uid() = user_id);

-- Scheduled Meals
CREATE POLICY "Users manage own meals" ON public.scheduled_meals
  FOR ALL USING (auth.uid() = user_id);

-- Grocery Lists
CREATE POLICY "Users manage own groceries" ON public.grocery_lists
  FOR ALL USING (auth.uid() = user_id);

-- Meal History
CREATE POLICY "Users manage own history" ON public.meal_history
  FOR ALL USING (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
