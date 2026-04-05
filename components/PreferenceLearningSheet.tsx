import React from 'react';
import { Brain, Check, Clock3, Sparkles, ThumbsDown, ThumbsUp, UtensilsCrossed, X } from 'lucide-react';
import { PreferenceSignalSummary } from '../types';

interface PreferenceLearningSheetProps {
    isOpen: boolean;
    summary: PreferenceSignalSummary | null;
    title?: string;
    description?: string;
    onClose: () => void;
    onApply: () => Promise<void> | void;
    onDismiss: () => Promise<void> | void;
    onLater?: () => void;
    onOpenPreferences?: () => void;
    isApplying?: boolean;
}

function SuggestionGroup({ icon: Icon, title, items, color }: {
    icon: React.ElementType;
    title: string;
    items: string[];
    color: string;
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className={`rounded-2xl border ${color} p-4`}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" />
                <h4 className="font-semibold">{title}</h4>
            </div>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <span key={item} className="px-3 py-1.5 rounded-full bg-white/80 text-sm font-medium">
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function PreferenceLearningSheet({
    isOpen,
    summary,
    title = 'Qook Learned From You',
    description = 'Swaps, edits, saves, and regenerations can become better future meal suggestions. Apply what looks right, or keep it for later.',
    onClose,
    onApply,
    onDismiss,
    onLater,
    onOpenPreferences,
    isApplying = false,
}: PreferenceLearningSheetProps) {
    if (!isOpen || !summary) {
        return null;
    }

    const hasSuggestions =
        summary.breakfastPreferences.length > 0
        || summary.lunchPreferences.length > 0
        || summary.dinnerPreferences.length > 0
        || summary.dislikes.length > 0;

    return (
        <div className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Guided Learning</p>
                        <h2 className="text-2xl font-bold mt-1">{title}</h2>
                        <p className="text-sm text-white/80 mt-2 max-w-xl">{description}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/15 rounded-full transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-900">
                        <div className="flex items-center gap-2 mb-2">
                            <Brain className="w-4 h-4" />
                            <span className="font-semibold">Pattern summary</span>
                        </div>
                        <p className="text-sm leading-6">{summary.summary}</p>
                        {(summary.positiveFocus.length > 0 || summary.negativeFocus.length > 0) && (
                            <div className="grid sm:grid-cols-2 gap-3 mt-4">
                                <SuggestionGroup
                                    icon={ThumbsUp}
                                    title="You keep choosing"
                                    items={summary.positiveFocus}
                                    color="border-emerald-200 bg-emerald-50 text-emerald-900"
                                />
                                <SuggestionGroup
                                    icon={ThumbsDown}
                                    title="You often move away from"
                                    items={summary.negativeFocus}
                                    color="border-orange-200 bg-orange-50 text-orange-900"
                                />
                            </div>
                        )}
                    </div>

                    {hasSuggestions ? (
                        <div className="grid gap-4">
                            <SuggestionGroup
                                icon={UtensilsCrossed}
                                title="Remember for breakfast"
                                items={summary.breakfastPreferences}
                                color="border-amber-200 bg-amber-50 text-amber-900"
                            />
                            <SuggestionGroup
                                icon={UtensilsCrossed}
                                title="Remember for lunch"
                                items={summary.lunchPreferences}
                                color="border-sky-200 bg-sky-50 text-sky-900"
                            />
                            <SuggestionGroup
                                icon={UtensilsCrossed}
                                title="Remember for dinner"
                                items={summary.dinnerPreferences}
                                color="border-violet-200 bg-violet-50 text-violet-900"
                            />
                            <SuggestionGroup
                                icon={ThumbsDown}
                                title="Avoid next time"
                                items={summary.dislikes}
                                color="border-rose-200 bg-rose-50 text-rose-900"
                            />
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                            <Sparkles className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
                            <h3 className="font-semibold text-gray-800">No durable changes needed yet</h3>
                            <p className="text-sm text-gray-500 mt-2">
                                Qook is still collecting soft learning from your actions. Keep swapping, editing, or saving recipes and it will get sharper.
                            </p>
                            {onOpenPreferences && (
                                <button
                                    onClick={onOpenPreferences}
                                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 transition-colors"
                                >
                                    Open full preferences
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-gray-500">
                        {summary.signalIds.length} signal{summary.signalIds.length === 1 ? '' : 's'} are ready to review.
                    </div>
                    <div className="flex items-center gap-3">
                        {onLater && (
                            <button
                                onClick={onLater}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                            >
                                <Clock3 className="w-4 h-4" />
                                Later
                            </button>
                        )}
                        <button
                            onClick={() => void onDismiss()}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={() => void onApply()}
                            disabled={isApplying || !hasSuggestions}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            {isApplying ? 'Applying...' : 'Apply to Preferences'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
