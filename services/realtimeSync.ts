/**
 * Realtime Sync Service
 * Handles Supabase Realtime subscriptions for live data synchronization.
 * Primarily used for Family Mode where multiple devices need to stay in sync.
 */

import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { offlineCache, CACHE_KEYS } from './offlineCache';

type SubscriptionCallback<T> = (data: T) => void;

interface ActiveSubscription {
    channel: RealtimeChannel;
    table: string;
    userId: string;
}

class RealtimeSyncService {
    private subscriptions: Map<string, ActiveSubscription> = new Map();
    private callbacks: Map<string, Set<SubscriptionCallback<any>>> = new Map();

    /**
     * Subscribe to schedule changes for a user
     * Used in Family Mode to sync meal schedule across devices
     */
    subscribeToSchedule(
        userId: string,
        onUpdate: SubscriptionCallback<any>
    ): () => void {
        const key = `schedule:${userId}`;

        // Add callback
        if (!this.callbacks.has(key)) {
            this.callbacks.set(key, new Set());
        }
        this.callbacks.get(key)!.add(onUpdate);

        // Create subscription if not exists
        if (!this.subscriptions.has(key)) {
            const channel = supabase
                .channel(key)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'scheduled_meals',
                        filter: `user_id=eq.${userId}`,
                    },
                    async (payload) => {
                        console.log('[Realtime] Schedule change:', payload.eventType);

                        // Invalidate cache
                        await offlineCache.remove(`${CACHE_KEYS.SCHEDULE}_${userId}`);

                        // Notify all callbacks
                        this.notifyCallbacks(key, payload);
                    }
                )
                .subscribe((status) => {
                    console.log('[Realtime] Schedule subscription status:', status);
                });

            this.subscriptions.set(key, {
                channel,
                table: 'scheduled_meals',
                userId,
            });
        }

        // Return unsubscribe function
        return () => {
            this.callbacks.get(key)?.delete(onUpdate);

            // If no more callbacks, remove subscription
            if (this.callbacks.get(key)?.size === 0) {
                this.unsubscribe(key);
            }
        };
    }

    /**
     * Subscribe to grocery list changes
     * Syncs checked/unchecked state across family devices
     */
    subscribeToGroceryList(
        listId: string,
        onUpdate: SubscriptionCallback<any>
    ): () => void {
        const key = `grocery:${listId}`;

        if (!this.callbacks.has(key)) {
            this.callbacks.set(key, new Set());
        }
        this.callbacks.get(key)!.add(onUpdate);

        if (!this.subscriptions.has(key)) {
            const channel = supabase
                .channel(key)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'grocery_lists',
                        filter: `id=eq.${listId}`,
                    },
                    async (payload) => {
                        console.log('[Realtime] Grocery change:', payload.eventType);

                        // Invalidate cache
                        await offlineCache.remove(`${CACHE_KEYS.GROCERY}_${listId}`);

                        // Notify callbacks
                        this.notifyCallbacks(key, payload);
                    }
                )
                .subscribe((status) => {
                    console.log('[Realtime] Grocery subscription status:', status);
                });

            this.subscriptions.set(key, {
                channel,
                table: 'grocery_lists',
                userId: listId,
            });
        }

        return () => {
            this.callbacks.get(key)?.delete(onUpdate);
            if (this.callbacks.get(key)?.size === 0) {
                this.unsubscribe(key);
            }
        };
    }

    /**
     * Subscribe to household settings changes
     * Syncs settings across family members
     */
    subscribeToHousehold(
        userId: string,
        onUpdate: SubscriptionCallback<any>
    ): () => void {
        const key = `household:${userId}`;

        if (!this.callbacks.has(key)) {
            this.callbacks.set(key, new Set());
        }
        this.callbacks.get(key)!.add(onUpdate);

        if (!this.subscriptions.has(key)) {
            const channel = supabase
                .channel(key)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'household_settings',
                        filter: `user_id=eq.${userId}`,
                    },
                    async (payload) => {
                        console.log('[Realtime] Household change:', payload.eventType);

                        // Invalidate cache
                        await offlineCache.remove(`${CACHE_KEYS.HOUSEHOLD}_${userId}`);

                        // Notify callbacks
                        this.notifyCallbacks(key, payload);
                    }
                )
                .subscribe((status) => {
                    console.log('[Realtime] Household subscription status:', status);
                });

            this.subscriptions.set(key, {
                channel,
                table: 'household_settings',
                userId,
            });
        }

        return () => {
            this.callbacks.get(key)?.delete(onUpdate);
            if (this.callbacks.get(key)?.size === 0) {
                this.unsubscribe(key);
            }
        };
    }

    /**
     * Notify all registered callbacks for a subscription
     */
    private notifyCallbacks(key: string, data: any): void {
        const callbacks = this.callbacks.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error('[Realtime] Callback error:', e);
                }
            });
        }
    }

    /**
     * Unsubscribe from a specific channel
     */
    private unsubscribe(key: string): void {
        const sub = this.subscriptions.get(key);
        if (sub) {
            supabase.removeChannel(sub.channel);
            this.subscriptions.delete(key);
            this.callbacks.delete(key);
            console.log('[Realtime] Unsubscribed from:', key);
        }
    }

    /**
     * Unsubscribe from all channels
     * Call this when user logs out or app is backgrounded
     */
    unsubscribeAll(): void {
        console.log('[Realtime] Unsubscribing from all channels');
        this.subscriptions.forEach((sub, key) => {
            supabase.removeChannel(sub.channel);
        });
        this.subscriptions.clear();
        this.callbacks.clear();
    }

    /**
     * Get count of active subscriptions
     */
    getActiveCount(): number {
        return this.subscriptions.size;
    }

    /**
     * Check if a specific subscription is active
     */
    isSubscribed(key: string): boolean {
        return this.subscriptions.has(key);
    }
}

// Export singleton instance
export const realtimeSync = new RealtimeSyncService();
