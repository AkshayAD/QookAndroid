/**
 * Network Status Hook
 * Provides real-time network connectivity status for React components.
 * Uses Capacitor Network plugin for native apps, web events for browsers.
 */

import { useState, useEffect, useCallback } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { isNative } from '../utils/platform';

interface NetworkState {
    isOnline: boolean;
    connectionType: string;
}

/**
 * Hook to monitor network connectivity status
 */
export function useNetworkStatus() {
    const [state, setState] = useState<NetworkState>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        connectionType: 'unknown',
    });

    useEffect(() => {
        let mounted = true;

        const updateStatus = (status: ConnectionStatus) => {
            if (mounted) {
                setState({
                    isOnline: status.connected,
                    connectionType: status.connectionType,
                });
            }
        };

        if (isNative()) {
            // Get initial status
            Network.getStatus().then(updateStatus);

            // Listen for changes
            const listener = Network.addListener('networkStatusChange', updateStatus);

            return () => {
                mounted = false;
                listener.then(l => l.remove());
            };
        } else {
            // Web fallback
            const handleOnline = () => {
                if (mounted) {
                    setState({ isOnline: true, connectionType: 'wifi' });
                }
            };

            const handleOffline = () => {
                if (mounted) {
                    setState({ isOnline: false, connectionType: 'none' });
                }
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                mounted = false;
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }
    }, []);

    return state;
}

/**
 * Non-hook function to check network status (for use outside components)
 */
export async function checkNetworkStatus(): Promise<boolean> {
    if (isNative()) {
        const status = await Network.getStatus();
        return status.connected;
    }
    return navigator.onLine;
}
