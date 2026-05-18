import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, ShoppingCart, User, Settings } from 'lucide-react';
import { APP_CHROME_VARS } from '../lib/appChrome';
import { useMeasuredChromeVar } from '../hooks/useAppChrome';

interface BottomNavProps {
    activeTab: 'plan' | 'grocery' | 'preferences' | 'profile';
    onTabChange: (tab: 'plan' | 'grocery' | 'preferences' | 'profile') => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const navRef = useRef<HTMLElement | null>(null);
    const [debugVariant, setDebugVariant] = useState<'default' | 'tall'>(() => {
        if (!import.meta.env.DEV) {
            return 'default';
        }

        return window.localStorage.getItem('qook.dev.bottom-nav-variant') === 'tall' ? 'tall' : 'default';
    });

    useMeasuredChromeVar(navRef, APP_CHROME_VARS.bottomChromeHeight);

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }

        window.localStorage.setItem('qook.dev.bottom-nav-variant', debugVariant);
    }, [debugVariant]);

    const tabs = [
        { id: 'plan', label: 'Plan', icon: ClipboardList },
        { id: 'grocery', label: 'Grocery', icon: ShoppingCart },
        { id: 'preferences', label: 'Setup', icon: Settings },
        { id: 'profile', label: 'Profile', icon: User },
    ] as const;

    const isTallVariant = debugVariant === 'tall';

    return (
        <>
            {import.meta.env.DEV && (
                <button
                    type="button"
                    onClick={() => setDebugVariant((current) => current === 'default' ? 'tall' : 'default')}
                    className="app-safe-sticky-bottom fixed right-3 z-[60] rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg md:hidden"
                    style={{ bottom: 'calc(var(--app-bottom-chrome-height) + 0.75rem)' }}
                >
                    Nav {isTallVariant ? 'Tall' : 'Default'}
                </button>
            )}
            <nav
                ref={navRef}
                data-nav-variant={debugVariant}
                className="app-bottom-nav app-bottom-dock z-50 box-border border-t border-gray-200 bg-white shadow-[0_-8px_22px_-18px_rgba(15,23,42,0.22)] md:hidden"
            >
            <div
                className={`mx-auto box-border flex max-w-md items-center px-1 ${isTallVariant ? 'py-1.5' : 'py-0.5'}`}
                style={{ paddingBottom: 'calc(var(--app-safe-bottom) + 0.0625rem)' }}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            data-tour={`${tab.id}-tab-mobile`}
                            className={`touch-target flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-1.5 ${isTallVariant ? 'gap-1 py-1.5' : 'gap-0 py-0.5'} transition-all duration-200 ${isActive ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <div className={`rounded-2xl px-2.5 ${isTallVariant ? 'py-1.5' : 'py-0.5'} transition-all ${isActive ? 'bg-orange-50 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.16)]' : 'bg-transparent'
                                }`}>
                                <Icon className={`h-[18px] w-[18px] ${isActive ? 'stroke-[2.4px]' : 'stroke-2'}`} />
                            </div>
                            <span className={`text-center ${isTallVariant ? 'text-[10px] leading-tight' : 'text-[9px]'} font-medium tracking-wide ${isActive ? 'font-bold text-orange-600' : 'text-gray-500'
                                }`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            </nav>
        </>
    );
}
