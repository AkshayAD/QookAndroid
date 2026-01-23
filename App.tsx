import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, ShoppingCart, Settings, RefreshCw, CalendarDays, FileText, Archive, ChevronDown, Calendar as CalendarIcon, ClipboardList, LogOut, Cpu, Share2, MessageSquareHeart, Sparkles, Shuffle, CalendarPlus, Pencil, X, AlertTriangle } from 'lucide-react';
import { WeeklyPlan, UserPreferences, GroceryItem, PreferenceProfile, MealHistoryEntry, DayPlan, Schedule, MealTransfer } from './types';
import { DEFAULT_PREFERENCES, DEFAULT_PROFILE_TEMPLATES } from './constants';
import { DEMO_MEAL_PLAN, DEMO_GROCERY_LIST } from './constants/demoData';
import { generatePlanViaProxy, generateGroceryViaProxy, regenerateMealViaProxy, smartEditViaProxy, generateAlternativesViaProxy } from './services/aiProxyService';
// Removed: generateGroceryListFromSchedule - now using generateGroceryViaProxy for all grocery generation
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './contexts/SettingsContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { useFamily } from './contexts/FamilyContext';
import * as supabaseService from './services/supabaseService';
import { HouseholdSettings, getHouseholdSettings } from './services/supabaseService';
import { applyReferral, awardReferrerCredits } from './services/referralService';
import PreferencesModal from './components/PreferencesModal';
import GroceryList from './components/GroceryList';
import MealCard from './components/MealCard';
import SmartEditModal from './components/SmartEditModal';
import CalendarView from './components/CalendarView';
import MoveMealModal from './components/MoveMealModal';
import ArchiveModal from './components/ArchiveModal';
import LandingPage from './components/LandingPage';
import SettingsModal from './components/SettingsModal';
import UserMenu from './components/UserMenu';
import ShareModal from './components/ShareModal';
import FeedbackModal from './components/FeedbackModal';
import LaunchBanner from './components/LaunchBanner';
import PricingPage from './components/PricingPage';
import DeleteAccountModal from './components/DeleteAccountModal';
import { ToastContainer, useToast } from './components/Toast';
import MealAlternativesSidebar from './components/MealAlternativesSidebar';
import OnboardingModal, { shouldShowOnboarding } from './components/OnboardingModal';
import BottomNav from './components/BottomNav';
import ProfileView from './components/ProfileView';
import OnboardingTour, { shouldShowTour } from './components/OnboardingTour';
import OnboardingWizard from './components/OnboardingWizard';
import PlannerDateStrip from './components/PlannerDateStrip';
import SaveConflictModal from './components/SaveConflictModal';
import LoadingState from './components/LoadingState';
import FamilyModeToggle from './components/FamilyModeToggle';
import RecipePanel from './components/RecipePanel';
import SavedRecipesPanel from './components/SavedRecipesPanel';
import TrustProgressCard from './components/TrustProgressCard';
import PhonePromptModal from './components/PhonePromptModal';
import { useStreamingGeneration } from './hooks/useStreamingGeneration';
import { useSignupTrustAction, useSecondMenuTrustAction, useProfileCompleteTrustAction, useShareMenuTrustAction, usePWAInstallTrustAction, usePhoneTrustSync } from './hooks/useTrustActions';
import { OnboardingData } from './types';
import { format, addDays, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { getApiBaseUrl, isNative } from './utils/platform';
import { notificationService } from './services/notificationService';

interface AppProps {
  forceOnboarding?: boolean;
  demoMode?: boolean;
}

function App({ forceOnboarding = false, demoMode = false }: AppProps) {
  const { user, loading: authLoading, signOut, isConfigured } = useAuth();
  const { apiKey, modelName, isAuthenticated: hasApiKey } = useSettings();
  const { credits, canGenerate, useCredits, checkRate, isTrialActive, isLaunchTrial, trialDaysRemaining, refreshCredits } = useSubscription();
  const { toasts, addToast, dismissToast } = useToast();
  const { isFamilyModeActive, familyGroup } = useFamily();

  // Determine active family group ID for data operations
  const activeFamilyGroupId = isFamilyModeActive && familyGroup ? familyGroup.id : null;

  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');

  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(demoMode ? DEMO_MEAL_PLAN : null);
  const [groceryList, setGroceryList] = useState<GroceryItem[]>(demoMode ? DEMO_GROCERY_LIST : []);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [householdSettings, setHouseholdSettings] = useState<HouseholdSettings | null>(null);

  // Refs to save user's data during tour demo (to restore after tour ends)
  const savedPlanBeforeTour = useRef<WeeklyPlan | null>(null);
  const savedGroceryBeforeTour = useRef<GroceryItem[]>([]);

  const [mealHistory, setMealHistory] = useState<MealHistoryEntry[]>([]);

  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlternativesSidebarOpen, setIsAlternativesSidebarOpen] = useState(false);
  const [swapCandidate, setSwapCandidate] = useState<{ dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner' } | null>(null);
  const [smartEditData, setSmartEditData] = useState<{ dayPlan: DayPlan, index: number } | null>(null);
  const [transferData, setTransferData] = useState<MealTransfer | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false); // For override/retain before regenerating
  const [regenerateOverwrite, setRegenerateOverwrite] = useState(true); // true = overwrite, false = retain
  const [scheduleHistory, setScheduleHistory] = useState<Schedule[]>([]); // For undo/revert
  const [shareModalData, setShareModalData] = useState<{ isOpen: boolean; type: 'plan' | 'grocery'; data: any; dateRange: string; sourceLanguage?: 'English' | 'Hindi' }>({ isOpen: false, type: 'plan', data: null, dateRange: '' });
  const [loadedWeekRange, setLoadedWeekRange] = useState<string>('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(forceOnboarding || shouldShowTour());
  const [settingsManuallyClosed, setSettingsManuallyClosed] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null); // null = loading
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false); // Manual trigger for re-running wizard

  const [loading, setLoading] = useState(false);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'calendar' | 'grocery' | 'profile'>('plan');
  const [planStartDate, setPlanStartDate] = useState(new Date()); // Date to start showing meals from
  const [showLanding, setShowLanding] = useState(false); // Allow logged-in users to view landing page
  const [streamingDay, setStreamingDay] = useState(0);
  const [thinkingMessage, setThinkingMessage] = useState<string>('');
  const [partialDays, setPartialDays] = useState<DayPlan[]>([]);
  const [recipeMealName, setRecipeMealName] = useState<string | null>(null);
  const [isRecipePanelOpen, setIsRecipePanelOpen] = useState(false);
  const [isSavedRecipesPanelOpen, setIsSavedRecipesPanelOpen] = useState(false);
  const [isPhonePromptOpen, setIsPhonePromptOpen] = useState(false);

  // Trust action hooks for progressive credits
  useSignupTrustAction();
  usePhoneTrustSync(); // Sync phone between profile and trust action
  const awardProfileComplete = useProfileCompleteTrustAction();
  const awardSecondMenu = useSecondMenuTrustAction();
  const awardShareMenu = useShareMenuTrustAction();
  const { canInstall: canInstallPWA, installPWA } = usePWAInstallTrustAction();


  // Manual meal entries for empty week (before AI generation)
  const [manualMeals, setManualMeals] = useState<Record<string, { breakfast: string; lunch: string; dinner: string }>>({});

  // Save conflict modal state (when generating for week with existing meals)
  const [saveConflict, setSaveConflict] = useState<{
    plan?: WeeklyPlan;
    startDate: Date;
    existingMealCount: number;
  } | null>(null);

  // Get user ID
  const userId = user?.id || '';
  const isAuthenticated = !!user;

  // AI Config object
  const aiConfig = { apiKey, modelName };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) {
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      try {
        // Load profiles
        const loadedProfiles = await supabaseService.getPreferenceProfiles(userId);
        if (loadedProfiles.length > 0) {
          // Migration: Add default profiles to existing users who only have 1 profile
          if (loadedProfiles.length === 1) {
            const defaultProfiles: PreferenceProfile[] = DEFAULT_PROFILE_TEMPLATES.map(template => ({
              ...template,
              id: crypto.randomUUID()
            }));
            const allProfiles = [...loadedProfiles, ...defaultProfiles];
            setProfiles(allProfiles);
            // Save new profiles to Supabase
            for (const profile of defaultProfiles) {
              await supabaseService.savePreferenceProfile(profile, userId);
            }
          } else {
            setProfiles(loadedProfiles);
          }
          // Load current profile ID - check Supabase first for cross-device sync
          let savedCurrentId = localStorage.getItem('cookcommander_current_profile_id');

          // For authenticated users, also check Supabase for cross-device persistence
          if (userId) {
            try {
              const userSettings = await supabaseService.getUserSettings(userId);
              if (userSettings?.currentProfileId) {
                savedCurrentId = userSettings.currentProfileId;
              }
            } catch (e) {
              console.warn('Could not load user settings, using localStorage');
            }
          }

          if (savedCurrentId && loadedProfiles.find(p => p.id === savedCurrentId)) {
            setCurrentProfileId(savedCurrentId);
          } else {
            setCurrentProfileId(loadedProfiles[0].id);
          }
        } else {
          // New user - check if onboarding is completed
          const settings = await supabaseService.getUserSettings(userId);
          if (settings?.onboardingCompleted) {
            // Create default profiles for users who completed onboarding but lost profiles
            const defaultProfiles: PreferenceProfile[] = DEFAULT_PROFILE_TEMPLATES.map(template => ({
              ...template,
              id: crypto.randomUUID()
            }));
            const blankProfileId = crypto.randomUUID();
            const blankProfile: PreferenceProfile = {
              ...DEFAULT_PREFERENCES,
              id: blankProfileId,
              name: 'My Preferences'
            };
            const allProfiles = [blankProfile, ...defaultProfiles];
            setProfiles(allProfiles);
            setCurrentProfileId(blankProfileId);
            for (const profile of allProfiles) {
              await supabaseService.savePreferenceProfile(profile, userId);
            }
            setOnboardingCompleted(true);
          } else {
            // New user - show onboarding wizard
            setOnboardingCompleted(false);
            setDataLoading(false);
            return; // Skip loading other data until onboarding is complete
          }
        }

        // Load current plan
        const loadedPlan = await supabaseService.getCurrentPlan(userId, activeFamilyGroupId);

        // If no current plan, check if there are scheduled meals for current week
        if (loadedPlan) {
          setWeeklyPlan(loadedPlan);
        } else {
          // Check schedule for current week - this ensures existing meals show on page load
          const currentWeekStart = format(new Date(), 'yyyy-MM-dd');
          const weekFromSchedule = await supabaseService.getWeekFromSchedule(userId, currentWeekStart, activeFamilyGroupId);
          if (weekFromSchedule) {
            setWeeklyPlan(weekFromSchedule);
          } else {
            setWeeklyPlan(null);
          }
        }

        // Load schedule (personal or family based on mode)
        const loadedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
        setSchedule(loadedSchedule);

        // Load meal history
        const loadedHistory = await supabaseService.getMealHistory(userId);
        setMealHistory(loadedHistory);

        // Load household settings (country, language, household size, etc.)
        const loadedHouseholdSettings = await getHouseholdSettings(userId);
        setHouseholdSettings(loadedHouseholdSettings);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, userId]);

  // Subscribe to real-time schedule changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = supabaseService.subscribeToScheduleChanges(userId, (newSchedule) => {
      setSchedule(newSchedule);
    });

    return () => subscription.unsubscribe();
  }, [isAuthenticated, userId]);

  // Request notification permission on native app after user authenticates
  useEffect(() => {
    if (!isAuthenticated || !isNative()) return;

    // Request permission 2 seconds after login to not overwhelm user
    const timer = setTimeout(() => {
      notificationService.requestPermission();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Reload schedule when mode toggles between Personal and Family
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const reloadForMode = async () => {
      try {
        console.log('Mode changed, reloading schedule...', { isFamilyModeActive, familyGroupId: activeFamilyGroupId });
        const loadedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
        setSchedule(loadedSchedule);

        // Also reload weekly plan for current week
        const currentWeekStart = format(planStartDate, 'yyyy-MM-dd');
        const weekPlan = await supabaseService.getWeekFromSchedule(userId, currentWeekStart, activeFamilyGroupId);
        if (weekPlan) {
          setWeeklyPlan(weekPlan);
        } else {
          setWeeklyPlan(null);
        }

        // Clear grocery list when switching modes - user needs to regenerate for current mode's meals
        setGroceryList([]);
      } catch (error) {
        console.error('Error reloading data for mode:', error);
      }
    };

    reloadForMode();
  }, [isFamilyModeActive, activeFamilyGroupId]);

  // Real-time sync for Family Mode - when any family member makes changes, refresh
  useEffect(() => {
    if (!isAuthenticated || !isFamilyModeActive || !activeFamilyGroupId) return;

    // Subscribe to scheduled_meals changes (archived/confirmed meals)
    const scheduledMealsChannel = supabaseService.supabase
      .channel(`family_meals_${activeFamilyGroupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scheduled_meals',
        filter: `family_group_id=eq.${activeFamilyGroupId}`
      }, async () => {
        // Another family member made changes - refresh our data
        console.log('Family scheduled meal change detected, refreshing...');
        const loadedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
        setSchedule(loadedSchedule);


        // Always refresh weekly plan view from schedule - even if null (shows current state)
        const currentWeekStart = format(planStartDate, 'yyyy-MM-dd');
        const weekPlan = await supabaseService.getWeekFromSchedule(userId, currentWeekStart, activeFamilyGroupId);
        // Always update - null means no scheduled meals for this week, which is valid state
        setWeeklyPlan(weekPlan);
      })
      .subscribe();

    // Subscribe to weekly_plans changes (draft plans - edits, regenerates)
    const weeklyPlansChannel = supabaseService.supabase
      .channel(`family_plans_${activeFamilyGroupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'weekly_plans',
        filter: `family_group_id=eq.${activeFamilyGroupId}`
      }, async (payload) => {
        // Another family member edited the draft plan - refresh
        console.log('Family plan change detected, refreshing...', payload.eventType);
        const loadedPlan = await supabaseService.getCurrentPlan(userId, activeFamilyGroupId);
        if (loadedPlan) {
          setWeeklyPlan(loadedPlan);
        }
      })
      .subscribe();

    return () => {
      scheduledMealsChannel.unsubscribe();
      weeklyPlansChannel.unsubscribe();
    };
  }, [isAuthenticated, isFamilyModeActive, activeFamilyGroupId, userId, planStartDate]);

  // Save current profile ID to localStorage and Supabase
  useEffect(() => {
    // Only save if it's a valid UUID (not 'default' placeholder)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentProfileId);
    if (!isValidUUID) return;

    localStorage.setItem('cookcommander_current_profile_id', currentProfileId);
    // Also save to Supabase for authenticated users
    if (isAuthenticated && userId) {
      supabaseService.saveUserSettings(userId, { currentProfileId }).catch(console.error);
    }
  }, [currentProfileId, isAuthenticated, userId]);

  // Update meal history from schedule
  useEffect(() => {
    if (!user) {
      const history: MealHistoryEntry[] = [];
      Object.entries(schedule).forEach(([date, plan]) => {
        const dayPlan = plan as DayPlan;
        if (dayPlan.breakfast) history.push({ date, type: 'Breakfast', mealName: dayPlan.breakfast });
        if (dayPlan.lunch) history.push({ date, type: 'Lunch', mealName: dayPlan.lunch });
        if (dayPlan.dinner) history.push({ date, type: 'Dinner', mealName: dayPlan.dinner });
      });
      setMealHistory(history);
    }
  }, [schedule, user]);

  // Close alternatives sidebar when switching tabs
  useEffect(() => {
    if (activeTab !== 'plan') {
      setIsAlternativesSidebarOpen(false);
    }
  }, [activeTab]);

  // API key popup removed - backend provides default key

  const getActivePreferences = useCallback(() => {
    const profile = profiles.find(p => p.id === currentProfileId) || profiles[0] || DEFAULT_PREFERENCES;

    // Merge household settings into preferences for LLM context
    if (householdSettings) {
      return {
        ...profile,
        country: householdSettings.country || 'India',
        language: householdSettings.language || 'English',
        householdSize: householdSettings.householdSize || 4,
        portionSize: householdSettings.portionSize || 'regular',
        pantryStaples: householdSettings.pantryStaples || [],
        hasTiffin: householdSettings.hasTiffin || false,
        tiffinDays: householdSettings.tiffinDays || [],
        tiffinFor: householdSettings.tiffinFor || [],
        showPrepReminders: householdSettings.showPrepReminders ?? true,
        showQuantities: householdSettings.showQuantities ?? true,
      };
    }
    return { ...profile, country: 'India' }; // Default country to India
  }, [profiles, currentProfileId, householdSettings]);

  // Handle onboarding completion - create/update profile based on whether it's first time or re-run
  const handleOnboardingComplete = async (data: OnboardingData, isRerun: boolean = false) => {
    try {
      // Build consolidated context from all onboarding details for AI
      const contextParts: string[] = [];
      if (data.householdSize) contextParts.push(`Household size: ${data.householdSize} people`);
      if (data.portionSize) contextParts.push(`Portion preference: ${data.portionSize}`);
      if (data.mealComplexity) contextParts.push(`Cooking style: ${data.mealComplexity === 'quick' ? 'Quick & easy meals' : data.mealComplexity === 'elaborate' ? 'Elaborate cooking' : 'Balanced complexity'}`);
      if (data.cuisineStyle) contextParts.push(`Cuisine: ${data.cuisineStyle === 'regional' ? 'Regional/traditional' : data.cuisineStyle === 'fusion' ? 'Fusion/international' : 'Pan-Indian variety'}`);
      if (data.healthGoals?.length) contextParts.push(`Health goals: ${data.healthGoals.join(', ')}`);
      if (data.hasTiffin) {
        contextParts.push(`Needs tiffin-friendly meals on ${data.tiffinDays?.join(', ') || 'weekdays'} for ${data.tiffinFor?.join(', ') || 'office'}`);
      }
      if (data.nonVegPreferences?.length && data.nonVegFrequency) {
        contextParts.push(`Non-veg (${data.nonVegPreferences.join(', ')}) ${data.nonVegFrequency}`);
      }
      if (data.additionalContext) contextParts.push(data.additionalContext);

      const consolidatedContext = contextParts.join('. ');
      const fullInstructions = data.specialInstructions
        ? `${data.specialInstructions}\n\n--- User Profile Context ---\n${consolidatedContext}`
        : consolidatedContext;

      // Get existing profile if re-running
      const existingProfile = isRerun ? profiles.find(p => p.id === currentProfileId) : null;
      const profileId = existingProfile?.id || crypto.randomUUID();

      // Create/update profile - preserve existing meal preferences when re-running
      const updatedProfile: PreferenceProfile = {
        id: profileId,
        name: data.userName ? `${data.userName}'s Preferences` : (existingProfile?.name || 'My Preferences'),
        dietaryType: data.dietaryTypes[0] || 'Vegetarian',
        dietaryTypes: data.dietaryTypes,
        dietaryDetails: existingProfile?.dietaryDetails || '',
        allergies: data.allergies,
        dislikes: data.dislikes,
        // Preserve existing meal preferences when re-running
        breakfastPreferences: existingProfile?.breakfastPreferences || [],
        lunchPreferences: existingProfile?.lunchPreferences || [],
        dinnerPreferences: existingProfile?.dinnerPreferences || [],
        specialInstructions: fullInstructions,
        pantryStaples: existingProfile?.pantryStaples || [],
        mealsToPrepare: data.mealsToPrepare,
        nonVegPreferences: data.nonVegPreferences,
        language: data.language,
        quickCookInstructions: existingProfile?.quickCookInstructions || [],
        // Onboarding fields
        country: data.country,
        householdSize: data.householdSize,
        portionSize: data.portionSize,
        nonVegFrequency: data.nonVegFrequency as any,
        hasTiffin: data.hasTiffin,
        tiffinDays: data.tiffinDays,
        tiffinFor: data.tiffinFor,
        mealComplexity: data.mealComplexity,
        cuisineStyle: data.cuisineStyle,
        healthGoals: data.healthGoals,
      };

      // Save profile to Supabase
      await supabaseService.savePreferenceProfile(updatedProfile, userId);

      if (isRerun) {
        // Update existing profile in state (don't replace all profiles)
        setProfiles(prev => prev.map(p => p.id === profileId ? updatedProfile : p));
      } else {
        // First time - set this as the only profile
        setProfiles([updatedProfile]);
        setCurrentProfileId(profileId);

        // Mark onboarding as complete (only first time)
        await supabaseService.saveUserSettings(userId, {
          onboardingCompleted: true,
          displayName: data.userName,
          preferredLanguage: data.language,
          currentProfileId: profileId
        });
        setOnboardingCompleted(true);

        // Award trust action credit for completing profile
        await awardProfileComplete();

        // Apply referral code - check both manual input and localStorage (from signup link)
        const manualCode = data.referralCode?.trim();
        const storedCode = localStorage.getItem('pendingReferralCode');
        const referralCodeToApply = manualCode || storedCode;

        if (referralCodeToApply) {
          try {
            const referralResult = await applyReferral(userId, referralCodeToApply);
            if (referralResult.success) {
              console.log('Referral applied successfully - user gets 3 bonus credits');
              // Clear the stored referral code after successful application
              localStorage.removeItem('pendingReferralCode');
            } else {
              console.log('Referral not applied:', referralResult.error);
            }
          } catch (refError) {
            console.error('Referral application failed:', refError);
          }
        }

        // Generate first meal plan ONLY for first-time users (free)
        setLoading(true);
        try {
          const learningSummary = await supabaseService.getMealLearningSummary(userId);
          const generatedPlan = await generatePlanViaProxy(userId, updatedProfile, learningSummary, apiKey);
          setWeeklyPlan(generatedPlan);
          await supabaseService.savePlan(generatedPlan, userId, profileId, activeFamilyGroupId);
          await refreshCredits();

          // Check if 2nd generation - award trust action (database-tracked)
          awardSecondMenu();

          // Award referrer credits (if this user was referred)
          try {
            await awardReferrerCredits(userId);
          } catch (refAwardError) {
            console.error('Failed to award referrer credits:', refAwardError);
          }
        } catch (planError) {
          console.error('Failed to generate initial plan:', planError);
        } finally {
          setLoading(false);
        }

        // Finish data loading
        setDataLoading(false);
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
      throw error;
    }
  };

  const handleSaveProfile = async (updatedProfile: PreferenceProfile) => {
    try {
      await supabaseService.savePreferenceProfile(updatedProfile, userId);

      const existingIndex = profiles.findIndex(p => p.id === updatedProfile.id);
      let newProfiles = [...profiles];
      if (existingIndex >= 0) {
        newProfiles[existingIndex] = updatedProfile;
      } else {
        newProfiles.push(updatedProfile);
      }
      setProfiles(newProfiles);

      if (weeklyPlan) {
        handleUpdateGroceryList(weeklyPlan, updatedProfile);
      }
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      alert(`Failed to save profile: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await supabaseService.deletePreferenceProfile(profileId, userId);
      const newProfiles = profiles.filter(p => p.id !== profileId);
      setProfiles(newProfiles);
      // Switch to first remaining profile if deleted current
      if (currentProfileId === profileId && newProfiles.length > 0) {
        setCurrentProfileId(newProfiles[0].id);
      }
    } catch (error: any) {
      console.error('Failed to delete profile:', error);
      alert(`Failed to delete profile: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleLoadWeek = useCallback(async (date: Date) => {
    // Load 7 days starting from the selected date (not the week containing it)
    const start = date;
    const end = addDays(date, 6);
    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');

    // Set the loaded date range for share modal
    const dateRangeStr = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    setLoadedWeekRange(dateRangeStr);

    // Also update the planner start date so calendar shows correct selection
    setPlanStartDate(start);

    try {
      const sched = await supabaseService.getSchedule(userId, startDateStr, endDateStr, activeFamilyGroupId);

      const days: DayPlan[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(start, i);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const dayName = format(currentDate, 'EEEE');

        if (sched[dateKey]) {
          days.push({ ...sched[dateKey], day: dayName });
        } else {
          days.push({ day: dayName, breakfast: '', lunch: '', dinner: '' });
        }
      }

      setWeeklyPlan({ days });
      setActiveTab('plan');
    } catch (error) {
      console.error('Failed to load week:', error);
      alert('Failed to load selected dates into planner');
    }
  }, [userId]);

  const handleGeneratePlan = async (saveMode: 'overwrite' | 'fill-empty' = 'overwrite') => {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    // Check if user can generate (has credits or BYOK)
    const canProceed = canGenerate('meal');
    if (!canProceed) {
      alert('❌ Insufficient meal generation credits!\n\nYou need 1 credit to generate a meal plan.\n\nOptions:\n• Wait for weekly bonus (1 free meal every Sunday)\n• Upgrade your plan\n• Buy credit packs');
      setIsPricingOpen(true); // Show pricing modal
      return;
    }

    // Check rate limit
    const rateLimitOk = await checkRate('meal_generation');
    if (!rateLimitOk) {
      alert('⏱️ Rate limit exceeded. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setStreamingDay(0);
    setThinkingMessage('');
    setPartialDays([]);

    try {
      const prefs = getActivePreferences();

      // Fetch learning summary from last 3 months of accepted meals
      const learningSummary = await supabaseService.getMealLearningSummary(userId, 3);

      // Try streaming first (now with FULL prompt), fallback to regular API
      let plan: WeeklyPlan | null = null;

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/ai-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            preferences: prefs,
            learningSummary,
            userApiKey: apiKey
          })
        });

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'progress') {
                    setStreamingDay(data.day);
                  } else if (data.type === 'thinking') {
                    // Show thinking message in UI
                    setThinkingMessage(data.message);
                  } else if (data.type === 'chunk') {
                    fullText += data.text;
                    // Count and extract days from partial JSON
                    const dayMatches = fullText.match(/"day"\s*:\s*"[^"]+"/g) || [];
                    if (dayMatches.length > 0) {
                      setStreamingDay(Math.min(dayMatches.length, 7));

                      // Try to parse partial days for real-time display
                      try {
                        // Find all complete day objects using regex
                        const dayBlockRegex = /\{\s*"day"\s*:\s*"[^"]+"\s*,\s*"breakfast"\s*:\s*"[^"]*"\s*,\s*"lunch"\s*:\s*"[^"]*"\s*,\s*"dinner"\s*:\s*"[^"]*"[^}]*\}/g;
                        const completeDays = fullText.match(dayBlockRegex);
                        if (completeDays && completeDays.length > 0) {
                          const parsedDays = completeDays.map(dayStr => {
                            try {
                              return JSON.parse(dayStr);
                            } catch {
                              return null;
                            }
                          }).filter(Boolean) as DayPlan[];

                          if (parsedDays.length > 0) {
                            setPartialDays(parsedDays);
                          }
                        }
                      } catch {
                        // Ignore parse errors for partial JSON
                      }
                    }
                  } else if (data.type === 'complete' && data.data) {
                    plan = data.data as WeeklyPlan;
                    setStreamingDay(7);
                    setThinkingMessage('');
                    setPartialDays([]);
                  } else if (data.type === 'error') {
                    throw new Error(data.message);
                  }
                } catch (parseErr) {
                  // Ignore parse errors for partial data
                }
              }
            }
          }
        }
      } catch (streamError) {
        console.log('Streaming failed, falling back to regular API', streamError);
      }

      // Fallback to high-quality API if streaming didn't work
      if (!plan) {
        plan = await generatePlanViaProxy(userId, prefs, learningSummary, apiKey);
        setStreamingDay(7);
      }

      // Refresh credits after consumption
      await refreshCredits();

      // Save to Supabase weekly_plans table
      await supabaseService.savePlan(plan, userId, currentProfileId, activeFamilyGroupId);

      const startDateStr = format(planStartDate, 'yyyy-MM-dd');

      // Save based on selected mode
      if (saveMode === 'overwrite') {
        await supabaseService.mergeWeekMeals(plan, startDateStr, userId, 'overwrite', activeFamilyGroupId);
      } else {
        await supabaseService.mergeWeekMeals(plan, startDateStr, userId, 'fill-empty', activeFamilyGroupId);
      }

      // Reload the week to get merged result (important for fill-empty)
      const mergedPlan = await supabaseService.getWeekFromSchedule(userId, startDateStr, activeFamilyGroupId);
      if (mergedPlan) {
        setWeeklyPlan(mergedPlan);
      } else {
        setWeeklyPlan(plan); // Fallback
      }

      setManualMeals({}); // Clear any manual entries
      setLoadedWeekRange(''); // Clear so Share uses current week
      setActiveTab('plan');
      setLoading(false);
      setStreamingDay(0);

      // Check if 2nd generation - award trust action (database-tracked)
      awardSecondMenu();

      // Refresh schedule
      const updatedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
      setSchedule(updatedSchedule);

      // Generate grocery in background
      setGroceryLoading(true);
      // Use merged plan for groceries if available, otherwise generated plan
      await handleUpdateGroceryList(mergedPlan || plan, prefs);
      setGroceryLoading(false);

    } catch (error: any) {
      console.error("Plan Generation Error", error);
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.includes('API Key') || errorMessage.includes('API key')) {
        alert(`API Key Error: ${errorMessage}`);
        setIsSettingsOpen(true);
      } else {
        alert(`Failed to generate plan: ${errorMessage}`);
      }
      setLoading(false);
      setStreamingDay(0);
      setThinkingMessage('');
      setPartialDays([]);
    }
  };

  const handleRegenerateMeal = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (!weeklyPlan) return;

    // Check credits
    const canProceed = canGenerate('regen');
    if (!canProceed) {
      alert('❌ Insufficient credits!\n\nYou need credits to regenerate a meal.\n\nOptions:\n• Wait for weekly bonus\n• Upgrade your plan\n• Buy credit packs');
      setIsPricingOpen(true);
      return;
    }

    setRegenLoading(true);
    try {
      const currentMeal = weeklyPlan.days[dayIndex][mealType];
      const dayName = weeklyPlan.days[dayIndex].day;

      // Collect existing meals to avoid duplicates
      const existingMeals = weeklyPlan.days
        .flatMap(d => [d.breakfast, d.lunch, d.dinner])
        .filter(Boolean);

      const newMeal = await regenerateMealViaProxy(
        userId,
        currentMeal,
        mealType,
        getActivePreferences(),
        dayName,
        existingMeals,
        apiKey
      );
      const updatedPlan = { ...weeklyPlan };
      updatedPlan.days[dayIndex][mealType] = newMeal;
      setWeeklyPlan(updatedPlan);

      // Refresh credits after consumption
      await refreshCredits();

      // Save updated plan
      await supabaseService.savePlan(updatedPlan, userId, currentProfileId, activeFamilyGroupId);
    } catch (error) {
      console.error(error);
    } finally {
      setRegenLoading(false);
    }
  };

  const handleUpdateGroceryList = async (plan: WeeklyPlan, prefs: UserPreferences) => {
    // Check credits first
    const canProceed = canGenerate('grocery');
    if (!canProceed) {
      console.warn('Insufficient grocery credits for auto-generation');
      return;
    }

    try {
      // Generate grocery via secure proxy (credits handled server-side)
      const groceries = await generateGroceryViaProxy(userId, plan.days, prefs, apiKey);
      setGroceryList(groceries);
      // Refresh credits after consumption
      await refreshCredits();
    } catch (e) {
      console.error(e);
    }
  };

  // Check if any of the 7 days from planStartDate have existing meals in schedule
  const checkExistingMealsInRange = useCallback(() => {
    const datesWithMeals: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dateKey = format(addDays(planStartDate, i), 'yyyy-MM-dd');
      const existing = schedule[dateKey];
      if (existing && (existing.breakfast || existing.lunch || existing.dinner)) {
        datesWithMeals.push(format(addDays(planStartDate, i), 'MMM d'));
      }
    }
    return datesWithMeals;
  }, [schedule, planStartDate]);

  // Handle Regenerate button click - generation handles conflicts internally now
  const handleRegenerateClick = async () => {
    // Check conflicts BEFORE generating - respecting family mode
    const startDateStr = format(planStartDate, 'yyyy-MM-dd');
    const { total: existingCount } = await supabaseService.getWeekMealCount(userId, startDateStr, activeFamilyGroupId);

    if (existingCount > 0) {
      // Week has meals in current mode (personal or family) - show conflict modal
      setSaveConflict({
        startDate: planStartDate,
        existingMealCount: existingCount
      });
    } else {
      // Week is empty for current mode - proceed to generate and save
      handleGeneratePlan('overwrite');
    }
  };

  // Confirm regenerate with overwrite option, then generate and auto-save
  const handleRegenerateConfirm = async () => {
    setShowRegenerateConfirm(false);
    await handleGeneratePlan();
  };

  const handleArchiveClick = () => {
    if (!weeklyPlan) return;
    setShowArchiveModal(true);
  };

  const handleArchiveConfirm = async (dateStr: string, overwrite: boolean = true) => {
    if (!weeklyPlan) return;

    const startDate = parseISO(dateStr);
    if (isNaN(startDate.getTime())) {
      alert("Invalid Date");
      return;
    }

    try {
      // Save current schedule to history for revert
      setScheduleHistory(prev => [...prev.slice(-4), { ...schedule }]); // Keep last 5 states

      await supabaseService.archivePlanToSchedule(weeklyPlan, dateStr, userId);

      // Update local state with overwrite logic
      const newSchedule = { ...schedule };
      weeklyPlan.days.forEach((day, idx) => {
        const currentDate = addDays(startDate, idx);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const existing = schedule[dateKey];

        if (overwrite) {
          // Overwrite regardless of existing meals
          newSchedule[dateKey] = { ...day, day: dateKey };
        } else {
          // Only fill if no existing meals
          if (!existing || (!existing.breakfast && !existing.lunch && !existing.dinner)) {
            newSchedule[dateKey] = { ...day, day: dateKey };
          }
        }
      });

      setSchedule(newSchedule);

      // Keep the plan visible - don't clear it or switch tabs
      // Show success toast
      addToast('Plan saved to calendar! View it in Schedule & History.', 'success');
    } catch (error) {
      console.error('Failed to save to calendar:', error);
      addToast('Failed to save to calendar. Please try again.', 'error');
    }
  };

  // Revert to previous schedule state
  const handleRevertSchedule = async () => {
    if (scheduleHistory.length === 0) {
      alert('No previous state to revert to.');
      return;
    }

    const previousSchedule = scheduleHistory[scheduleHistory.length - 1];
    setSchedule(previousSchedule);
    setScheduleHistory(prev => prev.slice(0, -1));

    // Save reverted state to Supabase
    try {
      for (const dateKey of Object.keys(previousSchedule)) {
        await supabaseService.saveScheduledMeal(dateKey, previousSchedule[dateKey], userId, activeFamilyGroupId);
      }
    } catch (error) {
      console.error('Failed to save reverted state:', error);
    }
  };

  const toggleGroceryItem = (index: number) => {
    const newList = [...groceryList];
    newList[index].checked = !newList[index].checked;
    setGroceryList(newList);
  };

  const handleGenerateGroceryFromWeek = async (meals: { date: string; breakfast: string; lunch: string; dinner: string }[]) => {
    // No API key check - proxy handles it with platform key

    // Check credits
    const canProceed = canGenerate('grocery');
    if (!canProceed) {
      alert('❌ Insufficient credits!\n\nYou need credits to generate a grocery list.');
      setIsPricingOpen(true);
      return;
    }

    setGroceryLoading(true);
    try {
      const prefs = getActivePreferences();
      // Use secure AI proxy (credits handled server-side)
      const list = await generateGroceryViaProxy(userId, meals, prefs, apiKey);
      setGroceryList(list);
      setActiveTab('grocery');

      // Refresh credits after server-side consumption
      await refreshCredits();
    } catch (error: any) {
      console.error('Grocery generation error:', error);
      alert(`Failed to generate grocery list: ${error?.message || 'Unknown error'}`);
    } finally {
      setGroceryLoading(false);
    }
  };

  const handleSmartEditAnalyze = async (mealTypes: string[], instruction: string) => {
    if (!smartEditData || !weeklyPlan || !weeklyPlan.days[smartEditData.index]) {
      console.error('Invalid state for smart edit');
      return { options: {} };
    }

    // Check credits
    const canProceed = canGenerate('edit');
    if (!canProceed) {
      alert('❌ Insufficient credits!\n\nYou need credits to edit meals.');
      setIsPricingOpen(true);
      return { options: {} };
    }

    try {
      // Build current meals object
      const currentMeals: Record<string, string> = {};
      const dayData = weeklyPlan.days[smartEditData.index];
      mealTypes.forEach(type => {
        const normalizedType = type.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
        if (normalizedType === 'breakfast' || normalizedType === 'lunch' || normalizedType === 'dinner') {
          currentMeals[normalizedType] = dayData[normalizedType] || '';
        }
      });

      const result = await smartEditViaProxy(userId, currentMeals, instruction, mealTypes, getActivePreferences(), apiKey);
      // Refresh credits after consumption
      await refreshCredits();
      return result;
    } catch (error) {
      console.error(error);
      return { options: {} };
    }
  };

  const handleSmartEditConfirm = async (updates: Record<string, string>) => {
    if (!smartEditData || !weeklyPlan) return;

    // Deep clone to avoid mutation
    const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));

    // Apply all updates to the plan
    Object.entries(updates).forEach(([type, meal]) => {
      updatedPlan.days[smartEditData.index][type] = meal;
    });
    setWeeklyPlan(updatedPlan);

    // Calculate the date for this day
    const mealDate = format(addDays(planStartDate, smartEditData.index), 'yyyy-MM-dd');

    // Build day data for saving
    const dayData = {
      day: updatedPlan.days[smartEditData.index].day,
      breakfast: updatedPlan.days[smartEditData.index].breakfast || '',
      lunch: updatedPlan.days[smartEditData.index].lunch || '',
      dinner: updatedPlan.days[smartEditData.index].dinner || '',
      prepAhead: updatedPlan.days[smartEditData.index].prepAhead,
      alternatives: updatedPlan.days[smartEditData.index].alternatives,
    };

    // FIXED: Save to scheduled_meals for persistence (not weekly_plans)
    await supabaseService.saveScheduledMeal(mealDate, dayData, userId, activeFamilyGroupId);
  };


  // Handle inline meal edits in weekly planner
  // FIXED: Save to scheduled_meals for persistence (not weekly_plans which is lost on refresh)
  const handleMealUpdate = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => {
    if (!weeklyPlan) return;

    // 1. Optimistic update - update UI immediately
    const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
    updatedPlan.days[dayIndex][mealType] = newValue;
    setWeeklyPlan(updatedPlan);

    // 2. Calculate the date for this day index
    const mealDate = format(addDays(planStartDate, dayIndex), 'yyyy-MM-dd');

    // 3. Build the day data for saving
    const dayData = {
      day: updatedPlan.days[dayIndex].day,
      breakfast: updatedPlan.days[dayIndex].breakfast || '',
      lunch: updatedPlan.days[dayIndex].lunch || '',
      dinner: updatedPlan.days[dayIndex].dinner || '',
      prepAhead: updatedPlan.days[dayIndex].prepAhead,
      alternatives: updatedPlan.days[dayIndex].alternatives,
    };

    // 4. Save to scheduled_meals (PERMANENT) - respects personal vs family mode
    await supabaseService.saveScheduledMeal(mealDate, dayData, userId, activeFamilyGroupId);
  };


  const handleSelectAlternative = async (meal: string, dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    await handleMealUpdate(dayIndex, mealType, meal);
    setIsAlternativesSidebarOpen(false);
  };

  const handleRegenerateAlternatives = async () => {
    if (!weeklyPlan) return;

    setAlternativesLoading(true);
    try {
      const newAlternatives = await generateAlternativesViaProxy(
        userId,
        getActivePreferences(),
        weeklyPlan,
        apiKey
      );

      // Update the weeklyPlan with new alternatives
      const updatedPlan = { ...weeklyPlan, alternatives: newAlternatives };
      setWeeklyPlan(updatedPlan);
      await supabaseService.savePlan(updatedPlan, userId, currentProfileId, activeFamilyGroupId);
      await refreshCredits();
    } catch (error) {
      console.error('Failed to regenerate alternatives:', error);
      alert('Failed to generate alternatives. Please try again.');
    } finally {
      setAlternativesLoading(false);
    }
  };

  // Handle inline meal edits in schedule/calendar
  const handleScheduleMealUpdate = async (dateKey: string, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dateKey]) {
      newSchedule[dateKey] = { day: dateKey, breakfast: '', lunch: '', dinner: '' };
    }
    newSchedule[dateKey][mealType] = newValue;
    setSchedule(newSchedule);
    await supabaseService.saveScheduledMeal(dateKey, newSchedule[dateKey], userId, activeFamilyGroupId);
  };

  const handleTransferConfirm = async (targetDate: string, targetType: string, action: 'copy' | 'move', targetFamilyGroupId?: string | null) => {
    if (!transferData) return;

    const newSchedule = { ...schedule };
    const sourceKey = transferData.sourceDate;

    // Ensure Target Day Object Exists
    const existingTarget = newSchedule[targetDate] || { day: targetDate, breakfast: '', lunch: '', dinner: '' };
    newSchedule[targetDate] = { ...existingTarget };

    // Perform Copy
    newSchedule[targetDate][targetType.toLowerCase()] = transferData.sourceMealName;

    // Perform Move (Delete source)
    if (action === 'move') {
      const existingSource = newSchedule[sourceKey];
      if (existingSource) {
        newSchedule[sourceKey] = { ...existingSource };
        newSchedule[sourceKey][transferData.sourceMealType.toLowerCase()] = '';
      }
    }

    // Only update local state if staying in same mode
    const stayingInSameMode = targetFamilyGroupId === activeFamilyGroupId;
    if (stayingInSameMode) {
      setSchedule(newSchedule);
    }

    // Save to Supabase with the specified target family group
    try {
      // Use provided targetFamilyGroupId (could be different mode)
      await supabaseService.saveScheduledMeal(targetDate, newSchedule[targetDate], userId, targetFamilyGroupId);
      if (action === 'move' && newSchedule[sourceKey]) {
        // For move, source stays in current mode
        await supabaseService.saveScheduledMeal(sourceKey, newSchedule[sourceKey], userId, activeFamilyGroupId);
      }
    } catch (error) {
      console.error('Failed to save meal transfer:', error);
    }

    setTransferData(null);
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Show auth page if not authenticated and Supabase is configured
  if (!isAuthenticated && isConfigured) {
    return <LandingPage />;
  }

  // Show config message if Supabase not configured
  if (!isAuthenticated && !isConfigured) {
    return <LandingPage />;
  }

  // Show landing page for logged-in users who want to view it (logo click)
  if (showLanding) {
    return (
      <LandingPage
        isLoggedIn={!!user}
        userEmail={user?.email}
        onGoToDashboard={() => setShowLanding(false)}
        onSignOut={async () => { await signOut(); setShowLanding(false); }}
      />
    );
  }

  // Show loading while fetching data
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-gray-500">Loading your data...</p>
      </div>
    );
  }

  // Show onboarding wizard for new users OR when manually triggered
  if (isAuthenticated && (onboardingCompleted === false || showOnboardingWizard)) {
    // Detect if this is a re-run (user triggered from preferences, not first time)
    const isRerun = showOnboardingWizard && onboardingCompleted === true;

    // Get current profile to pre-fill wizard when re-running
    const currentProfile = profiles.find(p => p.id === currentProfileId);
    const initialDataFromProfile = isRerun && currentProfile ? {
      userName: currentProfile.name?.replace("'s Preferences", '') || '',
      country: currentProfile.country || 'India',
      language: currentProfile.language || 'English',
      householdSize: currentProfile.householdSize || 4,
      portionSize: currentProfile.portionSize || 'regular',
      dietaryTypes: currentProfile.dietaryTypes || [currentProfile.dietaryType || 'Vegetarian'],
      nonVegPreferences: currentProfile.nonVegPreferences || [],
      nonVegFrequency: currentProfile.nonVegFrequency || '',
      mealsToPrepare: currentProfile.mealsToPrepare || ['breakfast', 'lunch', 'dinner'],
      hasTiffin: currentProfile.hasTiffin || false,
      tiffinDays: currentProfile.tiffinDays || [],
      tiffinFor: currentProfile.tiffinFor || [],
      mealComplexity: currentProfile.mealComplexity || 'balanced',
      cuisineStyle: currentProfile.cuisineStyle || 'pan-indian',
      dislikes: currentProfile.dislikes || [],
      allergies: currentProfile.allergies || [],
      healthGoals: currentProfile.healthGoals || [],
      specialInstructions: currentProfile.specialInstructions || ''
    } : undefined;

    return (
      <OnboardingWizard
        onComplete={async (data) => {
          await handleOnboardingComplete(data, isRerun);
          setShowOnboardingWizard(false);
        }}
        initialData={initialDataFromProfile}
        isRerun={isRerun}
        onSkip={isRerun ? () => setShowOnboardingWizard(false) : undefined}
      />
    );
  }

  const activeProfileName = profiles.find(p => p.id === currentProfileId)?.name || 'Default';

  return (
    <div className="min-h-dvh pb-20 md:pb-0 bg-gray-50 flex flex-col">
      {/* Launch Banner */}
      <LaunchBanner onShowPricing={() => setIsPricingOpen(true)} />




      {/* Profile View (Mobile Only) */}
      {activeTab === 'profile' ? (
        <main className="flex-1 w-full bg-gray-50 animate-in fade-in duration-300">
          <ProfileView
            userEmail={user?.email || null}
            userId={user?.id || null}
            onSignOut={signOut}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenPreferences={() => setIsPreferencesOpen(true)}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onStartTour={() => setShowTour(true)}
            onOpenPricing={() => setIsPricingOpen(true)}
            onDeleteAccount={() => setIsDeleteAccountOpen(true)}
            onOpenSavedRecipes={() => setIsSavedRecipesPanelOpen(true)}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full pb-24 md:pb-6">
          <div className="flex flex-col h-full gap-6">

            {/* Desktop Nav with Preferences Access */}
            <div className="hidden md:flex items-center justify-between border-b border-gray-200 mb-2">
              <div className="flex">
                {[
                  { id: 'plan', label: 'Weekly Planner', icon: ClipboardList },
                  { id: 'calendar', label: 'Schedule & History', icon: CalendarIcon },
                  { id: 'grocery', label: 'Grocery List', icon: ShoppingCart }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    data-tour={tab.id === 'grocery' ? 'grocery-tab-desktop' : tab.id === 'calendar' ? 'calendar-tab-desktop' : undefined}
                    className={`flex items-center gap-2 py-3 px-6 border-b-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              {/* Right side: Profile, Generate, UserMenu */}
              <div className="flex items-center gap-2">
                {/* Profile Dropdown */}
                <select
                  value={currentProfileId}
                  onChange={(e) => setCurrentProfileId(e.target.value)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors border-none focus:ring-2 focus:ring-orange-500 max-w-[130px] truncate"
                  title="Switch Meal Preference"
                  data-tour="profile-selector"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsPreferencesOpen(true)}
                  className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Edit Preferences"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* User Menu */}
                <UserMenu
                  userEmail={user?.email || null}
                  userId={user?.id || null}
                  onSignOut={signOut}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenPreferences={() => setIsPreferencesOpen(true)}
                  onOpenFeedback={() => setIsFeedbackOpen(true)}
                  onStartTour={() => setShowTour(true)}
                  onOpenPricing={() => setIsPricingOpen(true)}
                  onDeleteAccount={() => setIsDeleteAccountOpen(true)}
                  onInstallPWA={canInstallPWA ? installPWA : undefined}
                />
              </div>
            </div>

            {/* PLANNER TAB */}
            <div className={`${activeTab === 'plan' ? 'block' : 'hidden'}`}>
              {/* Trust Progress Card for Free Tier Users */}
              {isTrialActive && (
                <TrustProgressCard
                  className="mb-4"
                  compact
                  onAddPhone={() => setIsPhonePromptOpen(true)}
                  onInstallPWA={canInstallPWA ? installPWA : undefined}
                />
              )}
              {/* Calendar Strip */}
              <PlannerDateStrip
                selectedDate={planStartDate}
                onDateSelect={async (date) => {
                  setPlanStartDate(date);
                  // Load saved meals for this week from schedule
                  const weekStart = format(date, 'yyyy-MM-dd');
                  const weekPlan = await supabaseService.getWeekFromSchedule(userId, weekStart, activeFamilyGroupId);
                  if (weekPlan) {
                    setWeeklyPlan(weekPlan);
                  } else {
                    // No saved meals for this week - show empty state
                    setWeeklyPlan(null);
                  }
                }}
                schedule={schedule}
              />

              {/* Header with actions - Compact layout with profile on mobile */}
              <div className="flex justify-between items-center my-4 px-1">
                <div className="flex items-center gap-2">
                  {/* Mobile Profile Selector - Compact inline */}
                  <div className="md:hidden flex items-center gap-1.5">
                    <div className="relative">
                      <select
                        value={currentProfileId}
                        onChange={(e) => setCurrentProfileId(e.target.value)}
                        className="appearance-none bg-white border-2 border-gray-200 rounded-lg pl-2 pr-6 py-2 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all max-w-[90px] truncate"
                      >
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => setIsPreferencesOpen(true)}
                      className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border-2 border-gray-200 shadow-sm"
                      title="Meal Preferences"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {/* Generate/Regenerate Button - Always visible */}
                  <button
                    onClick={handleRegenerateClick}
                    disabled={loading}
                    data-tour="generate-button"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-all ${weeklyPlan
                      ? 'bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                      } disabled:opacity-70`}
                    title={weeklyPlan ? "Regenerate meal plan" : "Generate new meal plan"}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{weeklyPlan ? 'Regenerate' : 'Generate Plan'}</span>
                    <span className="sm:hidden">{weeklyPlan ? 'Regen' : 'Generate'}</span>
                    {!weeklyPlan && <span className="text-orange-200 text-xs">(1 credit)</span>}
                  </button>
                  {weeklyPlan && (
                    <>
                      {/* Share - Minimal outline style */}
                      <button
                        onClick={() => {
                          const dateRangeStr = `${format(planStartDate, 'MMM d')} - ${format(addDays(planStartDate, 6), 'MMM d, yyyy')}`;
                          setShareModalData({
                            isOpen: true,
                            type: 'plan',
                            data: weeklyPlan,
                            dateRange: dateRangeStr,
                            sourceLanguage: getActivePreferences().language
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-indigo-500 text-indigo-600 rounded-lg hover:bg-indigo-50 text-sm font-bold shadow-sm"
                        title="Share plan"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Empty State - Show 7 editable meal cards */}
              {!weeklyPlan && !loading && (() => {
                const emptyDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const planDates = emptyDays.map((_, idx) => addDays(planStartDate, idx));

                // Rotating placeholder texts for each meal type
                const breakfastPlaceholders = ['Enter a tasty breakfast...', 'Add a morning delight...', 'Plan something yummy...', 'Start the day right...', 'Add your favorite...', 'Something quick & healthy...', 'Fuel up with...'];
                const lunchPlaceholders = ['Enter a satisfying lunch...', 'Add a midday treat...', 'Plan something filling...', 'Power through with...', 'Try something new...', 'Add comfort food...', 'Keep it light & fresh...'];
                const dinnerPlaceholders = ['Enter a delicious dinner...', 'Add an evening feast...', 'End the day deliciously...', 'Something special...', 'Add family favorites...', 'Try a new cuisine...', 'Keep it simple & tasty...'];

                const handleManualMealChange = (dateKey: string, mealType: 'breakfast' | 'lunch' | 'dinner', value: string) => {
                  setManualMeals(prev => ({
                    ...prev,
                    [dateKey]: {
                      ...prev[dateKey],
                      breakfast: prev[dateKey]?.breakfast || '',
                      lunch: prev[dateKey]?.lunch || '',
                      dinner: prev[dateKey]?.dinner || '',
                      [mealType]: value
                    }
                  }));
                };

                // Create weeklyPlan from manual meals if any exist
                const hasManualMeals = Object.values(manualMeals).some(m => m.breakfast || m.lunch || m.dinner);

                const handleSaveManualPlan = async () => {
                  if (!hasManualMeals) {
                    addToast('Please add at least one meal before saving.', 'warning');
                    return;
                  }

                  // Build plan from manual meals
                  const days = emptyDays.map((dayName, idx) => {
                    const dateKey = format(addDays(planStartDate, idx), 'yyyy-MM-dd');
                    const meals = manualMeals[dateKey] || { breakfast: '', lunch: '', dinner: '' };
                    return {
                      day: dayName,
                      breakfast: meals.breakfast || '',
                      lunch: meals.lunch || '',
                      dinner: meals.dinner || ''
                    };
                  });

                  // Set as weeklyPlan
                  setWeeklyPlan({ days });
                  addToast('Manual plan created! You can now save it to calendar.', 'success');
                };

                return (
                  <>
                    {/* Save Manual Plan Button */}
                    {hasManualMeals && (
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={handleSaveManualPlan}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
                        >
                          Create Plan from Manual Entries
                        </button>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {emptyDays.map((dayName, index) => {
                        const dateKey = format(planDates[index], 'yyyy-MM-dd');
                        const dayMeals = manualMeals[dateKey] || { breakfast: '', lunch: '', dinner: '' };

                        return (
                          <div key={dayName} className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-4 hover:border-orange-300 transition-colors focus-within:border-orange-400 focus-within:border-solid">
                            <div className="flex justify-between items-center mb-4">
                              <div>
                                <span className="font-bold text-gray-800">{dayName}</span>
                                <span className="text-sm text-gray-400 ml-2">{format(planDates[index], 'MMM d')}</span>
                              </div>
                            </div>
                            <div className="space-y-3">
                              {[{ type: 'breakfast' as const, placeholders: breakfastPlaceholders },
                              { type: 'lunch' as const, placeholders: lunchPlaceholders },
                              { type: 'dinner' as const, placeholders: dinnerPlaceholders }].map(({ type, placeholders }) => (
                                <div key={type} className="p-3 bg-gray-50 rounded-lg focus-within:bg-orange-50 transition-colors">
                                  <label className="text-xs font-medium text-gray-400 uppercase block mb-1">{type}</label>
                                  <input
                                    type="text"
                                    value={dayMeals[type]}
                                    onChange={(e) => handleManualMealChange(dateKey, type, e.target.value)}
                                    placeholder={placeholders[index]}
                                    className="w-full bg-transparent border-none text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {loading && <LoadingState currentDay={streamingDay} isStreaming={streamingDay > 0} thinkingMessage={thinkingMessage} partialDays={partialDays} />}

              {weeklyPlan && (() => {
                // Calculate dates starting from selected date in calendar strip
                const planDates = weeklyPlan.days.map((_, idx) => addDays(planStartDate, idx));

                return (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {weeklyPlan.days.map((day, index) => (
                      <div key={day.day} data-day-index={index}>
                        <MealCard
                          dayPlan={day}
                          dayIndex={index}
                          dateLabel={format(planDates[index], 'EEE, MMM d')}
                          onRegenerate={handleRegenerateMeal}
                          onSmartEdit={(plan, idx) => setSmartEditData({ dayPlan: plan, index: idx })}
                          onMealUpdate={handleMealUpdate}
                          isLoading={regenLoading}
                          isSwapMode={!!swapCandidate}
                          selectedSwap={swapCandidate}
                          showPrepReminders={getActivePreferences().showPrepReminders ?? true}
                          showQuantities={getActivePreferences().showQuantities ?? true}
                          isLastDay={index === weeklyPlan.days.length - 1}
                          onSwapSelect={(dayIdx, type) => {
                            if (swapCandidate?.dayIndex === dayIdx && swapCandidate?.mealType === type) {
                              setSwapCandidate(null);
                            } else {
                              setSwapCandidate({ dayIndex: dayIdx, mealType: type });
                              setIsAlternativesSidebarOpen(true);
                            }
                          }}
                          onOpenRecipe={(mealName) => {
                            setRecipeMealName(mealName);
                            setIsRecipePanelOpen(true);
                          }}
                          onUpgrade={() => setIsPricingOpen(true)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* CALENDAR TAB */}
            <div className={`${activeTab === 'calendar' ? 'block' : 'hidden'} h-[800px]`}>
              <CalendarView
                schedule={schedule}
                onInitiateTransfer={setTransferData}
                onGenerateGroceryFromWeek={handleGenerateGroceryFromWeek}
                groceryLoading={groceryLoading}
                onMealUpdate={handleScheduleMealUpdate}
                onRevert={handleRevertSchedule}
                canRevert={scheduleHistory.length > 0}
                onLoadWeek={handleLoadWeek}
                onShareMeals={(scheduleData, range) => {
                  // Convert schedule object to days array for sharing
                  const daysArray = Object.entries(scheduleData)
                    .filter(([, day]) => day.breakfast || day.lunch || day.dinner)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateKey, day]) => ({
                      day: dateKey,
                      breakfast: day.breakfast || '',
                      lunch: day.lunch || '',
                      dinner: day.dinner || ''
                    }));
                  setShareModalData({
                    isOpen: true,
                    type: 'plan',
                    data: { days: daysArray },
                    dateRange: range || 'Calendar Schedule',
                    sourceLanguage: getActivePreferences().language
                  });
                }}
              />
            </div>

            {/* GROCERY TAB */}
            <div className={`${activeTab === 'grocery' ? 'block' : 'hidden'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  Shopping List
                  {groceryLoading && <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />}
                </h2>
              </div>
              <GroceryList
                items={groceryList}
                onToggle={toggleGroceryItem}
                schedule={schedule}
                onGenerateFromDates={handleGenerateGroceryFromWeek}
                loading={groceryLoading}
                onLoadSavedList={(items) => setGroceryList(items)}
                userId={userId}
                onShare={(items, range) => setShareModalData({ isOpen: true, type: 'grocery', data: items, dateRange: range, sourceLanguage: getActivePreferences().language })}
              />
            </div>

          </div>
        </main>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Floating Edge Tab for Alternatives - only visible on Plan tab when plan exists */}
      {activeTab === 'plan' && weeklyPlan && !isAlternativesSidebarOpen && (
        <button
          onClick={() => setIsAlternativesSidebarOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-l from-orange-500 to-red-600 text-white px-2 py-4 rounded-l-xl shadow-lg hover:px-3 transition-all duration-300 group"
          title="Quick Swaps"
        >
          <div className="flex flex-col items-center gap-1">
            <Shuffle className="w-5 h-5" />
            <span className="text-[10px] font-bold writing-mode-vertical transform rotate-180" style={{ writingMode: 'vertical-rl' }}>Swaps</span>
          </div>
        </button>
      )}

      {/* Modals */}
      <MealAlternativesSidebar
        isOpen={isAlternativesSidebarOpen}
        onClose={() => {
          setIsAlternativesSidebarOpen(false);
          setSwapCandidate(null);
        }}
        alternatives={weeklyPlan?.alternatives || null}
        onSelectAlternative={handleSelectAlternative}
        selectedMeal={swapCandidate}
        onRegenerateAlternatives={handleRegenerateAlternatives}
        isLoading={alternativesLoading}
        weeklyPlan={weeklyPlan}
      />

      {isPreferencesOpen && (
        <PreferencesModal
          profiles={profiles}
          currentProfileId={currentProfileId}
          history={mealHistory}
          onSaveProfile={handleSaveProfile}
          onSwitchProfile={setCurrentProfileId}
          onDeleteProfile={handleDeleteProfile}
          onClose={() => setIsPreferencesOpen(false)}
          onRerunOnboarding={() => setShowOnboardingWizard(true)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          canClose={true}
          onDeleteAccount={() => setIsDeleteAccountOpen(true)}
          onInstallPWA={canInstallPWA ? installPWA : undefined}
        />
      )}

      {smartEditData && (
        <SmartEditModal
          dayPlan={smartEditData.dayPlan}
          preferences={getActivePreferences()}
          onAnalyze={handleSmartEditAnalyze}
          onConfirm={handleSmartEditConfirm}
          onClose={() => setSmartEditData(null)}
        />
      )}

      {transferData && (
        <MoveMealModal
          transfer={transferData}
          onConfirm={handleTransferConfirm}
          onClose={() => setTransferData(null)}
        />
      )}

      {showArchiveModal && (
        <ArchiveModal
          onConfirm={handleArchiveConfirm}
          onClose={() => setShowArchiveModal(false)}
          schedule={schedule}
          daysCount={weeklyPlan?.days.length || 7}
          startDateOverride={format(planStartDate, 'yyyy-MM-dd')}
        />
      )}

      {/* Regenerate Confirm Modal - shows when existing meals found */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-orange-100 p-1.5 rounded-lg text-orange-700">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-800">Regenerate Plan</h3>
              </div>
              <button onClick={() => setShowRegenerateConfirm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Existing meals found
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Some dates in this week already have scheduled meals: {checkExistingMealsInRange().slice(0, 4).join(', ')}{checkExistingMealsInRange().length > 4 ? '...' : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="regenerateOption"
                      checked={regenerateOverwrite}
                      onChange={() => setRegenerateOverwrite(true)}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="text-sm text-gray-700">
                      <strong>Overwrite</strong> - Replace existing meals with new plan
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="regenerateOption"
                      checked={!regenerateOverwrite}
                      onChange={() => setRegenerateOverwrite(false)}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="text-sm text-gray-700">
                      <strong>Keep existing</strong> - Only fill empty days
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="flex-1 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateConfirm}
                disabled={loading}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-70"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {regenerateOverwrite ? 'Overwrite & Generate' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}


      {shareModalData.isOpen && (
        <ShareModal
          isOpen={shareModalData.isOpen}
          onClose={() => setShareModalData({ ...shareModalData, isOpen: false })}
          type={shareModalData.type}
          data={shareModalData.data}
          dateRange={shareModalData.dateRange}
          sourceLanguage={shareModalData.sourceLanguage}
        />
      )}

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        userId={userId}
      />

      {/* Pricing Modal */}
      {isPricingOpen && (
        <PricingPage
          onClose={() => setIsPricingOpen(false)}
          onUpgradeSuccess={() => { }}
        />
      )}

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
      />
      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => setShowOnboarding(false)}
          isMobile={window.innerWidth < 768}
        />
      )}

      {/* Onboarding Tour - Spotlight-based walkthrough */}
      {showTour && (
        <OnboardingTour
          onComplete={() => setShowTour(false)}
          forceShow={forceOnboarding}
          onTriggerAction={(action) => {
            switch (action) {
              case 'open-preferences':
                setIsPreferencesOpen(true);
                break;
              case 'close-preferences':
                setIsPreferencesOpen(false);
                break;
              case 'switch-to-calendar':
                setActiveTab('calendar');
                break;
              case 'switch-to-grocery':
                setActiveTab('grocery');
                break;
              case 'switch-to-plan':
                setActiveTab('plan');
                break;
              case 'load-demo-plan':
                // Save user's current plan before loading demo
                savedPlanBeforeTour.current = weeklyPlan;
                setWeeklyPlan(DEMO_MEAL_PLAN);
                setActiveTab('plan');
                break;
              case 'load-demo-grocery':
                // Save user's current grocery before loading demo
                savedGroceryBeforeTour.current = groceryList;
                setGroceryList(DEMO_GROCERY_LIST);
                break;
              case 'clear-demo':
                // Restore user's data when tour ends (don't wipe their real data)
                if (savedPlanBeforeTour.current !== null) {
                  setWeeklyPlan(savedPlanBeforeTour.current);
                  savedPlanBeforeTour.current = null;
                }
                if (savedGroceryBeforeTour.current.length > 0) {
                  setGroceryList(savedGroceryBeforeTour.current);
                  savedGroceryBeforeTour.current = [];
                }
                break;
            }
          }}
        />
      )}

      {/* Demo Mode Badge */}
      {demoMode && (
        <div className="fixed bottom-4 left-4 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold z-50 shadow-lg flex items-center gap-2">
          <span>🎓</span> DEMO MODE
        </div>
      )}

      {/* Save Conflict Modal */}
      <SaveConflictModal
        isOpen={!!saveConflict}
        onClose={() => setSaveConflict(null)}
        onOverwriteAll={() => {
          setSaveConflict(null);
          handleGeneratePlan('overwrite');
        }}
        onFillEmpty={() => {
          setSaveConflict(null);
          handleGeneratePlan('fill-empty');
        }}
        startDate={saveConflict?.startDate || new Date()}
        existingMealCount={saveConflict?.existingMealCount || 0}
      />

      {/* Recipe Panel - Overlay for viewing meal recipes */}
      <RecipePanel
        mealName={recipeMealName}
        isOpen={isRecipePanelOpen}
        onClose={() => {
          setIsRecipePanelOpen(false);
          setRecipeMealName(null);
        }}
      />

      {/* Saved Recipes Panel - List of user's favorite recipes */}
      <SavedRecipesPanel
        isOpen={isSavedRecipesPanelOpen}
        onClose={() => setIsSavedRecipesPanelOpen(false)}
        onSelectRecipe={(mealName) => {
          setIsSavedRecipesPanelOpen(false);
          setRecipeMealName(mealName);
          setIsRecipePanelOpen(true);
        }}
      />

      {/* Phone Prompt Modal for Trust Actions */}
      <PhonePromptModal
        isOpen={isPhonePromptOpen}
        onClose={() => setIsPhonePromptOpen(false)}
        onSuccess={(credits) => {
          addToast(`🎉 +${credits} credits earned for adding phone!`, 'success');
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;