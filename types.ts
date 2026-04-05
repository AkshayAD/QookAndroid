export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface PrepAhead {
  forBreakfast?: string;
  forLunch?: string;
  forDinner?: string;
}

export interface DayPlan {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  prepAhead?: PrepAhead;
  alternatives?: MealAlternatives | null;  // Per-day alternatives for persistence
  [key: string]: string | PrepAhead | MealAlternatives | null | undefined;
}

export interface MealAlternatives {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  [key: string]: string[]; // Allow dynamic access if needed
}

export interface WeeklyPlan {
  days: DayPlan[];
  alternatives?: MealAlternatives | null;
}

export interface GroceryItem {
  category: string;
  item: string;
  quantity: string;
  checked: boolean;
  homeStatus?: 'none' | 'inventory' | 'staple';
}

export interface UserPreferences {
  dietaryType: string;
  dietaryTypes?: string[]; // Multi-select: Veg, Veg + Eggs, Non-Veg
  dietaryDetails?: string; // Free text for more details
  allergies: string[];
  dislikes: string[];
  breakfastPreferences: string[];
  lunchPreferences: string[];
  dinnerPreferences: string[];
  specialInstructions: string;
  pantryStaples: string[];
  mealsToPrepare?: ('breakfast' | 'lunch' | 'dinner')[];
  nonVegPreferences?: string[];
  language?: 'English' | 'Hindi';
  quickCookInstructions?: string[]; // Quick default toggles
  // New onboarding fields
  country?: string;
  householdSize?: number;
  portionSize?: 'light' | 'regular' | 'hearty';
  nonVegFrequency?: 'daily' | '3-4x/week' | '1-2x/week' | 'weekends';
  hasTiffin?: boolean;
  tiffinDays?: string[];
  tiffinFor?: string[];
  mealComplexity?: 'quick' | 'balanced' | 'elaborate';
  cuisineStyle?: 'regional' | 'pan-indian' | 'fusion';
  healthGoals?: string[];
  // Display settings
  showPrepReminders?: boolean; // Show prep-ahead reminders on meal cards
  showQuantities?: boolean; // Show quantities in meal descriptions
  activeInventoryItems?: string[];
  useInventoryFirst?: boolean;
}

// General settings that apply to all profiles (household-wide)
export interface GeneralSettings {
  // Household
  country?: string;
  language?: 'English' | 'Hindi';
  householdSize?: number;
  portionSize?: 'light' | 'regular' | 'hearty';

  // Kitchen staples
  pantryStaples?: string[];

  // Tiffin/Lunch box settings
  hasTiffin?: boolean;
  tiffinDays?: string[];
  tiffinFor?: string[];

  // Display preferences
  showPrepReminders?: boolean;
  showQuantities?: boolean;
}

// Onboarding wizard data structure
export interface OnboardingData {
  userName: string;
  phone?: string; // Optional phone number for bonus credits
  country: string;
  language: 'English' | 'Hindi';
  householdSize: number;
  portionSize: 'light' | 'regular' | 'hearty';
  dietaryTypes: string[];
  nonVegPreferences: string[];
  nonVegFrequency: string;
  mealsToPrepare: ('breakfast' | 'lunch' | 'dinner')[];
  hasTiffin: boolean;
  tiffinDays: string[];
  tiffinFor: string[];
  mealComplexity: 'quick' | 'balanced' | 'elaborate';
  cuisineStyle: 'regional' | 'pan-indian' | 'fusion';
  dislikes: string[];
  allergies: string[];
  customAllergies?: string; // Free text for other allergies
  healthGoals: string[];
  specialInstructions: string;
  additionalContext?: string; // Consolidated notes from onboarding
  referralCode?: string; // Referral code used during signup (QOOK-XXXXXX format)
}

export interface PreferenceProfile extends UserPreferences {
  id: string;
  name: string;
}

export interface MealHistoryEntry {
  date: string; // ISO date string YYYY-MM-DD
  mealName: string;
  type: MealType;
  rating?: 'liked' | 'disliked';
}

export type InventorySource =
  | 'manual'
  | 'fridge_photo'
  | 'pantry_photo'
  | 'receipt'
  | 'order_screenshot'
  | 'smart_edit';

export type InventoryStatus = 'active' | 'consumed' | 'archived';

export interface InventoryItem {
  id: string;
  name: string;
  source: InventorySource;
  capturedAt: string;
  expiresAt?: string | null;
  status: InventoryStatus;
  confidence?: number | null;
  familyGroupId?: string | null;
}

export type PreferenceSignalActionType =
  | 'regenerate'
  | 'swap'
  | 'manual_edit'
  | 'smart_edit'
  | 'save_recipe';

export interface PreferenceSignal {
  id: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | null;
  actionType: PreferenceSignalActionType;
  originalValue?: string | null;
  newValue?: string | null;
  rawInstruction?: string | null;
  positiveTags: string[];
  negativeTags: string[];
  confidence: number;
  requiresConfirmation: boolean;
  appliedAt?: string | null;
  createdAt: string;
  familyGroupId?: string | null;
}

export interface PreferenceSignalSummary {
  signalIds: string[];
  meaningfulSignalCount: number;
  breakfastPreferences: string[];
  lunchPreferences: string[];
  dinnerPreferences: string[];
  dislikes: string[];
  positiveFocus: string[];
  negativeFocus: string[];
  summary: string;
}

// Map 'YYYY-MM-DD' to DayPlan
export type Schedule = Record<string, DayPlan>;

export interface MealTransfer {
  sourceDate: string;
  sourceMealType: string;
  sourceMealName: string;
}

export interface SavedGroceryList {
  id: string;
  name: string;
  items: GroceryItem[];
  dateRange: string; // e.g., "Jan 6 - Jan 12, 2026"
  createdAt: string; // ISO timestamp
}
