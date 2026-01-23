import React from 'react';
import { ClipboardList, Calendar as CalendarIcon, ShoppingCart, User } from 'lucide-react';

interface BottomNavProps {
    activeTab: 'plan' | 'calendar' | 'grocery' | 'profile';
    onTabChange: (tab: 'plan' | 'calendar' | 'grocery' | 'profile') => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const tabs = [
        { id: 'plan', label: 'Plan', icon: ClipboardList },
        { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
        { id: 'grocery', label: 'Grocery', icon: ShoppingCart },
        { id: 'profile', label: 'Profile', icon: User },
    ] as const;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe pt-2 px-6 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden safe-area-bottom">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        data-tour={`${tab.id}-tab-mobile`}
                        className={`flex flex-col items-center gap-1 min-w-[64px] transition-all duration-200 ${isActive ? 'text-orange-600 scale-105' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-orange-50' : 'bg-transparent'
                            }`}>
                            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                        </div>
                        <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-orange-600 font-bold' : 'text-gray-500'
                            }`}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
