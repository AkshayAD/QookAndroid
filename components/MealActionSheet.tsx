import React from 'react';
import { ChevronRight, X } from 'lucide-react';

export interface MealActionSheetAction {
    id: string;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    disabled?: boolean;
    tone?: 'default' | 'primary';
    helperText?: string;
}

interface MealActionSheetProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    actions: MealActionSheetAction[];
    onClose: () => void;
}

export default function MealActionSheet({
    isOpen,
    title,
    subtitle,
    actions,
    onClose,
}: MealActionSheetProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-900/35 md:hidden" onClick={onClose} />
            <div className="mobile-sheet md:hidden">
                <div className="flex justify-center py-2">
                    <div className="h-1 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 pb-3">
                    <div className="min-w-0">
                        <p className="text-base font-semibold text-gray-900">{title}</p>
                        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="touch-target rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close action sheet"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto px-3 py-3">
                    <div className="space-y-2">
                        {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => {
                                        action.onClick();
                                        onClose();
                                    }}
                                    disabled={action.disabled}
                                    className={`touch-target flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${action.tone === 'primary'
                                        ? 'border-orange-200 bg-orange-50 text-orange-700'
                                        : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                                        } ${action.disabled ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className={`rounded-xl p-2 ${action.tone === 'primary' ? 'bg-white text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{action.label}</p>
                                            {action.helperText && (
                                                <p className="mt-0.5 text-xs text-gray-500">{action.helperText}</p>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
}
