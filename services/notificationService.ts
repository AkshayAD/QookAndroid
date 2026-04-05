import { Preferences as CapacitorPreferences } from '@capacitor/preferences';
import { LocalNotifications, Weekday } from '@capacitor/local-notifications';
import { format } from 'date-fns';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Schedule, UserPreferences } from '../types';
import { normalizeSelectedMeals } from '../lib/mealSelection';
import { sanitizeMealText, sanitizePlainText } from '../lib/mealSanitizer';
import { isNative } from '../utils/platform';

const STORAGE_KEY = 'qook_notification_settings_v2';

const NOTIFICATION_ID_BASE = {
  morning: 100000000,
  dinner: 200000000,
  prepTonight: 300000000,
  sundayPlanning: 900001,
  test: 999999,
} as const;

export interface NotificationTime {
  hour: number;
  minute: number;
}

export interface WeeklyNotificationTime extends NotificationTime {
  weekday: Weekday;
}

export interface NotificationSettings {
  enabled: boolean;
  morningPlanEnabled: boolean;
  morningPlanTime: NotificationTime;
  dinnerEnabled: boolean;
  dinnerTime: NotificationTime;
  prepTonightEnabled: boolean;
  prepTonightTime: NotificationTime;
  sundayPlanningEnabled: boolean;
  sundayPlanningTime: WeeklyNotificationTime;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  morningPlanEnabled: true,
  morningPlanTime: { hour: 7, minute: 0 },
  dinnerEnabled: true,
  dinnerTime: { hour: 17, minute: 30 },
  prepTonightEnabled: true,
  prepTonightTime: { hour: 20, minute: 0 },
  sundayPlanningEnabled: true,
  sundayPlanningTime: { weekday: Weekday.Sunday, hour: 9, minute: 0 },
};

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function ensurePreferencesGroup(): Promise<void> {
  if (isNative()) {
    await CapacitorPreferences.configure({ group: 'QookCommanderNotifications' });
  }
}

function mergeSettings(raw?: Partial<NotificationSettings> | null): NotificationSettings {
  return {
    enabled: raw?.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
    morningPlanEnabled: raw?.morningPlanEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.morningPlanEnabled,
    morningPlanTime: {
      hour: raw?.morningPlanTime?.hour ?? DEFAULT_NOTIFICATION_SETTINGS.morningPlanTime.hour,
      minute: raw?.morningPlanTime?.minute ?? DEFAULT_NOTIFICATION_SETTINGS.morningPlanTime.minute,
    },
    dinnerEnabled: raw?.dinnerEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.dinnerEnabled,
    dinnerTime: {
      hour: raw?.dinnerTime?.hour ?? DEFAULT_NOTIFICATION_SETTINGS.dinnerTime.hour,
      minute: raw?.dinnerTime?.minute ?? DEFAULT_NOTIFICATION_SETTINGS.dinnerTime.minute,
    },
    prepTonightEnabled: raw?.prepTonightEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.prepTonightEnabled,
    prepTonightTime: {
      hour: raw?.prepTonightTime?.hour ?? DEFAULT_NOTIFICATION_SETTINGS.prepTonightTime.hour,
      minute: raw?.prepTonightTime?.minute ?? DEFAULT_NOTIFICATION_SETTINGS.prepTonightTime.minute,
    },
    sundayPlanningEnabled: raw?.sundayPlanningEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.sundayPlanningEnabled,
    sundayPlanningTime: {
      weekday: raw?.sundayPlanningTime?.weekday ?? DEFAULT_NOTIFICATION_SETTINGS.sundayPlanningTime.weekday,
      hour: raw?.sundayPlanningTime?.hour ?? DEFAULT_NOTIFICATION_SETTINGS.sundayPlanningTime.hour,
      minute: raw?.sundayPlanningTime?.minute ?? DEFAULT_NOTIFICATION_SETTINGS.sundayPlanningTime.minute,
    },
  };
}

