/**
 * Notification Service for Qook Commander
 * 
 * Handles local notifications for meal reminders and weekly planning prompts.
 * Uses @capacitor/local-notifications for native Android notifications.
 */

import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { isNative } from '../utils/platform';

// Notification IDs (keep consistent to avoid duplicates)
const NOTIFICATION_IDS = {
    BREAKFAST: 1,
    LUNCH: 2,
    DINNER: 3,
    WEEKLY_PLAN: 100,
    PANTRY_UPDATE: 101,
};

// Default notification times
export const DEFAULT_NOTIFICATION_TIMES = {
    breakfast: { hour: 7, minute: 0 },
    lunch: { hour: 11, minute: 30 },
    dinner: { hour: 17, minute: 0 },
    weeklyPlan: { weekday: 1, hour: 9, minute: 0 }, // Monday 9 AM
};

export interface NotificationSettings {
    enabled: boolean;
    breakfastEnabled: boolean;
    breakfastTime: { hour: number; minute: number };
    lunchEnabled: boolean;
    lunchTime: { hour: number; minute: number };
    dinnerEnabled: boolean;
    dinnerTime: { hour: number; minute: number };
    weeklyPlanEnabled: boolean;
    weeklyPlanTime: { weekday: number; hour: number; minute: number };
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    breakfastEnabled: true,
    breakfastTime: DEFAULT_NOTIFICATION_TIMES.breakfast,
    lunchEnabled: true,
    lunchTime: DEFAULT_NOTIFICATION_TIMES.lunch,
    dinnerEnabled: true,
    dinnerTime: DEFAULT_NOTIFICATION_TIMES.dinner,
    weeklyPlanEnabled: true,
    weeklyPlanTime: DEFAULT_NOTIFICATION_TIMES.weeklyPlan,
};

class NotificationService {
    private hasPermission = false;

    /**
     * Request notification permissions from the user
     */
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
        } catch (e) {
            console.error('Failed to request notification permission:', e);
            return false;
        }
    }

    /**
     * Check if notifications are enabled
     */
    async checkPermission(): Promise<boolean> {
        if (!isNative()) return false;

        try {
            const status = await LocalNotifications.checkPermissions();
            this.hasPermission = status.display === 'granted';
            return this.hasPermission;
        } catch (e) {
            return false;
        }
    }

    /**
     * Cancel all scheduled notifications
     */
    async cancelAll(): Promise<void> {
        if (!isNative()) return;

        try {
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel({
                    notifications: pending.notifications.map(n => ({ id: n.id })),
                });
            }
        } catch (e) {
            console.error('Failed to cancel notifications:', e);
        }
    }

    /**
     * Schedule daily meal reminders based on current meal plan
     */
    async scheduleMealReminders(
        meals: { breakfast?: string; lunch?: string; dinner?: string },
        settings: NotificationSettings
    ): Promise<void> {
        if (!isNative() || !settings.enabled) return;

        const hasPermission = await this.checkPermission();
        if (!hasPermission) return;

        const notifications: ScheduleOptions['notifications'] = [];

        // Breakfast reminder
        if (settings.breakfastEnabled && meals.breakfast) {
            notifications.push({
                id: NOTIFICATION_IDS.BREAKFAST,
                title: '🍳 Breakfast Time!',
                body: meals.breakfast,
                schedule: {
                    on: { hour: settings.breakfastTime.hour, minute: settings.breakfastTime.minute },
                    every: 'day',
                    allowWhileIdle: true,
                },
                sound: 'default',
                smallIcon: 'ic_launcher',
            });
        }

        // Lunch reminder
        if (settings.lunchEnabled && meals.lunch) {
            notifications.push({
                id: NOTIFICATION_IDS.LUNCH,
                title: '🍲 Lunch Today',
                body: meals.lunch,
                schedule: {
                    on: { hour: settings.lunchTime.hour, minute: settings.lunchTime.minute },
                    every: 'day',
                    allowWhileIdle: true,
                },
                sound: 'default',
                smallIcon: 'ic_launcher',
            });
        }

        // Dinner reminder
        if (settings.dinnerEnabled && meals.dinner) {
            notifications.push({
                id: NOTIFICATION_IDS.DINNER,
                title: '🍽️ Dinner Tonight',
                body: meals.dinner,
                schedule: {
                    on: { hour: settings.dinnerTime.hour, minute: settings.dinnerTime.minute },
                    every: 'day',
                    allowWhileIdle: true,
                },
                sound: 'default',
                smallIcon: 'ic_launcher',
            });
        }

        if (notifications.length > 0) {
            try {
                await LocalNotifications.schedule({ notifications });
                console.log('Scheduled meal reminders:', notifications.length);
            } catch (e) {
                console.error('Failed to schedule meal reminders:', e);
            }
        }
    }

    /**
     * Schedule weekly plan reminder (e.g., Sunday evening or Monday morning)
     */
    async scheduleWeeklyPlanReminder(settings: NotificationSettings): Promise<void> {
        if (!isNative() || !settings.enabled || !settings.weeklyPlanEnabled) return;

        const hasPermission = await this.checkPermission();
        if (!hasPermission) return;

        try {
            await LocalNotifications.schedule({
                notifications: [{
                    id: NOTIFICATION_IDS.WEEKLY_PLAN,
                    title: '📅 Plan Your Week',
                    body: 'Ready to plan next week\'s meals? Open Qook Commander!',
                    schedule: {
                        on: {
                            weekday: settings.weeklyPlanTime.weekday,
                            hour: settings.weeklyPlanTime.hour,
                            minute: settings.weeklyPlanTime.minute,
                        },
                        every: 'week',
                        allowWhileIdle: true,
                    },
                    sound: 'default',
                    smallIcon: 'ic_launcher',
                }],
            });
            console.log('Scheduled weekly plan reminder');
        } catch (e) {
            console.error('Failed to schedule weekly plan reminder:', e);
        }
    }

    /**
     * Send an immediate test notification
     */
    async sendTestNotification(): Promise<void> {
        if (!isNative()) {
            alert('Notifications only work on native devices');
            return;
        }

        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            alert('Please enable notification permissions in your device settings');
            return;
        }

        try {
            await LocalNotifications.schedule({
                notifications: [{
                    id: 999,
                    title: '✅ Qook Commander',
                    body: 'Notifications are working! You\'ll receive meal reminders.',
                    schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
                    sound: 'default',
                    smallIcon: 'ic_launcher',
                }],
            });
        } catch (e) {
            console.error('Failed to send test notification:', e);
        }
    }
}

// Export singleton instance
export const notificationService = new NotificationService();
