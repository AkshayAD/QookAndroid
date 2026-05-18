import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChefHat, ShoppingCart, Settings, RefreshCw, CalendarDays, FileText, Archive, ChevronDown, Calendar as CalendarIcon, ClipboardList, LogOut, Cpu, Share2, MessageSquareHeart, Sparkles, Shuffle, CalendarPlus, Pencil, Brain, Refrigerator, Users, Home, Ban, PackageOpen, ChevronRight, BookHeart } from 'lucide-react';
import { WeeklyPlan, PersistedWeeklyPlan, UserPreferences, GroceryItem, PreferenceProfile, MealHistoryEntry, DayPlan, Schedule, MealTransfer, InventoryItem, PreferenceSignal } from './types';
import { DEFAULT_PREFERENCES, DEFAULT_PROFILE_TEMPLATES } from './constants';
import { DEMO_MEAL_PLAN, DEMO_GROCERY_LIST } from './constants/demoData';
import { generatePlanViaProxy, generateGroceryViaProxy, regenerateMealViaProxy, smartEditViaProxy, generateAlternativesViaProxy, type SmartEditMealUpdates } from './services/aiProxyService';
// Removed: generateGroceryListFromSchedule - now using generateGroceryViaProxy for all grocery generation
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './contexts/SettingsContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { useFamily } from './contexts/FamilyContext';
import { supabase } from './lib/supabase';
import * as supabaseService from './services/supabaseService';
import { HouseholdSettings, saveHouseholdSettings } from './services/supabaseService';
import { clearBootstrapCache, fetchBootstrapData } from './services/bootstrapService';
import { applyReferral, awardReferrerCredits } from './services/referralService';
import MealCard from './components/MealCard';
import UserMenu from './components/UserMenu';
import { ToastContainer, useToast } from './components/Toast';
import BottomNav from './components/BottomNav';
import PlannerDateStrip from './components/PlannerDateStrip';
import PlannerActionStrip from './components/PlannerActionStrip';
import PlannerStatusRail from './components/PlannerStatusRail';
import SaveConflictModal from './components/SaveConflictModal';
import LoadingState from './components/LoadingState';
import FamilyModeToggle from './components/FamilyModeToggle';
import TrustProgressCard from './components/TrustProgressCard';
import PhonePromptModal from './components/PhonePromptModal';
import PreferenceLearningSheet from './components/PreferenceLearningSheet';
import { useSignupTrustAction, useSecondMenuTrustAction, useShareMenuTrustAction, usePhoneTrustSync } from './hooks/useTrustActions';
import { OnboardingData } from './types';
import { differenceInCalendarDays, format, addDays, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { getApiBaseUrl, isNative } from './utils/platform';
import { DEFAULT_NOTIFICATION_SETTINGS, notificationService, NotificationSettings } from './services/notificationService';
import { buildInventorySummary, createMealReplacementSignal, createRegenerateSignal, createSmartEditSignal, summarizePreferenceSignals } from './services/plannerMemoryService';
import { sanitizeDayPlan, sanitizeGroceryItems } from './lib/mealSanitizer';
import { applySparseMealUpdatesToDay, formatSelectedMealsLabel, getCollapsedKitchenMemoryLabel, normalizeDayForSelectedMeals, normalizeSelectedMeals, normalizeWeeklyPlanForSelectedMeals, type SelectableMealType } from './lib/mealSelection';
import { buildWeekFromSchedule } from './lib/plannerResolution';
import { mergePreferenceSummaryIntoProfile } from './lib/preferenceProfile';
import { formatCompactDateRange } from './lib/dateRange';
import { getUserCredits } from './services/subscriptionService';

interface AppProps {
  forceOnboarding?: boolean;
  demoMode?: boolean;
}

const loadPreferencesModal = () => import('./components/PreferencesModal');
const loadGroceryList = () => import('./components/GroceryList');
const loadSmartEditModal = () => import('./components/SmartEditModal');
const loadCalendarView = () => import('./components/CalendarView');
const loadMoveMealModal = () => import('./components/MoveMealModal');
const loadArchiveModal = () => import('./components/ArchiveModal');
const loadLandingPage = () => import('./components/LandingPage');
const loadSettingsModal = () => import('./components/SettingsModal');
const loadShareModal = () => import('./components/ShareModal');
const loadFeedbackModal = () => import('./components/FeedbackModal');
const loadPricingPage = () => import('./components/PricingPage');
const loadDeleteAccountModal = () => import('./components/DeleteAccountModal');
const loadMealAlternativesSidebar = () => import('./components/MealAlternativesSidebar');
const loadOnboardingModal = () => import('./components/OnboardingModal');
const loadProfileView = () => import('./components/ProfileView');
const loadOnboardingTour = () => import('./components/OnboardingTour');
const loadOnboardingWizard = () => import('./components/OnboardingWizard');
const loadRecipePanel = () => import('./components/RecipePanel');
const loadSavedRecipesPanel = () => import('./components/SavedRecipesPanel');
const loadInventoryCaptureModal = () => import('./components/InventoryCaptureModal');

const PreferencesModal = lazy(loadPreferencesModal);
const GroceryList = lazy(loadGroceryList);
const SmartEditModal = lazy(loadSmartEditModal);
const CalendarView = lazy(loadCalendarView);
const MoveMealModal = lazy(loadMoveMealModal);
const ArchiveModal = lazy(loadArchiveModal);
const LandingPage = lazy(loadLandingPage);
const SettingsModal = lazy(loadSettingsModal);
const ShareModal = lazy(loadShareModal);
const FeedbackModal = lazy(loadFeedbackModal);
const PricingPage = lazy(loadPricingPage);
const DeleteAccountModal = lazy(loadDeleteAccountModal);
const MealAlternativesSidebar = lazy(loadMealAlternativesSidebar);
const OnboardingModal = lazy(loadOnboardingModal);
const ProfileView = lazy(loadProfileView);
const OnboardingTour = lazy(loadOnboardingTour);
const OnboardingWizard = lazy(loadOnboardingWizard);
const RecipePanel = lazy(loadRecipePanel);
const SavedRecipesPanel = lazy(loadSavedRecipesPanel);
const InventoryCaptureModal = lazy(loadInventoryCaptureModal);

const BUILT_IN_PROFILE_NAME_KEYS = new Set(
  ['My Preferences', ...DEFAULT_PROFILE_TEMPLATES.map((template) => template.name)].map((name) =>
    name.trim().toLowerCase()
  )
);

const isBuiltInProfile = (profile: PreferenceProfile): boolean => (
  BUILT_IN_PROFILE_NAME_KEYS.has(profile.name.trim().toLowerCase())
);

const FullScreenLoader = ({ message = 'Loading...' }: { message?: string }) => (
  <div className="app-content-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
    <p className="text-gray-500">{message}</p>
  </div>
);

const SectionLoader = ({ className = 'py-16' }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
  </div>
);

const OverlayLoader = () => (
  <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
    <div className="rounded-2xl bg-white/95 px-5 py-4 shadow-xl flex items-center gap-3">
      <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
      <span className="text-sm font-medium text-gray-700">Loading...</span>
    </div>
  </div>
);

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

  const [weeklyPlan, setWeeklyPlan] = useState<PersistedWeeklyPlan | null>(
    demoMode
      ? { ...DEMO_MEAL_PLAN, weekStartDate: format(new Date(), 'yyyy-MM-dd') }
      : null
  );
  const [groceryList, setGroceryList] = useState<GroceryItem[]>(demoMode ? DEMO_GROCERY_LIST : []);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [householdSettings, setHouseholdSettings] = useState<HouseholdSettings | null>(null);
  const [userProfile, setUserProfile] = useState<supabaseService.UserProfile | null>(null);

  // Refs to save user's data during tour demo (to restore after tour ends)
  const savedPlanBeforeTour = useRef<PersistedWeeklyPlan | null>(null);
  const savedGroceryBeforeTour = useRef<GroceryItem[]>([]);
  const savedGroceryRangeBeforeTour = useRef('');

  const [mealHistory, setMealHistory] = useState<MealHistoryEntry[]>([]);

  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlternativesSidebarOpen, setIsAlternativesSidebarOpen] = useState(false);
  const [swapCandidate, setSwapCandidate] = useState<{ dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner' } | null>(null);
  const [smartEditData, setSmartEditData] = useState<{ dayPlan: DayPlan, index: number } | null>(null);
  const [transferData, setTransferData] = useState<MealTransfer | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [scheduleHistory, setScheduleHistory] = useState<Schedule[]>([]); // For undo/revert
  const [shareModalData, setShareModalData] = useState<{ isOpen: boolean; type: 'plan' | 'grocery'; data: any; dateRange: string; sourceLanguage?: 'English' | 'Hindi' }>({ isOpen: false, type: 'plan', data: null, dateRange: '' });
  const [loadedWeekRange, setLoadedWeekRange] = useState<string>('');
  const [currentGroceryDateRange, setCurrentGroceryDateRange] = useState<string>('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [settingsManuallyClosed, setSettingsManuallyClosed] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null); // null = loading
  const [tourCompletedAt, setTourCompletedAt] = useState<string | null>(null);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false); // Manual trigger for re-running wizard
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [preferenceSignals, setPreferenceSignals] = useState<PreferenceSignal[]>([]);
  const [isInventoryCaptureOpen, setIsInventoryCaptureOpen] = useState(false);
  const [inventoryFlowMode, setInventoryFlowMode] = useState<'planner' | 'onboarding'>('planner');
  const [isLearningSheetOpen, setIsLearningSheetOpen] = useState(false);
  const [isApplyingLearning, setIsApplyingLearning] = useState(false);
  const [learningApplyError, setLearningApplyError] = useState<string | null>(null);
  const [regenSignalCounts, setRegenSignalCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'grocery' | 'preferences' | 'profile'>('plan');
  const [grocerySubTab, setGrocerySubTab] = useState<'list' | 'calendar'>('list');
  const [isPreferencesKitchenSetupExpanded, setIsPreferencesKitchenSetupExpanded] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationSettingsLoaded, setNotificationSettingsLoaded] = useState(false);
  const [planStartDate, setPlanStartDate] = useState(new Date()); // Loaded 7-day planner range anchor
  const [selectedPlannerDate, setSelectedPlannerDate] = useState(new Date()); // Non-destructive planner date preview
  const [showLanding, setShowLanding] = useState(false); // Allow logged-in users to view landing page
  const [streamingDay, setStreamingDay] = useState(0);
  const [thinkingMessage, setThinkingMessage] = useState<string>('');
  const [partialDays, setPartialDays] = useState<DayPlan[]>([]);
  const [recipeMealName, setRecipeMealName] = useState<string | null>(null);
  const [isRecipePanelOpen, setIsRecipePanelOpen] = useState(false);
  const [isSavedRecipesPanelOpen, setIsSavedRecipesPanelOpen] = useState(false);
  const [isPhonePromptOpen, setIsPhonePromptOpen] = useState(false);
  const lastSmartEditInstructionRef = useRef('');
  const lastPromptedLearningKeyRef = useRef('');
  const previousSessionUserIdRef = useRef<string | null>(null);
  const lastModeReloadKeyRef = useRef<string | null>(null);
  const hasHydratedProfileSelectionRef = useRef(false);

  // Trust action hooks for progressive credits
  useSignupTrustAction();
  usePhoneTrustSync(); // Sync phone between profile and trust action
  const awardSecondMenu = useSecondMenuTrustAction();
  const awardShareMenu = useShareMenuTrustAction();


  // Save conflict modal state (when generating for week with existing meals)
  const [saveConflict, setSaveConflict] = useState<{
    plan?: WeeklyPlan;
    startDate: Date;
    existingMealCount: number;
  } | null>(null);

  // Get user ID
  const userId = user?.id || (demoMode ? 'demo-user' : '');
  const isAuthenticated = demoMode || !!user;

  // AI Config object
  const aiConfig = { apiKey, modelName };

  const handleUserSignOut = useCallback(async () => {
    setShowLanding(false);
    await signOut();
  }, [signOut]);

  const applyHouseholdSettingsToProfile = useCallback((
    profile: PreferenceProfile,
    overrideSettings?: HouseholdSettings | null
  ): PreferenceProfile => {
    const settings = overrideSettings ?? householdSettings;

    return {
      ...profile,
      country: settings?.country || profile.country || 'India',
      language: settings?.language || profile.language || 'English',
      householdSize: settings?.householdSize ?? profile.householdSize ?? 4,
      portionSize: settings?.portionSize || profile.portionSize || 'regular',
      pantryStaples: settings?.pantryStaples ?? profile.pantryStaples ?? [],
      hasTiffin: settings?.hasTiffin ?? profile.hasTiffin ?? false,
      tiffinDays: settings?.tiffinDays ?? profile.tiffinDays ?? [],
      tiffinFor: settings?.tiffinFor ?? profile.tiffinFor ?? [],
      showPrepReminders: settings?.showPrepReminders ?? profile.showPrepReminders ?? true,
      showQuantities: settings?.showQuantities ?? profile.showQuantities ?? true,
    };
  }, [householdSettings]);

  const getActivePreferences = useCallback(() => {
    const profile = profiles.find((entry) => entry.id === currentProfileId) || profiles[0] || DEFAULT_PREFERENCES;
    return applyHouseholdSettingsToProfile(profile as PreferenceProfile);
  }, [profiles, currentProfileId, applyHouseholdSettingsToProfile]);

  const activePreferences = useMemo(() => getActivePreferences(), [getActivePreferences]);
  const inventorySummary = useMemo(() => buildInventorySummary(inventoryItems), [inventoryItems]);
  const pendingSignals = useMemo(
    () => preferenceSignals.filter((signal) => signal.requiresConfirmation && !signal.appliedAt),
    [preferenceSignals]
  );
  const pendingSignalSummary = useMemo(
    () => pendingSignals.length > 0 ? summarizePreferenceSignals(pendingSignals, activePreferences) : null,
    [pendingSignals, activePreferences]
  );
  const canReviewLearning = Boolean(pendingSignalSummary && pendingSignalSummary.meaningfulSignalCount > 0);
  const selectedMeals = useMemo(
    () => normalizeSelectedMeals(activePreferences.mealsToPrepare),
    [activePreferences.mealsToPrepare]
  );
  const kitchenSetupSummary = useMemo(() => {
    const pantryStaples = activePreferences.pantryStaples || [];
    const dislikes = activePreferences.dislikes || [];
    const tiffinDays = activePreferences.tiffinDays || [];
    const householdSize = activePreferences.householdSize || 4;
    const portionSize = activePreferences.portionSize || 'regular';

    return {
      householdLabel: `${householdSize} ${householdSize === 1 ? 'person' : 'people'}`,
      mealCoverageLabel: formatSelectedMealsLabel(activePreferences.mealsToPrepare),
      portionLabel: portionSize.charAt(0).toUpperCase() + portionSize.slice(1),
      pantryCount: pantryStaples.length,
      dislikeCount: dislikes.length,
      inventoryLabel: inventorySummary.label,
      inventoryCount: inventorySummary.names.length,
      compactStatusLabel: getCollapsedKitchenMemoryLabel(
        inventorySummary.names.length,
        pantryStaples.length,
        Boolean(activePreferences.hasTiffin),
        tiffinDays
      ),
      tiffinSummary: activePreferences.hasTiffin
        ? `Tiffin on ${tiffinDays.length > 0 ? tiffinDays.join(', ') : 'weekdays'}`
        : 'No tiffin rules saved',
      showPrepReminders: activePreferences.showPrepReminders ?? true,
      showQuantities: activePreferences.showQuantities ?? true,
    };
  }, [activePreferences, inventorySummary]);
  const generationPreferences = useMemo<UserPreferences>(() => ({
    ...activePreferences,
    activeInventoryItems: inventorySummary.names,
    useInventoryFirst: inventorySummary.names.length > 0,
  }), [activePreferences, inventorySummary]);

  const buildPersistedPlannerPlan = useCallback((
    plan: WeeklyPlan,
    weekStart: Date = planStartDate,
    preferences: UserPreferences = generationPreferences
  ): PersistedWeeklyPlan => {
    const normalizedPlan = normalizeWeeklyPlanForSelectedMeals(
      {
        ...(plan as PersistedWeeklyPlan),
        weekStartDate: format(weekStart, 'yyyy-MM-dd'),
      },
      preferences.mealsToPrepare,
      preferences.showPrepReminders ?? true
    ) as PersistedWeeklyPlan;

    return {
      ...normalizedPlan,
      weekStartDate: format(weekStart, 'yyyy-MM-dd'),
    };
  }, [generationPreferences, planStartDate]);

  const buildVisibleWeekPlanFromSchedule = useCallback((
    baseSchedule: Schedule,
    weekStart: Date = planStartDate,
    preferences: UserPreferences = generationPreferences
  ): PersistedWeeklyPlan => buildPersistedPlannerPlan(
    buildWeekFromSchedule(baseSchedule, format(weekStart, 'yyyy-MM-dd')),
    weekStart,
    preferences
  ), [buildPersistedPlannerPlan, generationPreferences, planStartDate]);

  const hasVisibleWeekMeals = useMemo(
    () => weeklyPlan?.days.some((day) => Boolean(day.breakfast || day.lunch || day.dinner)) ?? false,
    [weeklyPlan]
  );

  const getVisibleWeekDateRange = useCallback((weekStart: Date, daysCount: number = 7) => (
    formatCompactDateRange(weekStart, addDays(weekStart, Math.max(daysCount - 1, 0)))
  ), []);

  const replaceGroceryList = useCallback((items: GroceryItem[], dateRange?: string | null) => {
    setGroceryList(sanitizeGroceryItems(items));
    if (dateRange !== undefined) {
      setCurrentGroceryDateRange(dateRange || '');
    }
  }, []);

  const updateLocalScheduleDay = useCallback((dateKey: string, dayPlan: DayPlan) => {
    setSchedule((previous) => ({
      ...previous,
      [dateKey]: sanitizeDayPlan({
        ...dayPlan,
        day: dateKey,
      }),
    }));
  }, []);

  useEffect(() => {
    const defaultDate = new Date();
    const currentUserId = user?.id || null;
    const previousUserId = previousSessionUserIdRef.current;
    const shouldResetForSessionChange = previousUserId !== null && previousUserId !== currentUserId;

    if (!user || shouldResetForSessionChange) {
      setProfiles([]);
      setCurrentProfileId('default');
      setWeeklyPlan(demoMode ? { ...DEMO_MEAL_PLAN, weekStartDate: format(defaultDate, 'yyyy-MM-dd') } : null);
      replaceGroceryList(demoMode ? DEMO_GROCERY_LIST : [], '');
      setSchedule({});
      setHouseholdSettings(null);
      setUserProfile(null);
      setMealHistory([]);
      setActiveTab('plan');
      setGrocerySubTab('list');
      setPlanStartDate(defaultDate);
      setSelectedPlannerDate(defaultDate);
      setLoadedWeekRange('');
      setSwapCandidate(null);
      setSmartEditData(null);
      setTransferData(null);
      setScheduleHistory([]);
      setInventoryItems([]);
      setPreferenceSignals([]);
      setIsAlternativesSidebarOpen(false);
      setShowLanding(false);
      setShowTour(false);
      setTourCompletedAt(null);
      setShowOnboardingWizard(false);
      if (!user) {
        previousSessionUserIdRef.current = null;
        return;
      }
    }

    setShowLanding(false);
    previousSessionUserIdRef.current = currentUserId;
  }, [demoMode, replaceGroceryList, user]);

  useEffect(() => {
    if (!isAuthenticated || dataLoading || onboardingCompleted === false) {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const preloadDeferredSurfaces = () => {
      void loadProfileView();
      void loadGroceryList();
      void loadCalendarView();
      void loadPreferencesModal();
      void loadSettingsModal();
      void loadShareModal();
      void loadPricingPage();
      void loadSmartEditModal();
      void loadMealAlternativesSidebar();
      void loadRecipePanel();
      void loadSavedRecipesPanel();
    };

    let idleHandle: number | undefined;
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(preloadDeferredSurfaces);
    } else {
      idleHandle = window.setTimeout(preloadDeferredSurfaces, 400);
    }

    return () => {
      if (idleHandle === undefined) {
        return;
      }

      if (idleWindow.cancelIdleCallback && idleWindow.requestIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
        return;
      }

      window.clearTimeout(idleHandle);
    };
  }, [dataLoading, isAuthenticated, onboardingCompleted]);

  // Load initial data
  useEffect(() => {
    let isActive = true;

    const fallbackHouseholdSettings: HouseholdSettings = {
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

    const runWithTimeout = async <T,>(
      promise: Promise<T>,
      fallbackValue: T,
      label: string,
      timeoutMs: number = 10000
    ): Promise<T> => {
      let timeoutId: number | undefined;

      try {
        return await Promise.race([
          promise,
          new Promise<T>((resolve) => {
            timeoutId = window.setTimeout(() => {
              console.warn(`[App] Timed out loading ${label}. Falling back to a safe default.`);
              resolve(fallbackValue);
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
    };

    const createRecoveryProfile = (): PreferenceProfile => ({
      ...DEFAULT_PREFERENCES,
      id: crypto.randomUUID(),
      name: 'My Preferences',
    });

    const removeBuiltInProfilesInBackground = (profilesToRemove: PreferenceProfile[]) => {
      if (!profilesToRemove.length) {
        return;
      }

      clearBootstrapCache();

      const savedCurrentProfileId = localStorage.getItem('cookcommander_current_profile_id');
      if (savedCurrentProfileId && profilesToRemove.some((profile) => profile.id === savedCurrentProfileId)) {
        localStorage.removeItem('cookcommander_current_profile_id');
      }

      void Promise.allSettled(
        profilesToRemove.map((profile) => supabaseService.deletePreferenceProfile(profile.id, userId))
      ).then((results) => {
        const rejected = results.filter(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );

        if (rejected.length > 0) {
          console.warn('[App] Some legacy built-in profiles could not be removed.', rejected);
        }
      });
    };

    const loadMealHistoryInBackground = () => {
      void runWithTimeout(
        supabaseService.getMealHistory(userId, 100),
        [],
        'meal history',
        6000
      ).then((loadedHistory) => {
        if (isActive) {
          setMealHistory(loadedHistory);
        }
      }).catch((error) => {
        console.warn('[App] Unable to refresh meal history in the background.', error);
      });
    };

    const loadData = async () => {
      if (demoMode) {
        const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const demoProfile: PreferenceProfile = {
          ...DEFAULT_PREFERENCES,
          id: 'demo-profile',
          name: 'Demo Preferences',
        };

        if (isActive) {
          setProfiles([demoProfile]);
          setCurrentProfileId(demoProfile.id);
          setHouseholdSettings(fallbackHouseholdSettings);
          setOnboardingCompleted(true);
          setTourCompletedAt(null);
          setShowTour(false);
          setWeeklyPlan({ ...DEMO_MEAL_PLAN, weekStartDate: currentWeekStart });
          replaceGroceryList(DEMO_GROCERY_LIST, getVisibleWeekDateRange(parseISO(currentWeekStart)));
          setDataLoading(false);
        }
        return;
      }

      if (!isAuthenticated) {
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      try {
        const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const currentWeekEnd = format(addDays(parseISO(currentWeekStart), 6), 'yyyy-MM-dd');
        const bootstrapPromise = fetchBootstrapData();
        const currentWeekSchedulePromise = runWithTimeout(
          supabaseService.getSchedule(userId, currentWeekStart, currentWeekEnd, activeFamilyGroupId),
          {},
          'visible schedule',
          6000
        );

        const [bootstrap, loadedSchedule] = await Promise.all([bootstrapPromise, currentWeekSchedulePromise]);
        const userSettings = bootstrap.userSettings;
        const allBootstrapProfiles = bootstrap.profiles || [];
        const builtInProfiles = allBootstrapProfiles.filter(isBuiltInProfile);
        const persistedProfiles = allBootstrapProfiles.filter((profile) => !isBuiltInProfile(profile));
        const onboardingIsComplete = userSettings?.onboardingCompleted === true;

        if (!onboardingIsComplete) {
          removeBuiltInProfilesInBackground(builtInProfiles);

          if (isActive) {
            setProfiles([]);
            setCurrentProfileId('default');
            setUserProfile(bootstrap.userProfile ?? null);
            setHouseholdSettings(bootstrap.householdSettings || fallbackHouseholdSettings);
            setOnboardingCompleted(false);
            setTourCompletedAt(userSettings?.tourCompletedAt ?? null);
            setShowTour(false);
            setDataLoading(false);
          }
          return;
        }

        let resolvedProfiles = persistedProfiles;
        removeBuiltInProfilesInBackground(builtInProfiles);

        if (resolvedProfiles.length === 0) {
          const recoveryProfile = createRecoveryProfile();
          resolvedProfiles = [recoveryProfile];
          clearBootstrapCache();
          if (bootstrap.profilesConfirmed) {
            void supabaseService.savePreferenceProfile(recoveryProfile, userId).catch((error) => {
              console.warn('[App] Unable to save recovery profile after bootstrap.', error);
            });
          }
        }

        const savedCurrentId = userSettings?.currentProfileId || localStorage.getItem('cookcommander_current_profile_id');
        const selectedProfile = (savedCurrentId && resolvedProfiles.find((profile) => profile.id === savedCurrentId))
          || resolvedProfiles[0];

        if (isActive) {
          setProfiles(resolvedProfiles);
          setCurrentProfileId(selectedProfile.id);
          setUserProfile(bootstrap.userProfile ?? null);
          setOnboardingCompleted(true);
          setTourCompletedAt(userSettings?.tourCompletedAt ?? null);
          setShowTour(false);
        }

        const initialMealsToPrepare = selectedProfile?.mealsToPrepare;
        const initialShowPrepReminders = selectedProfile?.showPrepReminders ?? true;
        const anchoredDate = parseISO(currentWeekStart);
        if (isActive && !isNaN(anchoredDate.getTime())) {
          setPlanStartDate(anchoredDate);
          setSelectedPlannerDate(anchoredDate);
        }
        if (isActive) {
          const initialPreferences: UserPreferences = {
            ...(selectedProfile || DEFAULT_PREFERENCES),
            mealsToPrepare: initialMealsToPrepare,
            showPrepReminders: initialShowPrepReminders,
          };
          setWeeklyPlan(
            normalizeWeeklyPlanForSelectedMeals(
              {
                ...buildWeekFromSchedule(loadedSchedule, currentWeekStart),
                weekStartDate: currentWeekStart,
              },
              initialPreferences.mealsToPrepare,
              initialPreferences.showPrepReminders ?? true
            ) as PersistedWeeklyPlan
          );
        }

        if (isActive) {
          setSchedule(loadedSchedule);
        }

        if (isActive) {
          setHouseholdSettings(bootstrap.householdSettings || fallbackHouseholdSettings);
        }

        loadMealHistoryInBackground();

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        if (isActive) {
          setDataLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [activeFamilyGroupId, demoMode, forceOnboarding, getVisibleWeekDateRange, isAuthenticated, replaceGroceryList, userId]);


  // Phone collection now handled in onboarding wizard (NameLocationStep)
  // Auto-prompt removed per user request

  // Subscribe to real-time schedule changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = supabaseService.subscribeToScheduleChanges(userId, (newSchedule) => {
      setSchedule(newSchedule);
      setWeeklyPlan((currentPlan) => buildVisibleWeekPlanFromSchedule(
        newSchedule,
        currentPlan?.weekStartDate ? parseISO(currentPlan.weekStartDate) : planStartDate
      ));
    });

    return () => subscription.unsubscribe();
  }, [buildVisibleWeekPlanFromSchedule, isAuthenticated, planStartDate, userId]);

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

    const modeReloadKey = `${userId}:${activeFamilyGroupId ?? 'personal'}:${isFamilyModeActive ? 'family' : 'personal'}`;
    if (lastModeReloadKeyRef.current === null) {
      lastModeReloadKeyRef.current = modeReloadKey;
      return;
    }

    if (lastModeReloadKeyRef.current === modeReloadKey) {
      return;
    }

    lastModeReloadKeyRef.current = modeReloadKey;

    const reloadForMode = async () => {
      try {
        console.log('Mode changed, reloading schedule...', { isFamilyModeActive, familyGroupId: activeFamilyGroupId });
        const loadedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
        const baseProfile = (profiles.find((entry) => entry.id === currentProfileId) || profiles[0] || DEFAULT_PREFERENCES) as PreferenceProfile;
        const inventoryNames = buildInventorySummary(inventoryItems).names;
        const modePreferences: UserPreferences = {
          ...baseProfile,
          country: householdSettings?.country || baseProfile.country || 'India',
          language: householdSettings?.language || baseProfile.language || 'English',
          householdSize: householdSettings?.householdSize ?? baseProfile.householdSize ?? 4,
          portionSize: householdSettings?.portionSize || baseProfile.portionSize || 'regular',
          pantryStaples: householdSettings?.pantryStaples ?? baseProfile.pantryStaples ?? [],
          hasTiffin: householdSettings?.hasTiffin ?? baseProfile.hasTiffin ?? false,
          tiffinDays: householdSettings?.tiffinDays ?? baseProfile.tiffinDays ?? [],
          tiffinFor: householdSettings?.tiffinFor ?? baseProfile.tiffinFor ?? [],
          showPrepReminders: householdSettings?.showPrepReminders ?? baseProfile.showPrepReminders ?? true,
          showQuantities: householdSettings?.showQuantities ?? baseProfile.showQuantities ?? true,
          activeInventoryItems: inventoryNames,
          useInventoryFirst: inventoryNames.length > 0,
        };
        setSchedule(loadedSchedule);
        setWeeklyPlan(buildVisibleWeekPlanFromSchedule(loadedSchedule, planStartDate, modePreferences));

        // Clear grocery list when switching modes - user needs to regenerate for current mode's meals
        replaceGroceryList([], '');
      } catch (error) {
        console.error('Error reloading data for mode:', error);
      }
    };

    reloadForMode();
  }, [
    activeFamilyGroupId,
    currentProfileId,
    buildVisibleWeekPlanFromSchedule,
    householdSettings,
    inventoryItems,
    isAuthenticated,
    isFamilyModeActive,
    planStartDate,
    profiles,
    replaceGroceryList,
    userId,
  ]);

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
        setWeeklyPlan((currentPlan) => buildVisibleWeekPlanFromSchedule(
          loadedSchedule,
          currentPlan?.weekStartDate ? parseISO(currentPlan.weekStartDate) : planStartDate
        ));
      })
      .subscribe();

    return () => {
      scheduledMealsChannel.unsubscribe();
    };
  }, [
    activeFamilyGroupId,
    buildVisibleWeekPlanFromSchedule,
    isAuthenticated,
    isFamilyModeActive,
    planStartDate,
    userId,
  ]);

  // Save current profile ID to localStorage and Supabase
  useEffect(() => {
    // Only save if it's a valid UUID (not 'default' placeholder)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentProfileId);
    if (!isValidUUID) return;

    localStorage.setItem('cookcommander_current_profile_id', currentProfileId);
    if (!hasHydratedProfileSelectionRef.current) {
      hasHydratedProfileSelectionRef.current = true;
      return;
    }
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

  useEffect(() => {
    let isMounted = true;

    const loadNotificationPreferences = async () => {
      const savedSettings = await notificationService.loadSettings();
      if (!isMounted) {
        return;
      }

      setNotificationSettings(savedSettings);
      setNotificationSettingsLoaded(true);
    };

    void loadNotificationPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notificationSettingsLoaded || !isNative()) {
      return;
    }

    notificationService.rescheduleNotifications(schedule, generationPreferences, notificationSettings).catch((error) => {
      console.error('Failed to reschedule notifications:', error);
    });
  }, [notificationSettingsLoaded, schedule, generationPreferences, notificationSettings]);

  const refreshPlannerMemory = useCallback(async () => {
    if (!isAuthenticated) {
      setInventoryItems([]);
      setPreferenceSignals([]);
      return;
    }

    const [items, signals] = await Promise.all([
      supabaseService.getInventoryItems(userId, activeFamilyGroupId),
      supabaseService.getPreferenceSignals(userId, activeFamilyGroupId),
    ]);

    setInventoryItems(items);
    setPreferenceSignals(signals);
  }, [isAuthenticated, userId, activeFamilyGroupId]);

  const recordPreferenceSignal = useCallback(async (
    signal: Omit<PreferenceSignal, 'id' | 'createdAt' | 'familyGroupId'>
  ) => {
    const savedSignal = await supabaseService.savePreferenceSignal(signal, userId, activeFamilyGroupId);
    setPreferenceSignals((previous) => [savedSignal, ...previous]);
    return savedSignal;
  }, [userId, activeFamilyGroupId]);

  const openTeachQook = useCallback(() => {
    setLearningApplyError(null);
    if (canReviewLearning) {
      setIsLearningSheetOpen(true);
      return;
    }

    addToast('Teach Qook appears after swaps, edits, regenerations, or saved recipes give Qook something useful to learn from.', 'info');
  }, [canReviewLearning, addToast]);

  const openPreferences = useCallback(() => {
    setLearningApplyError(null);
    if (isPreferencesOpen) {
      return;
    }

    if (isLearningSheetOpen) {
      setIsLearningSheetOpen(false);
      window.setTimeout(() => {
        setIsPreferencesOpen(true);
      }, 0);
      return;
    }

    setIsPreferencesOpen(true);
  }, [isLearningSheetOpen, isPreferencesOpen]);

  const handleSaveNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    const savedSettings = await notificationService.saveSettings(settings);
    setNotificationSettings(savedSettings);
    return savedSettings;
  }, []);

  const renderKitchenSetupCard = (
    expanded: boolean,
    onToggle?: () => void,
    showOpenPreferences: boolean = true
  ) => (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${onToggle ? 'hover:bg-white/40 transition-colors' : 'cursor-default'}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Kitchen Setup</span>
            <span className="text-xs text-amber-700">Using your real setup</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              <Users className="w-3 h-3 text-amber-600" />
              {kitchenSetupSummary.householdLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              <ChefHat className="w-3 h-3 text-orange-600" />
              {kitchenSetupSummary.mealCoverageLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              <PackageOpen className="w-3 h-3 text-emerald-600" />
              {kitchenSetupSummary.compactStatusLabel}
            </span>
          </div>
        </div>
        {onToggle && (
          <ChevronRight className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/70 px-4 pb-4 pt-3">
          <p className="text-sm text-gray-600">
            Qook uses your household size, selected meal slots, pantry staples, and current inventory so plans fit your actual kitchen.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setInventoryFlowMode('planner');
                setIsInventoryCaptureOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Refrigerator className="w-4 h-4" />
              {kitchenSetupSummary.inventoryCount > 0 ? 'Update What I Have' : 'Add What I Have'}
            </button>
            {showOpenPreferences && (
              <button
                type="button"
                onClick={openPreferences}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Open Full Preferences
              </button>
            )}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white bg-white/90 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Household</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{kitchenSetupSummary.householdLabel}</p>
              <p className="mt-1 text-xs text-gray-600">
                {kitchenSetupSummary.mealCoverageLabel} • Portions: {kitchenSetupSummary.portionLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-white bg-white/90 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Kitchen Memory</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{kitchenSetupSummary.inventoryLabel}</p>
              <p className="mt-1 text-xs text-gray-600">
                {activePreferences.pantryStaples?.length || 0} pantry staple{(activePreferences.pantryStaples?.length || 0) === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-2xl border border-white bg-white/90 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Rules in Play</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{kitchenSetupSummary.tiffinSummary}</p>
              <p className="mt-1 text-xs text-gray-600">
                {activePreferences.dislikes?.length || 0} dislike{(activePreferences.dislikes?.length || 0) === 1 ? '' : 's'} • Prep reminders {kitchenSetupSummary.showPrepReminders ? 'on' : 'off'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    void refreshPlannerMemory();
  }, [refreshPlannerMemory]);

  useEffect(() => {
    if (!pendingSignalSummary || isInventoryCaptureOpen) {
      return;
    }

    const learningKey = pendingSignalSummary.signalIds.join('|');
    if (pendingSignalSummary.meaningfulSignalCount >= 3 && learningKey && learningKey !== lastPromptedLearningKeyRef.current) {
      lastPromptedLearningKeyRef.current = learningKey;
      setIsLearningSheetOpen(true);
    }
  }, [pendingSignalSummary, isInventoryCaptureOpen]);

  const handleAddInventoryItems = useCallback(async (items: Array<{ name: string; source: any; confidence?: number }>) => {
    const names = items.map((item) => item.name).filter(Boolean);
    if (names.length === 0) {
      return;
    }

    await supabaseService.addInventoryItems(names, userId, activeFamilyGroupId, items[0]?.source || 'manual', items[0]?.confidence || 0.8);
    await refreshPlannerMemory();
    addToast(`${names.length} item${names.length === 1 ? '' : 's'} added to What I Have.`, 'success');
  }, [userId, activeFamilyGroupId, refreshPlannerMemory, addToast]);

  const handleRemoveInventoryItem = useCallback(async (id: string) => {
    await supabaseService.removeInventoryItem(id, userId, activeFamilyGroupId);
    await refreshPlannerMemory();
  }, [userId, activeFamilyGroupId, refreshPlannerMemory]);

  const handleApplyLearningSummary = useCallback(async () => {
    if (!pendingSignalSummary) {
      return;
    }

    setIsApplyingLearning(true);
    setLearningApplyError(null);
    try {
      const currentProfile = profiles.find((profile) => profile.id === currentProfileId);
      if (!currentProfile) {
        setLearningApplyError('Choose an active preferences profile first, then try again.');
        addToast('Choose an active preferences profile first, then try again.', 'error');
        return;
      }

      const mergedProfile = mergePreferenceSummaryIntoProfile(currentProfile, pendingSignalSummary);
      const syncedProfile = applyHouseholdSettingsToProfile(mergedProfile);
      const savedProfile = await supabaseService.savePreferenceProfile(syncedProfile, userId);
      setProfiles((previous) => previous.map((profile) => (
        profile.id === savedProfile.id ? savedProfile : profile
      )));

      const appliedAt = new Date().toISOString();
      setPreferenceSignals((previous) => previous.map((signal) => (
        pendingSignalSummary.signalIds.includes(signal.id)
          ? { ...signal, appliedAt, requiresConfirmation: false }
          : signal
      )));
      await supabaseService.markPreferenceSignalsApplied(pendingSignalSummary.signalIds, userId);
      await refreshPlannerMemory();
      setIsLearningSheetOpen(false);
      setLearningApplyError(null);
      addToast('Qook updated your preferences from recent actions.', 'success');
    } catch (error) {
      console.error('Failed to apply learning summary:', error);
      setLearningApplyError('Qook could not apply those preferences right now. Please try again.');
      addToast('Qook could not apply those preferences right now. Please try again.', 'error');
    } finally {
      setIsApplyingLearning(false);
    }
  }, [pendingSignalSummary, profiles, currentProfileId, applyHouseholdSettingsToProfile, userId, refreshPlannerMemory, addToast]);

  const handleDismissLearningSummary = useCallback(async () => {
    if (pendingSignalSummary) {
      await supabaseService.dismissPreferenceSignals(pendingSignalSummary.signalIds, userId);
      await refreshPlannerMemory();
    }
    setLearningApplyError(null);
    setIsLearningSheetOpen(false);
  }, [pendingSignalSummary, userId, refreshPlannerMemory]);

  const hasSavedPhone = Boolean(userProfile?.phone?.trim());

  const isByokEnabledForSummary = useCallback((creditSummary: Awaited<ReturnType<typeof getUserCredits>>) => (
    Boolean(
      creditSummary?.byok_enabled &&
      creditSummary?.billing_preference === 'byok' &&
      apiKey?.trim()
    )
  ), [apiKey]);

  const confirmMealGenerationAccess = useCallback(async (): Promise<{ canProceed: boolean; confirmedZeroCredits: boolean }> => {
    if (!userId) {
      return { canProceed: false, confirmedZeroCredits: false };
    }

    if (canGenerate('meal')) {
      return { canProceed: true, confirmedZeroCredits: false };
    }

    try {
      const latestCredits = await getUserCredits(userId, activeFamilyGroupId, { force: true });
      await refreshCredits();

      if (!latestCredits) {
        return { canProceed: true, confirmedZeroCredits: false };
      }

      if (isByokEnabledForSummary(latestCredits)) {
        return { canProceed: true, confirmedZeroCredits: false };
      }

      const remainingCredits = latestCredits.total_credits ?? 0;
      return {
        canProceed: remainingCredits > 0,
        confirmedZeroCredits: remainingCredits <= 0,
      };
    } catch (error) {
      console.warn('[App] Unable to confirm meal credits before generation.', error);
      return { canProceed: true, confirmedZeroCredits: false };
    }
  }, [activeFamilyGroupId, canGenerate, isByokEnabledForSummary, refreshCredits, userId]);

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
      const syncedProfile = applyHouseholdSettingsToProfile(updatedProfile);
      await supabaseService.savePreferenceProfile(syncedProfile, userId);

      // CRITICAL: Also update Global Household Settings from onboarding data
      // This ensures manual generation (which uses getActivePreferences -> global settings) sees the new values
      // CRITICAL: Also update Global Household Settings from onboarding data
      // This ensures manual generation (which uses getActivePreferences -> global settings) sees the new values
      // FIX: Even if householdSettings is null (new user), we must create and save it
      const currentSettings = householdSettings || {
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

      const updatedGlobalSettings = {
        ...currentSettings,
        householdSize: data.householdSize,
        portionSize: data.portionSize,
        country: data.country,
        language: data.language,
        hasTiffin: data.hasTiffin,
        tiffinDays: data.tiffinDays,
        tiffinFor: data.tiffinFor,
      };

      setHouseholdSettings(updatedGlobalSettings);
      await supabaseService.saveHouseholdSettings(userId, updatedGlobalSettings);

      const normalizedDisplayName = data.userName.trim();
      const normalizedPhone = data.phone?.trim() || '';
      const cleanedPhone = normalizedPhone.replace(/\D/g, '');
      const profileUpdates: Partial<supabaseService.UserProfile> = {};

      if (normalizedDisplayName) {
        profileUpdates.displayName = normalizedDisplayName;
      }

      if (cleanedPhone.length >= 10) {
        profileUpdates.phone = normalizedPhone;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await supabaseService.saveUserProfile(userId, profileUpdates);
      }

      setUserProfile((previous) => ({
        displayName: profileUpdates.displayName ?? previous?.displayName ?? '',
        phone: profileUpdates.phone ?? previous?.phone ?? '',
        city: previous?.city ?? '',
      }));

      await supabaseService.saveUserSettings(userId, {
        ...(isRerun ? {} : { onboardingCompleted: true }),
        displayName: normalizedDisplayName,
        preferredLanguage: data.language,
        currentProfileId: profileId,
      });

      if (isRerun) {
        // Update existing profile in state (don't replace all profiles)
        setProfiles(prev => prev.map(p => p.id === profileId ? syncedProfile : p));
      } else {
        // First time - set this as the only profile
        setProfiles([syncedProfile]);
        setCurrentProfileId(profileId);
        setOnboardingCompleted(true);

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
          const learningSummary = await supabaseService.getMealLearningSummary(userId, 3, activeFamilyGroupId);
          const initialPreferences: UserPreferences = {
            ...syncedProfile,
            activeInventoryItems: inventorySummary.names,
            useInventoryFirst: inventorySummary.names.length > 0,
          };
          const generatedPlan = normalizeWeeklyPlanForSelectedMeals(
            await generatePlanViaProxy(userId, initialPreferences, learningSummary, activeFamilyGroupId, apiKey),
            initialPreferences.mealsToPrepare,
            initialPreferences.showPrepReminders ?? true
          ) as WeeklyPlan;
          const initialPlanAnchor = new Date();
          const initialPlanStart = format(initialPlanAnchor, 'yyyy-MM-dd');
          await supabaseService.mergeWeekMeals(generatedPlan, initialPlanStart, userId, 'overwrite', activeFamilyGroupId);
          const updatedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
          setPlanStartDate(initialPlanAnchor);
          setSelectedPlannerDate(initialPlanAnchor);
          setSchedule(updatedSchedule);
          setWeeklyPlan(buildVisibleWeekPlanFromSchedule(updatedSchedule, initialPlanAnchor, initialPreferences));
          await refreshCredits();

          // Onboarding auto-generation counts as menu #1 for the second-menu milestone.
          await awardSecondMenu({
            requestId: crypto.randomUUID(),
            weekStartDate: initialPlanStart,
            source: 'onboarding_auto',
            familyGroupId: activeFamilyGroupId,
          });
          await refreshCredits({ force: true });

          // Award referrer credits (if this user was referred)
          try {
            await awardReferrerCredits(userId);
          } catch (refAwardError) {
            console.error('Failed to award referrer credits:', refAwardError);
          }
        } catch (planError) {
          console.error('Failed to generate initial plan:', planError);
          addToast('Setup saved, but Qook could not generate your first meal plan. Tap Generate Plan to retry.', 'info');
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
      const syncedProfile = applyHouseholdSettingsToProfile(updatedProfile);
      await supabaseService.savePreferenceProfile(syncedProfile, userId);

      const existingIndex = profiles.findIndex(p => p.id === syncedProfile.id);
      let newProfiles = [...profiles];
      if (existingIndex >= 0) {
        newProfiles[existingIndex] = syncedProfile;
      } else {
        newProfiles.push(syncedProfile);
      }
      setProfiles(newProfiles);

      if (weeklyPlan) {
        handleUpdateGroceryList(weeklyPlan, syncedProfile);
      }
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      alert(`Failed to save profile: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleHouseholdSettingsSaved = useCallback(async (updatedSettings: HouseholdSettings) => {
    setHouseholdSettings(updatedSettings);

    const syncedProfiles = profiles.map((profile) => applyHouseholdSettingsToProfile(profile, updatedSettings));
    setProfiles(syncedProfiles);

    if (!userId || syncedProfiles.length === 0) {
      return;
    }

    await Promise.all(
      syncedProfiles.map((profile) => supabaseService.savePreferenceProfile(profile, userId))
    );
  }, [applyHouseholdSettingsToProfile, profiles, userId]);

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
    const start = date;
    const end = addDays(date, 6);
    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');

    // Set the loaded date range for share modal
    const dateRangeStr = getVisibleWeekDateRange(start);
    setLoadedWeekRange(dateRangeStr);

    // Explicit week load: update the visible planner range now that the user chose to open it.
    setPlanStartDate(start);
    setSelectedPlannerDate(start);
    setWeeklyPlan(buildVisibleWeekPlanFromSchedule(schedule, start, generationPreferences));
    setActiveTab('plan');

    try {
      const sched = await supabaseService.getSchedule(userId, startDateStr, endDateStr, activeFamilyGroupId);
      const mergedSchedule = { ...schedule, ...sched };
      setSchedule((previous) => ({ ...previous, ...sched }));
      setWeeklyPlan(buildVisibleWeekPlanFromSchedule(mergedSchedule, start, generationPreferences));
    } catch (error) {
      console.error('Failed to load week:', error);
      alert('Failed to load selected dates into planner');
    }
  }, [activeFamilyGroupId, buildVisibleWeekPlanFromSchedule, generationPreferences, getVisibleWeekDateRange, schedule, userId]);

  const handleSelectPlannerDate = useCallback((date: Date) => {
    void handleLoadWeek(date);
  }, [handleLoadWeek]);

  const handleGeneratePlan = async (saveMode: 'overwrite' | 'fill-empty' = 'overwrite') => {
    const creditAccess = await confirmMealGenerationAccess();
    const canProceed = creditAccess.canProceed;
    if (!canProceed) {
      if (creditAccess.confirmedZeroCredits) {
        addToast('You need 1 meal credit to generate a plan.', 'error');
        setIsPricingOpen(true);
      }
      return;
    }

    // Check rate limit
    const rateLimitOk = await checkRate('meal_generation');
    if (!rateLimitOk) {
      alert('?? Rate limit exceeded. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setStreamingDay(0);
    setThinkingMessage('');
    setPartialDays([]);

    try {
      const prefs = generationPreferences;

      // Fetch learning summary from last 3 months of accepted meals
      const learningSummary = await supabaseService.getMealLearningSummary(userId, 3, activeFamilyGroupId);

      // Try streaming first (now with FULL prompt), fallback to regular API
      let plan: WeeklyPlan | null = null;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Authentication required. Please sign in again.');
        }

        const response = await fetch(`${getApiBaseUrl()}/api/ai-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId,
            familyGroupId: activeFamilyGroupId ?? null,
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
                            setPartialDays(
                              parsedDays.map((day) => normalizeDayForSelectedMeals(day, prefs.mealsToPrepare, prefs.showPrepReminders ?? true))
                            );
                          }
                        }
                      } catch {
                        // Ignore parse errors for partial JSON
                      }
                    }
                  } else if (data.type === 'complete' && data.data) {
                    plan = normalizeWeeklyPlanForSelectedMeals(
                      data.data as WeeklyPlan,
                      prefs.mealsToPrepare,
                      prefs.showPrepReminders ?? true
                    );
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
        plan = normalizeWeeklyPlanForSelectedMeals(
          await generatePlanViaProxy(userId, prefs, learningSummary, activeFamilyGroupId, apiKey),
          prefs.mealsToPrepare,
          prefs.showPrepReminders ?? true
        );
        setStreamingDay(7);
      }

      // Refresh credits after consumption
      await refreshCredits();

      const startDateStr = format(planStartDate, 'yyyy-MM-dd');

      // Save based on selected mode
      if (saveMode === 'overwrite') {
        await supabaseService.mergeWeekMeals(plan, startDateStr, userId, 'overwrite', activeFamilyGroupId);
      } else {
        await supabaseService.mergeWeekMeals(plan, startDateStr, userId, 'fill-empty', activeFamilyGroupId);
      }

      const updatedSchedule = await supabaseService.getSchedule(userId, undefined, undefined, activeFamilyGroupId);
      const mergedPlan = buildVisibleWeekPlanFromSchedule(updatedSchedule, planStartDate, prefs);
      setSchedule(updatedSchedule);
      setWeeklyPlan(mergedPlan);
      setLoadedWeekRange(''); // Clear so Share uses current week
      setActiveTab('plan');

      // Manual weekly generation counts toward the second-menu milestone once the save succeeds.
      await awardSecondMenu({
        requestId: crypto.randomUUID(),
        weekStartDate: startDateStr,
        source: 'manual_generate',
        familyGroupId: activeFamilyGroupId,
      });
      await refreshCredits({ force: true });

      setLoading(false);
      setStreamingDay(0);

      // Generate grocery in background
      setGroceryLoading(true);
      try {
        await handleUpdateGroceryList(mergedPlan, prefs);
      } catch (groceryError) {
        console.error('Background grocery update failed:', groceryError);
        addToast('Meal plan saved, but the grocery list could not be refreshed automatically.', 'info');
      } finally {
        setGroceryLoading(false);
      }

    } catch (error: any) {
      console.error("Plan Generation Error", error);
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.toLowerCase().includes('insufficient credits')) {
        const latestCredits = await getUserCredits(userId, activeFamilyGroupId, { force: true }).catch(() => null);
        await refreshCredits();

        if (latestCredits && !isByokEnabledForSummary(latestCredits) && (latestCredits.total_credits ?? 0) <= 0) {
          addToast('You need 1 meal credit to generate a plan.', 'error');
          setIsPricingOpen(true);
        } else {
          addToast('Qook could not generate the meal plan. Please retry.', 'error');
        }
      } else if (errorMessage.includes('API Key') || errorMessage.includes('API key')) {
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
      alert('? Insufficient credits!\n\nYou need credits to regenerate a meal.\n\nOptions:\n• Wait for weekly bonus\n• Upgrade your plan\n• Buy credit packs');
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
      const learningSummary = await supabaseService.getMealLearningSummary(userId, 3, activeFamilyGroupId);

      const newMeal = await regenerateMealViaProxy(
        userId,
        currentMeal,
        mealType,
        generationPreferences,
        dayName,
        existingMeals,
        learningSummary,
        activeFamilyGroupId,
        apiKey
      );
      const updatedPlan = { ...weeklyPlan };
      updatedPlan.days[dayIndex][mealType] = newMeal;
      setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, planStartDate));

      // Refresh credits after consumption
      await refreshCredits();
      const mealDate = format(addDays(planStartDate, dayIndex), 'yyyy-MM-dd');
      updateLocalScheduleDay(mealDate, updatedPlan.days[dayIndex]);
      await supabaseService.saveScheduledMeal(mealDate, updatedPlan.days[dayIndex], userId, activeFamilyGroupId);

      const signalKey = `${dayIndex}-${mealType}`;
      const nextCount = (regenSignalCounts[signalKey] || 0) + 1;
      setRegenSignalCounts((previous) => ({ ...previous, [signalKey]: nextCount }));

      if (nextCount >= 2 && currentMeal) {
        await recordPreferenceSignal(createRegenerateSignal(mealType, currentMeal));
        setIsLearningSheetOpen(true);
        addToast(`Qook noted that you keep changing ${mealType}. You can review that in Teach Qook.`, 'info');
      }
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
      const groceryPreferences: UserPreferences = {
        ...prefs,
        activeInventoryItems: inventorySummary.names,
        useInventoryFirst: inventorySummary.names.length > 0,
      };
      const groceries = await generateGroceryViaProxy(
        userId,
        normalizeWeeklyPlanForSelectedMeals(plan, groceryPreferences.mealsToPrepare, groceryPreferences.showPrepReminders ?? true).days,
        groceryPreferences,
        activeFamilyGroupId,
        apiKey
      );
      replaceGroceryList(groceries, getVisibleWeekDateRange(planStartDate, plan.days.length));
      // Refresh credits after consumption
      await refreshCredits();
    } catch (e) {
      console.error(e);
    }
  };

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

  const handleShareCurrentPlan = useCallback(() => {
    if (!weeklyPlan) {
      return;
    }

    const dateRangeStr = `${format(planStartDate, 'MMM d')} - ${format(addDays(planStartDate, 6), 'MMM d, yyyy')}`;
    setShareModalData({
      isOpen: true,
      type: 'plan',
      data: weeklyPlan,
      dateRange: dateRangeStr,
      sourceLanguage: getActivePreferences().language,
    });
  }, [getActivePreferences, planStartDate, weeklyPlan]);

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

      await supabaseService.mergeWeekMeals(
        weeklyPlan,
        dateStr,
        userId,
        overwrite ? 'overwrite' : 'fill-empty',
        activeFamilyGroupId
      );

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
    setGroceryList((previous) => sanitizeGroceryItems(previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, checked: !item.checked } : item
    ))));
  };

  const handleDeleteGroceryItem = (index: number) => {
    setGroceryList((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddManualGroceryItem = (item: { item: string; quantity: string; category: string }) => {
    setGroceryList((previous) => sanitizeGroceryItems([
      ...previous,
      {
        item: item.item,
        quantity: item.quantity,
        category: item.category,
        checked: false,
        homeStatus: 'none',
      },
    ]));
    addToast(`${item.item} added to your grocery list.`, 'success');
  };

  const handleRememberGroceryItem = useCallback(async (
    index: number,
    target: 'inventory' | 'staple'
  ) => {
    const selectedItem = groceryList[index];
    if (!selectedItem) {
      return;
    }

    const updateHomeStatus = (homeStatus: 'inventory' | 'staple') => {
      setGroceryList((previous) => sanitizeGroceryItems(previous.map((item, itemIndex) => (
        itemIndex === index ? { ...item, homeStatus } : item
      ))));
    };

    if (target === 'inventory') {
      await supabaseService.addInventoryItems([selectedItem.item], userId, activeFamilyGroupId, 'manual', 0.95);
      await refreshPlannerMemory();
      updateHomeStatus('inventory');
      addToast(`${selectedItem.item} will now be treated as available at home.`, 'success');
      return;
    }

    const updatedStaples = Array.from(new Set([
      ...(householdSettings?.pantryStaples || activePreferences.pantryStaples || []),
      selectedItem.item,
    ].map((value) => value.trim()).filter(Boolean)));

    await saveHouseholdSettings(userId, {
      ...(householdSettings || {}),
      pantryStaples: updatedStaples,
    });
    setHouseholdSettings((previous) => previous ? {
      ...previous,
      pantryStaples: updatedStaples,
    } : {
      city: '',
      country: activePreferences.country || 'India',
      language: activePreferences.language || 'English',
      householdSize: activePreferences.householdSize || 4,
      portionSize: activePreferences.portionSize || 'regular',
      pantryStaples: updatedStaples,
      hasTiffin: activePreferences.hasTiffin || false,
      tiffinDays: activePreferences.tiffinDays || [],
      tiffinFor: activePreferences.tiffinFor || [],
      showPrepReminders: activePreferences.showPrepReminders ?? true,
      showQuantities: activePreferences.showQuantities ?? true,
    });

    updateHomeStatus('staple');
    addToast(`${selectedItem.item} was saved as a pantry staple for future plans.`, 'success');
  }, [
    groceryList,
    userId,
    activeFamilyGroupId,
    refreshPlannerMemory,
    householdSettings,
    activePreferences,
    addToast,
  ]);

  const handleGenerateGroceryFromWeek = async (meals: { date: string; breakfast: string; lunch: string; dinner: string }[]) => {
    // No API key check - proxy handles it with platform key

    // Check credits
    const canProceed = canGenerate('grocery');
    if (!canProceed) {
      alert('? Insufficient credits!\n\nYou need credits to generate a grocery list.');
      setIsPricingOpen(true);
      return;
    }

    setGroceryLoading(true);
    try {
      const prefs = generationPreferences;
      // Use secure AI proxy (credits handled server-side)
      const normalizedMeals = meals.map((day) => normalizeDayForSelectedMeals({
        day: day.date,
        breakfast: day.breakfast || '',
        lunch: day.lunch || '',
        dinner: day.dinner || '',
      }, prefs.mealsToPrepare, prefs.showPrepReminders ?? true));
      const list = await generateGroceryViaProxy(userId, normalizedMeals, prefs, activeFamilyGroupId, apiKey);
      const groceryDateRange = meals.length > 0
        ? formatCompactDateRange(meals[0].date, meals[meals.length - 1].date)
        : '';
      replaceGroceryList(list, groceryDateRange);
      setActiveTab('grocery');
      setGrocerySubTab('list');

      // Refresh credits after server-side consumption
      await refreshCredits();
    } catch (error: any) {
      console.error('Grocery generation error:', error);
      alert(`Failed to generate grocery list: ${error?.message || 'Unknown error'}`);
    } finally {
      setGroceryLoading(false);
    }
  };

  const handleSmartEditAnalyze = async (mealTypes: SelectableMealType[], instruction: string) => {
    if (!smartEditData || !weeklyPlan || !weeklyPlan.days[smartEditData.index]) {
      console.error('Invalid state for smart edit');
      return { options: {} };
    }

    // Check credits
    const canProceed = canGenerate('edit');
    if (!canProceed) {
      alert('? Insufficient credits!\n\nYou need credits to edit meals.');
      setIsPricingOpen(true);
      return { options: {} };
    }

    try {
      // Build current meals object
      const currentMeals: Partial<Record<SelectableMealType, string>> = {};
      const dayData = weeklyPlan.days[smartEditData.index];
      mealTypes.forEach((mealType) => {
        currentMeals[mealType] = dayData[mealType] || '';
      });

      lastSmartEditInstructionRef.current = instruction;
      const learningSummary = await supabaseService.getMealLearningSummary(userId, 3, activeFamilyGroupId);
      const result = await smartEditViaProxy(
        userId,
        currentMeals,
        instruction,
        mealTypes,
        generationPreferences,
        learningSummary,
        activeFamilyGroupId,
        apiKey
      );
      // Refresh credits after consumption
      await refreshCredits();
      return result;
    } catch (error) {
      console.error(error);
      return { options: {} };
    }
  };

  const handleSmartEditConfirm = async (updates: SmartEditMealUpdates) => {
    if (!smartEditData || !weeklyPlan) return;

    const meaningfulUpdates = Object.entries(updates).reduce((result, [key, meal]) => {
      const mealType = key as SelectableMealType;
      if (meal?.trim()) {
        result[mealType] = meal;
      }
      return result;
    }, {} as SmartEditMealUpdates);

    if (Object.keys(meaningfulUpdates).length === 0) {
      return;
    }

    // Deep clone to avoid mutation
    const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
    const updatedDay = applySparseMealUpdatesToDay(
      updatedPlan.days[smartEditData.index],
      meaningfulUpdates
    );
    updatedPlan.days[smartEditData.index] = updatedDay;
    setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, planStartDate));

    // Calculate the date for this day
    const mealDate = format(addDays(planStartDate, smartEditData.index), 'yyyy-MM-dd');

    // Build day data for saving
    const dayData = {
      day: updatedDay.day,
      breakfast: updatedDay.breakfast || '',
      lunch: updatedDay.lunch || '',
      dinner: updatedDay.dinner || '',
      prepAhead: updatedDay.prepAhead,
      alternatives: updatedDay.alternatives,
    };

    // FIXED: Save to scheduled_meals for persistence (not weekly_plans)
    updateLocalScheduleDay(mealDate, dayData);
    await supabaseService.saveScheduledMeal(mealDate, dayData, userId, activeFamilyGroupId);

    for (const [type, meal] of Object.entries(meaningfulUpdates)) {
      const mealType = type as SelectableMealType;
      const originalMeal = smartEditData.dayPlan[mealType] || '';
      if (meal && meal !== originalMeal) {
        await recordPreferenceSignal(
          createSmartEditSignal(mealType, originalMeal, meal, lastSmartEditInstructionRef.current || 'Smart edit')
        );
      }
    }
    setIsLearningSheetOpen(true);
  };


  // Handle inline meal edits in weekly planner
  // FIXED: Save to scheduled_meals for persistence (not weekly_plans which is lost on refresh)
  const handleMealUpdate = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => {
    if (!weeklyPlan) return;
    const originalMeal = weeklyPlan.days[dayIndex][mealType] || '';
    if (originalMeal === newValue) {
      return;
    }

    // 1. Optimistic update - update UI immediately
    const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
    updatedPlan.days[dayIndex][mealType] = newValue;
    setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, planStartDate));

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
    updateLocalScheduleDay(mealDate, dayData);
    await supabaseService.saveScheduledMeal(mealDate, dayData, userId, activeFamilyGroupId);

    if (newValue.trim()) {
      await recordPreferenceSignal(
        createMealReplacementSignal('manual_edit', mealType, originalMeal, newValue)
      );
      setIsLearningSheetOpen(true);
    }
  };


  const handleSelectAlternative = async (meal: string, dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (!weeklyPlan) {
      return;
    }

    const originalMeal = weeklyPlan.days[dayIndex][mealType] || '';
    if (originalMeal === meal) {
      setIsAlternativesSidebarOpen(false);
      return;
    }

    const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
    updatedPlan.days[dayIndex][mealType] = meal;
    setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, planStartDate));

    const mealDate = format(addDays(planStartDate, dayIndex), 'yyyy-MM-dd');
    updateLocalScheduleDay(mealDate, updatedPlan.days[dayIndex]);
    await supabaseService.saveScheduledMeal(mealDate, updatedPlan.days[dayIndex], userId, activeFamilyGroupId);
    if (meal.trim()) {
      await recordPreferenceSignal(createMealReplacementSignal('swap', mealType, originalMeal, meal));
    }
    setIsLearningSheetOpen(true);
    setIsAlternativesSidebarOpen(false);
  };

  const handleRegenerateAlternatives = async () => {
    if (!weeklyPlan) return;

    setAlternativesLoading(true);
    try {
      const newAlternatives = await generateAlternativesViaProxy(
        userId,
        generationPreferences,
        weeklyPlan,
        activeFamilyGroupId,
        apiKey
      );

      // Update the weeklyPlan with new alternatives
      const updatedPlan = { ...weeklyPlan, alternatives: newAlternatives };
      setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, planStartDate));
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

    if (weeklyPlan?.weekStartDate) {
      const dayIndex = differenceInCalendarDays(parseISO(dateKey), parseISO(weeklyPlan.weekStartDate));
      if (dayIndex >= 0 && dayIndex < weeklyPlan.days.length) {
        const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
        updatedPlan.days[dayIndex][mealType] = newValue;
        setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, parseISO(weeklyPlan.weekStartDate)));
      }
    }
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

      if (stayingInSameMode && weeklyPlan?.weekStartDate) {
        const updatedPlan = JSON.parse(JSON.stringify(weeklyPlan));
        let draftChanged = false;
        const applyDraftUpdate = (dateKey: string, mealType: 'breakfast' | 'lunch' | 'dinner', value: string) => {
          const dayIndex = differenceInCalendarDays(parseISO(dateKey), parseISO(weeklyPlan.weekStartDate!));
          if (dayIndex >= 0 && dayIndex < updatedPlan.days.length) {
            updatedPlan.days[dayIndex][mealType] = value;
            draftChanged = true;
          }
        };

        applyDraftUpdate(targetDate, targetType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner', transferData.sourceMealName);
        if (action === 'move') {
          applyDraftUpdate(sourceKey, transferData.sourceMealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner', '');
        }

        if (draftChanged) {
          setWeeklyPlan(buildPersistedPlannerPlan(updatedPlan, parseISO(weeklyPlan.weekStartDate)));
        }
      }
    } catch (error) {
      console.error('Failed to save meal transfer:', error);
    }

    setTransferData(null);
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="app-content-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Show auth page if not authenticated and Supabase is configured
  if (!isAuthenticated && isConfigured) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  // Show config message if Supabase not configured
  if (!isAuthenticated && !isConfigured) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  // Show landing page for logged-in users who want to view it (logo click)
  if (showLanding) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <LandingPage
          isLoggedIn={!!user}
          userEmail={user?.email}
          onGoToDashboard={() => setShowLanding(false)}
          onSignOut={handleUserSignOut}
        />
      </Suspense>
    );
  }

  // Show loading while fetching data
  if (dataLoading) {
    return (
      <div className="app-content-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
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
    const bootstrapUserName =
      userProfile?.displayName?.trim()
      || (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '')
      || (typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '');
    const bootstrapPhone = userProfile?.phone?.trim() || '';
    const initialDataFromProfile = isRerun && currentProfile ? {
      userName: currentProfile.name?.replace("'s Preferences", '') || bootstrapUserName,
      phone: bootstrapPhone,
      country: currentProfile.country || householdSettings?.country || 'India',
      language: currentProfile.language || householdSettings?.language || 'English',
      householdSize: currentProfile.householdSize || householdSettings?.householdSize || 4,
      portionSize: currentProfile.portionSize || householdSettings?.portionSize || 'regular',
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
    } : {
      userName: bootstrapUserName,
      phone: bootstrapPhone,
      country: householdSettings?.country || 'India',
      language: householdSettings?.language || 'English',
      householdSize: householdSettings?.householdSize || 4,
      portionSize: householdSettings?.portionSize || 'regular',
      hasTiffin: householdSettings?.hasTiffin || false,
      tiffinDays: householdSettings?.tiffinDays || [],
      tiffinFor: householdSettings?.tiffinFor || [],
    };

    return (
      <Suspense fallback={<FullScreenLoader message="Loading setup..." />}>
        <OnboardingWizard
          onComplete={async (data) => {
            await handleOnboardingComplete(data, isRerun);
            setShowOnboardingWizard(false);
          }}
          initialData={initialDataFromProfile}
          isRerun={isRerun}
          onSkip={isRerun ? () => setShowOnboardingWizard(false) : undefined}
        />
      </Suspense>
    );
  }

  return (
    <div className="dashboard-viewport bg-gray-50">
      <div className="dashboard-screen">
        <div className="dashboard-scroll">
          <div className="dashboard-screen-width gap-2 md:gap-6">
            {activeTab === 'profile' ? (
              <Suspense fallback={<SectionLoader className="min-h-[40vh]" />}>
                <ProfileView
                  userEmail={user?.email || null}
                  userId={user?.id || null}
                  onSignOut={handleUserSignOut}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenPreferences={openPreferences}
                  onOpenFeedback={() => setIsFeedbackOpen(true)}
                  onStartTour={() => setShowTour(true)}
                  onOpenPricing={() => setIsPricingOpen(true)}
                  onDeleteAccount={() => setIsDeleteAccountOpen(true)}
                  onOpenSavedRecipes={() => setIsSavedRecipesPanelOpen(true)}
                />
              </Suspense>
            ) : (
              <>

            {/* Desktop Nav with Preferences Access */}
            <div className="hidden md:flex items-center justify-between border-b border-gray-200 mb-2">
              <div className="flex">
                {[
                  { id: 'plan', label: 'Weekly Planner', icon: ClipboardList },
                  { id: 'grocery', label: 'Groceries', icon: ShoppingCart },
                  { id: 'preferences', label: 'Setup', icon: Settings }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    data-tour={tab.id === 'grocery' ? 'grocery-tab-desktop' : undefined}
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
                  onClick={openPreferences}
                  className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Edit Preferences"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* User Menu */}
                <UserMenu
                  userEmail={user?.email || null}
                  userId={user?.id || null}
                  onSignOut={handleUserSignOut}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenPreferences={openPreferences}
                  onOpenFeedback={() => setIsFeedbackOpen(true)}
                  onStartTour={() => setShowTour(true)}
                  onOpenPricing={() => setIsPricingOpen(true)}
                  onDeleteAccount={() => setIsDeleteAccountOpen(true)}
                />
              </div>
            </div>

            {/* PLANNER TAB */}
            {activeTab === 'plan' && (
              <div className="flex flex-col gap-2 md:gap-3">
                <PlannerStatusRail
                  onShowPricing={() => setIsPricingOpen(true)}
                  onAddPhone={!hasSavedPhone ? () => setIsPhonePromptOpen(true) : undefined}
                />

                {isTrialActive && (
                  <TrustProgressCard
                    className="hidden md:block"
                    compact
                    onAddPhone={!hasSavedPhone ? () => setIsPhonePromptOpen(true) : undefined}
                  />
                )}

                <div className="planner-sticky-panel sticky top-0 z-30 -mx-3 space-y-1.5 border-b border-gray-200/70 bg-gray-50 px-3 pb-2 pt-1 shadow-[0_10px_22px_-22px_rgba(15,23,42,0.38)] md:static md:mx-0 md:space-y-4 md:border-b-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:shadow-none">
                  <PlannerDateStrip
                    selectedDate={selectedPlannerDate}
                    rangeStartDate={planStartDate}
                    onDateSelect={handleSelectPlannerDate}
                    schedule={schedule}
                  />

                  <PlannerActionStrip
                    currentProfileId={currentProfileId}
                    profiles={profiles}
                    hasVisibleWeekMeals={hasVisibleWeekMeals}
                    loading={loading}
                    onProfileChange={setCurrentProfileId}
                    onGeneratePlan={handleRegenerateClick}
                    onOpenSavedRecipes={() => setIsSavedRecipesPanelOpen(true)}
                    onShare={hasVisibleWeekMeals && weeklyPlan ? handleShareCurrentPlan : undefined}
                  />

                  <div className="hidden items-center justify-end px-1 md:flex">
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleRegenerateClick}
                        disabled={loading}
                        data-tour="generate-button"
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold shadow-sm transition-all ${hasVisibleWeekMeals
                          ? 'border-2 border-orange-500 bg-white text-orange-600 hover:bg-orange-50'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                          } disabled:opacity-70`}
                        title={hasVisibleWeekMeals ? "Regenerate meal plan" : "Generate new meal plan"}
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{hasVisibleWeekMeals ? 'Regenerate' : 'Generate Plan'}</span>
                      </button>
                      {hasVisibleWeekMeals && weeklyPlan && (
                        <button
                          type="button"
                          onClick={handleShareCurrentPlan}
                          className="touch-target inline-flex items-center justify-center rounded-lg border-2 border-indigo-500 bg-white p-2 text-indigo-600 shadow-sm hover:bg-indigo-50"
                          title="Share plan"
                          aria-label="Share plan"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {loading && <LoadingState currentDay={streamingDay} isStreaming={streamingDay > 0} thinkingMessage={thinkingMessage} partialDays={partialDays} />}

                {weeklyPlan && (() => {
                  // Calculate dates starting from selected date in calendar strip
                  const planDates = weeklyPlan.days.map((_, idx) => addDays(planStartDate, idx));

                  return (
                    <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 lg:grid-cols-3">
                      {weeklyPlan.days.map((day, index) => (
                        <div key={day.day} data-day-index={index}>
                          <MealCard
                            dayPlan={day}
                            dayIndex={index}
                            dateLabel={format(planDates[index], 'EEE, MMM d')}
                            enabledMeals={selectedMeals}
                            onRegenerate={handleRegenerateMeal}
                            onSmartEdit={(plan, idx) => setSmartEditData({ dayPlan: plan, index: idx })}
                            onMealUpdate={handleMealUpdate}
                            isLoading={regenLoading}
                            isSwapMode={!!swapCandidate}
                            selectedSwap={swapCandidate}
                            showPrepReminders={getActivePreferences().showPrepReminders ?? true}
                            showQuantities={getActivePreferences().showQuantities ?? true}
                            isLastDay={index === weeklyPlan.days.length - 1}
                            isSelectedDay={isSameDay(planDates[index], selectedPlannerDate)}
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

                {canReviewLearning && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">Teach Qook is ready</p>
                        <p className="text-sm text-indigo-700">
                          Recent swaps, edits, or regenerations created {pendingSignalSummary?.meaningfulSignalCount || 0} learning signal{(pendingSignalSummary?.meaningfulSignalCount || 0) === 1 ? '' : 's'}.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openTeachQook}
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                      >
                        <Brain className="w-4 h-4" />
                        Review Teach Qook
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GROCERY TAB */}
            {activeTab === 'grocery' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        Groceries
                        {groceryLoading && <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Check items as bought, or remember them as inventory and pantry staples for future meal plans.
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex w-full sm:w-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                    {[
                      { id: 'list', label: 'List', icon: ShoppingCart },
                      { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setGrocerySubTab(tab.id as 'list' | 'calendar')}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${grocerySubTab === tab.id
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Suspense fallback={<SectionLoader className="min-h-[24rem]" />}>
                  {grocerySubTab === 'list' ? (
                    <GroceryList
                      items={groceryList}
                      onToggle={toggleGroceryItem}
                      onDeleteItem={handleDeleteGroceryItem}
                      onAddItem={handleAddManualGroceryItem}
                      onRememberItem={handleRememberGroceryItem}
                      schedule={schedule}
                      onGenerateFromDates={handleGenerateGroceryFromWeek}
                      loading={groceryLoading}
                      onLoadSavedList={(items, range) => replaceGroceryList(items, range)}
                      userId={userId}
                      currentDateRange={currentGroceryDateRange}
                      onShare={(items, range) => setShareModalData({ isOpen: true, type: 'grocery', data: items, dateRange: range, sourceLanguage: activePreferences.language })}
                    />
                  ) : (
                    <div className="flex flex-col min-h-0">
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
                            sourceLanguage: activePreferences.language
                          });
                        }}
                      />
                    </div>
                  )}
                </Suspense>
              </div>
            )}

            {/* PREFERENCES TAB */}
            {activeTab === 'preferences' && (
              <div className="max-w-4xl space-y-4">
                <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Preferences & Kitchen Setup</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        This is the setup Qook is using right now for meal coverage, tiffin, pantry, dislikes, and reminders.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openPreferences}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Open Full Preferences
                    </button>
                  </div>
                </div>

                {renderKitchenSetupCard(
                  isPreferencesKitchenSetupExpanded,
                  () => setIsPreferencesKitchenSetupExpanded((previous) => !previous),
                  false
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInventoryFlowMode('planner');
                      setIsInventoryCaptureOpen(true);
                    }}
                    className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-left shadow-sm hover:bg-emerald-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Refrigerator className="w-5 h-5 text-emerald-700" />
                      <p className="font-semibold text-emerald-900">What I Have</p>
                    </div>
                    <p className="text-sm text-emerald-800">
                      {inventorySummary.names.length > 0
                        ? `${inventorySummary.names.length} ingredient${inventorySummary.names.length === 1 ? '' : 's'} ready to use in future plans.`
                        : 'Add fridge, pantry, receipt, or typed items so Qook uses what is already at home.'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-left shadow-sm hover:bg-indigo-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <CalendarDays className="w-5 h-5 text-indigo-700" />
                      <p className="font-semibold text-indigo-900">Reminders & Planning</p>
                    </div>
                    <p className="text-sm text-indigo-800">
                      Morning, dinner, prep-tonight, and Sunday planning reminders are managed locally on this device.
                    </p>
                  </button>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Modals */}
      {isAlternativesSidebarOpen && (
        <Suspense fallback={<OverlayLoader />}>
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
        </Suspense>
      )}

      {isPreferencesOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <PreferencesModal
            profiles={profiles}
            currentProfileId={currentProfileId}
            history={mealHistory}
            onSaveProfile={handleSaveProfile}
            onSaveHouseholdSettings={handleHouseholdSettingsSaved}
            onSwitchProfile={setCurrentProfileId}
            onDeleteProfile={handleDeleteProfile}
            onClose={() => setIsPreferencesOpen(false)}
            onRerunOnboarding={() => setShowOnboardingWizard(true)}
          />
        </Suspense>
      )}

      {isSettingsOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <SettingsModal
            onClose={() => setIsSettingsOpen(false)}
            canClose={true}
            onDeleteAccount={() => setIsDeleteAccountOpen(true)}
            notificationSettings={notificationSettings}
            onSaveNotificationSettings={handleSaveNotificationSettings}
          />
        </Suspense>
      )}

      {smartEditData && (
        <Suspense fallback={<OverlayLoader />}>
          <SmartEditModal
            dayPlan={smartEditData.dayPlan}
            enabledMealTypes={selectedMeals}
            onAnalyze={handleSmartEditAnalyze}
            onConfirm={handleSmartEditConfirm}
            onClose={() => setSmartEditData(null)}
          />
        </Suspense>
      )}

      {isInventoryCaptureOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <InventoryCaptureModal
            isOpen={isInventoryCaptureOpen}
            existingItems={inventoryItems}
            title={inventoryFlowMode === 'onboarding' ? 'Add What You Already Have' : 'Update What You Already Have'}
            description={inventoryFlowMode === 'onboarding'
              ? 'Capture your fridge, pantry, receipt, or typed ingredients before Qook generates your next meal plan.'
              : 'Keep your kitchen memory fresh so future plans and grocery lists reflect what is already at home.'}
            ctaLabel={inventoryFlowMode === 'onboarding' ? 'Use These in My Next Plan' : 'Save to What I Have'}
            onClose={() => setIsInventoryCaptureOpen(false)}
            onSkip={inventoryFlowMode === 'onboarding' ? () => setIsInventoryCaptureOpen(false) : undefined}
            onAddItems={handleAddInventoryItems}
            onRemoveItem={handleRemoveInventoryItem}
          />
        </Suspense>
      )}

      <PreferenceLearningSheet
        isOpen={isLearningSheetOpen}
        summary={pendingSignalSummary}
        onClose={() => {
          setLearningApplyError(null);
          setIsLearningSheetOpen(false);
        }}
        onApply={handleApplyLearningSummary}
        onDismiss={handleDismissLearningSummary}
        onLater={() => {
          setLearningApplyError(null);
          setIsLearningSheetOpen(false);
        }}
        onOpenPreferences={openPreferences}
        isApplying={isApplyingLearning}
        applyError={learningApplyError}
      />

      {transferData && (
        <Suspense fallback={<OverlayLoader />}>
          <MoveMealModal
            transfer={transferData}
            onConfirm={handleTransferConfirm}
            onClose={() => setTransferData(null)}
          />
        </Suspense>
      )}

      {showArchiveModal && (
        <Suspense fallback={<OverlayLoader />}>
          <ArchiveModal
            onConfirm={handleArchiveConfirm}
            onClose={() => setShowArchiveModal(false)}
            schedule={schedule}
            daysCount={weeklyPlan?.days.length || 7}
            startDateOverride={format(planStartDate, 'yyyy-MM-dd')}
          />
        </Suspense>
      )}

      {shareModalData.isOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <ShareModal
            isOpen={shareModalData.isOpen}
            onClose={() => setShareModalData({ ...shareModalData, isOpen: false })}
            type={shareModalData.type}
            data={shareModalData.data}
            dateRange={shareModalData.dateRange}
            sourceLanguage={shareModalData.sourceLanguage}
            familyGroupId={activeFamilyGroupId}
          />
        </Suspense>
      )}

      {isFeedbackOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <FeedbackModal
            isOpen={isFeedbackOpen}
            onClose={() => setIsFeedbackOpen(false)}
            userId={userId}
          />
        </Suspense>
      )}

      {/* Pricing Modal */}
      {isPricingOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <PricingPage
            onClose={() => setIsPricingOpen(false)}
            onUpgradeSuccess={() => { }}
          />
        </Suspense>
      )}

      {/* Delete Account Modal */}
      {isDeleteAccountOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <DeleteAccountModal
            isOpen={isDeleteAccountOpen}
            onClose={() => setIsDeleteAccountOpen(false)}
          />
        </Suspense>
      )}
      {/* Onboarding Modal */}
      {showOnboarding && (
        <Suspense fallback={<OverlayLoader />}>
          <OnboardingModal
            onComplete={() => setShowOnboarding(false)}
            isMobile={window.innerWidth < 768}
          />
        </Suspense>
      )}

      {/* Onboarding Tour - Spotlight-based walkthrough */}
      {showTour && (
        <Suspense fallback={<OverlayLoader />}>
          <OnboardingTour
            onComplete={async () => {
              const completedAt = new Date().toISOString();
              setShowTour(false);
              setTourCompletedAt(completedAt);
              if (userId) {
                try {
                  await supabaseService.saveUserSettings(userId, { tourCompletedAt: completedAt });
                } catch (error) {
                  console.error('Failed to persist tour completion:', error);
                }
              }
            }}
            forceShow={forceOnboarding}
            onTriggerAction={(action) => {
              switch (action) {
                case 'open-preferences':
                  openPreferences();
                  break;
                case 'close-preferences':
                  setIsPreferencesOpen(false);
                  break;
                case 'open-inventory':
                  setActiveTab('plan');
                  setInventoryFlowMode('planner');
                  setIsInventoryCaptureOpen(true);
                  break;
                case 'open-learning':
                  setActiveTab('plan');
                  openTeachQook();
                  break;
                case 'open-quick-swap':
                  setActiveTab('plan');
                  if (weeklyPlan?.days?.length) {
                    const preferredMealType = selectedMeals[0] || 'lunch';
                    setSwapCandidate({ dayIndex: 0, mealType: preferredMealType });
                    setIsAlternativesSidebarOpen(true);
                  }
                  break;
                case 'switch-to-calendar':
                  setActiveTab('grocery');
                  setGrocerySubTab('calendar');
                  break;
                case 'switch-to-grocery':
                  setActiveTab('grocery');
                  setGrocerySubTab('list');
                  break;
                case 'switch-to-plan':
                  setActiveTab('plan');
                  break;
                case 'load-demo-plan':
                  // Save user's current plan before loading demo
                  savedPlanBeforeTour.current = weeklyPlan;
                  setWeeklyPlan({ ...DEMO_MEAL_PLAN, weekStartDate: format(new Date(), 'yyyy-MM-dd') });
                  setActiveTab('plan');
                  break;
                case 'load-demo-grocery':
                  // Save user's current grocery before loading demo
                  savedGroceryBeforeTour.current = groceryList;
                  savedGroceryRangeBeforeTour.current = currentGroceryDateRange;
                  replaceGroceryList(DEMO_GROCERY_LIST, '');
                  break;
                case 'clear-demo':
                  // Restore user's data when tour ends (don't wipe their real data)
                  if (savedPlanBeforeTour.current !== null) {
                    setWeeklyPlan(savedPlanBeforeTour.current);
                    savedPlanBeforeTour.current = null;
                  }
                  if (savedGroceryBeforeTour.current.length > 0) {
                    replaceGroceryList(savedGroceryBeforeTour.current, savedGroceryRangeBeforeTour.current);
                    savedGroceryBeforeTour.current = [];
                    savedGroceryRangeBeforeTour.current = '';
                  }
                  break;
              }
            }}
          />
        </Suspense>
      )}

      {/* Demo Mode Badge */}
      {demoMode && (
        <div className="fixed bottom-4 left-4 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold z-50 shadow-lg flex items-center gap-2">
          <span>??</span> DEMO MODE
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
      {isRecipePanelOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <RecipePanel
            mealName={recipeMealName}
            isOpen={isRecipePanelOpen}
            onClose={() => {
              setIsRecipePanelOpen(false);
              setRecipeMealName(null);
            }}
          />
        </Suspense>
      )}

      {/* Saved Recipes Panel - List of user's favorite recipes */}
      {isSavedRecipesPanelOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <SavedRecipesPanel
            isOpen={isSavedRecipesPanelOpen}
            onClose={() => setIsSavedRecipesPanelOpen(false)}
            onSelectRecipe={(mealName) => {
              setIsSavedRecipesPanelOpen(false);
              setRecipeMealName(mealName);
              setIsRecipePanelOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Phone Prompt Modal for Trust Actions */}
      <PhonePromptModal
        isOpen={isPhonePromptOpen && !hasSavedPhone}
        onClose={() => setIsPhonePromptOpen(false)}
        onSuccess={async (credits) => {
          const refreshedUserProfile = await supabaseService.getUserProfile(userId);
          if (refreshedUserProfile) {
            setUserProfile(refreshedUserProfile);
          }
          addToast(`+${credits} credits earned for adding phone.`, 'success');
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;