function parseStoredSettings(value?: string | null): NotificationSettings {
  if (!value) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  try {
    return mergeSettings(JSON.parse(value));
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

function toDateKeyNumber(dateKey: string): number {
  return Number(dateKey.replace(/-/g, '')) || 0;
}

function buildNotificationId(base: number, dateKey: string): number {
  return base + toDateKeyNumber(dateKey);
}

function buildScheduledDate(dateKey: string, time: NotificationTime): Date {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
}

function collapseMealForNotification(value?: string | null): string {
  const sanitized = sanitizeMealText(value);
  if (!sanitized) {
    return '';
  }

  return sanitized
    .split('\n')
    .map((line) => sanitizePlainText(line))
    .filter(Boolean)
    .join(', ');
}

function isNonEmptyMeal(value?: string | null): boolean {
  return Boolean(collapseMealForNotification(value));
}

function getWeekdayLabel(dateKey: string): string {
  return format(new Date(`${dateKey}T00:00:00`), 'EEEE');
}

function isTiffinDay(dateKey: string, preferences: Pick<UserPreferences, 'hasTiffin' | 'tiffinDays'>): boolean {
  if (!preferences.hasTiffin) {
    return false;
  }

  const tiffinDays = (preferences.tiffinDays || []).map((value) => value.toLowerCase());
  if (tiffinDays.length === 0) {
    return true;
  }

  return tiffinDays.includes(getWeekdayLabel(dateKey).toLowerCase());
}

function buildMorningNotification(
  dateKey: string,
  day: Schedule[string],
  preferences: Pick<UserPreferences, 'mealsToPrepare' | 'hasTiffin' | 'tiffinDays'>
): LocalNotificationSchema | null {
  const selectedMeals = normalizeSelectedMeals(preferences.mealsToPrepare);
  const breakfast = selectedMeals.includes('breakfast') ? collapseMealForNotification(day.breakfast) : '';
  const lunch = selectedMeals.includes('lunch') ? collapseMealForNotification(day.lunch) : '';

  if (!breakfast && !lunch) {
    return null;
  }

  const lines: string[] = [];
  if (breakfast) {
    lines.push(`Breakfast: ${breakfast}`);
  }

  if (lunch) {
    const lunchLabel = isTiffinDay(dateKey, preferences) ? 'Lunch (tiffin)' : 'Lunch';
    lines.push(`${lunchLabel}: ${lunch}`);
  }

  const title = breakfast && lunch
    ? 'Today\'s breakfast + lunch'
    : breakfast
      ? 'Today\'s breakfast'
      : isTiffinDay(dateKey, preferences)
        ? 'Today\'s tiffin lunch'
        : 'Today\'s lunch';

  return {
    id: buildNotificationId(NOTIFICATION_ID_BASE.morning, dateKey),
    title,
    body: lines.join('\n'),
    largeBody: lines.join('\n'),
    group: 'qook-daily-plan',
    autoCancel: true,
    extra: { type: 'morning-plan', dateKey },
  };
}

function buildDinnerNotification(
  dateKey: string,
  day: Schedule[string],
  preferences: Pick<UserPreferences, 'mealsToPrepare'>
): LocalNotificationSchema | null {
  const selectedMeals = normalizeSelectedMeals(preferences.mealsToPrepare);
  const dinner = selectedMeals.includes('dinner') ? collapseMealForNotification(day.dinner) : '';

  if (!dinner) {
    return null;
  }

  return {
    id: buildNotificationId(NOTIFICATION_ID_BASE.dinner, dateKey),
    title: 'Tonight\'s dinner',
    body: dinner,
    largeBody: dinner,
    group: 'qook-daily-plan',
    autoCancel: true,
    extra: { type: 'dinner-plan', dateKey },
  };
}

function buildPrepTonightNotification(
  tomorrowDateKey: string,
  tomorrow: Schedule[string],
  preferences: Pick<UserPreferences, 'mealsToPrepare' | 'showPrepReminders'>
): LocalNotificationSchema | null {
  if (preferences.showPrepReminders === false) {
    return null;
  }

  const selectedMeals = normalizeSelectedMeals(preferences.mealsToPrepare);
  const prepTasks = [
    selectedMeals.includes('breakfast') ? sanitizePlainText(tomorrow.prepAhead?.forBreakfast) : '',
    selectedMeals.includes('lunch') ? sanitizePlainText(tomorrow.prepAhead?.forLunch) : '',
  ].filter(Boolean);

  if (prepTasks.length === 0) {
    return null;
  }

  const scheduleDate = new Date(`${tomorrowDateKey}T00:00:00`);
  scheduleDate.setDate(scheduleDate.getDate() - 1);
  const prepDateKey = format(scheduleDate, 'yyyy-MM-dd');

  return {
    id: buildNotificationId(NOTIFICATION_ID_BASE.prepTonight, tomorrowDateKey),
    title: 'Prep tonight for tomorrow',
    body: prepTasks.join('\n'),
    largeBody: prepTasks.join('\n'),
    group: 'qook-prep',
    autoCancel: true,
    extra: { type: 'prep-tonight', prepDateKey, tomorrowDateKey },
  };
}

function isFutureSchedule(date: Date, now: Date): boolean {
  return date.getTime() > now.getTime();
}

function toUpcomingScheduleEntries(schedule: Schedule): Array<[string, Schedule[string]]> {
  return Object.entries(schedule)
    .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
    .sort(([left], [right]) => left.localeCompare(right));
}

class NotificationService {
  private hasPermission = false;

  async requestPermission(): Promise<boolean> {
    if (!isNative()) return false;

    try {
      const status = await LocalNotifications.checkPermissions();

      if (status.display === 'granted') {
        this.hasPermission = true;
        return true;
      }

      const result = await LocalNotifications.requestPermissions();
      this.hasPermission = result.display === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    if (!isNative()) return false;

    try {
      const status = await LocalNotifications.checkPermissions();
      this.hasPermission = status.display === 'granted';
      return this.hasPermission;
    } catch {
      return false;
    }
  }

  async loadSettings(): Promise<NotificationSettings> {
    await ensurePreferencesGroup();

    if (isNative()) {
      const { value } = await CapacitorPreferences.get({ key: STORAGE_KEY });
      return parseStoredSettings(value);
    }

    if (isBrowserStorageAvailable()) {
      return parseStoredSettings(window.localStorage.getItem(STORAGE_KEY));
    }

    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  async saveSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    await ensurePreferencesGroup();
    const normalized = mergeSettings(settings);
    const serialized = JSON.stringify(normalized);

    if (isNative()) {
      await CapacitorPreferences.set({ key: STORAGE_KEY, value: serialized });
    } else if (isBrowserStorageAvailable()) {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }

    return normalized;
  }

  async cancelAll(): Promise<void> {
    if (!isNative()) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((notification) => ({ id: notification.id })),
        });
      }

      await LocalNotifications.removeAllDeliveredNotifications();
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  async rescheduleNotifications(
    schedule: Schedule,
    preferences: Pick<UserPreferences, 'mealsToPrepare' | 'hasTiffin' | 'tiffinDays' | 'showPrepReminders'>,
    settings: NotificationSettings
  ): Promise<void> {
    if (!isNative()) return;

    await this.cancelAll();

    if (!settings.enabled) {
      return;
    }

    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      return;
    }

    const now = new Date();
    const notifications: LocalNotificationSchema[] = [];
    const upcomingDays = toUpcomingScheduleEntries(schedule);

    for (const [dateKey, day] of upcomingDays) {
      const morningNotification = settings.morningPlanEnabled
        ? buildMorningNotification(dateKey, day, preferences)
        : null;
      if (morningNotification) {
        const scheduledAt = buildScheduledDate(dateKey, settings.morningPlanTime);
        if (isFutureSchedule(scheduledAt, now)) {
          notifications.push({
            ...morningNotification,
            schedule: { at: scheduledAt, allowWhileIdle: true },
          });
        }
      }

      const dinnerNotification = settings.dinnerEnabled
        ? buildDinnerNotification(dateKey, day, preferences)
        : null;
      if (dinnerNotification) {
        const scheduledAt = buildScheduledDate(dateKey, settings.dinnerTime);
        if (isFutureSchedule(scheduledAt, now)) {
          notifications.push({
            ...dinnerNotification,
            schedule: { at: scheduledAt, allowWhileIdle: true },
          });
        }
      }

      const prepTonightNotification = settings.prepTonightEnabled
        ? buildPrepTonightNotification(dateKey, day, preferences)
        : null;
      if (prepTonightNotification && prepTonightNotification.extra?.prepDateKey) {
        const scheduledAt = buildScheduledDate(
          prepTonightNotification.extra.prepDateKey,
          settings.prepTonightTime
        );

        if (isFutureSchedule(scheduledAt, now)) {
          notifications.push({
            ...prepTonightNotification,
            schedule: { at: scheduledAt, allowWhileIdle: true },
          });
        }
      }
    }

    if (settings.sundayPlanningEnabled) {
      notifications.push({
        id: NOTIFICATION_ID_BASE.sundayPlanning,
        title: 'Plan your week with Qook',
        body: 'Open Qook and generate your next week\'s meals while your kitchen setup is fresh.',
        largeBody: 'Open Qook and generate your next week\'s meals while your kitchen setup is fresh.',
        autoCancel: true,
        group: 'qook-weekly-plan',
        extra: { type: 'sunday-planning' },
        schedule: {
          on: {
            weekday: settings.sundayPlanningTime.weekday,
            hour: settings.sundayPlanningTime.hour,
            minute: settings.sundayPlanningTime.minute,
          },
          every: 'week',
          allowWhileIdle: true,
        },
      });
    }

    if (notifications.length === 0) {
      return;
    }

    await LocalNotifications.schedule({ notifications });
  }

  async sendTestNotification(): Promise<void> {
    if (!isNative()) {
      alert('Notifications only work on native devices.');
      return;
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      alert('Please enable notifications in your device settings.');
      return;
    }

    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIFICATION_ID_BASE.test,
        title: 'Qook notifications are on',
        body: 'You\'ll only get reminders for real planned meals and prep tasks.',
        largeBody: 'You\'ll only get reminders for real planned meals and prep tasks.',
        autoCancel: true,
        schedule: { at: new Date(Date.now() + 1000) },
      }],
    });
  }
}

export const notificationService = new NotificationService();
