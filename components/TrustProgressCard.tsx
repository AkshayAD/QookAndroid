/**
 * Trust Progress Card Component
 * 
 * Displays the user's progress in earning trial credits through trust actions.
 * Shows completed actions with checkmarks and pending actions with prompts.
 */

import React, { useState, useEffect } from 'react';
import { Gift, Check, Phone, Calendar, Save, Smartphone, ChevronDown, ChevronUp, X } from 'lucide-react';
import { getTrustProgress, TrustProgress, TRUST_ACTION_LABELS, TRUST_ACTION_CREDITS, TrustActionType } from '../services/trustActions';
import { useAuth } from '../contexts/AuthContext';

interface TrustProgressCardProps {
    onAddPhone?: () => void;
    onInstallPWA?: () => void;
    className?: string;
    compact?: boolean;
}

const ACTION_ICONS: Record<TrustActionType, React.ReactNode> = {
    signup: <Gift className="w-4 h-4" />,
    complete_profile: <Check className="w-4 h-4" />,
    add_phone: <Phone className="w-4 h-4" />,
    return_24h: <Calendar className="w-4 h-4" />,
    first_manual_save: <Save className="w-4 h-4" />,
    install_pwa: <Smartphone className="w-4 h-4" />
};

export default function TrustProgressCard({
    onAddPhone,
    onInstallPWA,
    className = '',
    compact = false
}: TrustProgressCardProps) {
    const { user } = useAuth();
    const [progress, setProgress] = useState<TrustProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(!compact);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (user) {
            loadProgress();
        }
    }, [user]);

    async function loadProgress() {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getTrustProgress(user.id);
            setProgress(data);
        } catch (error) {
            console.error('Failed to load trust progress:', error);
        }
        setLoading(false);
    }

    // Don't show if all actions completed or dismissed
    if (dismissed || loading || !progress) return null;
    if (progress.pending.length === 0) return null;

    const completedCount = progress.completed.length;
    const totalCount = completedCount + progress.pending.length;
    const progressPercent = (completedCount / totalCount) * 100;

    if (compact && !expanded) {
        return (
            <div
                className={`bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200 rounded-lg p-3 cursor-pointer ${className}`}
                onClick={() => setExpanded(true)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-medium text-gray-700">
                            Unlock {progress.maxPossibleCredits - progress.totalCreditsEarned} more credits
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200 rounded-xl p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold text-gray-800">Unlock Free Credits</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                        {progress.totalCreditsEarned}/{progress.maxPossibleCredits}
                    </span>
                    {compact && (
                        <button onClick={() => setExpanded(false)}>
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Action list */}
            <div className="space-y-2">
                {/* Completed actions */}
                {progress.completed.map(action => (
                    <div
                        key={action.action_type}
                        className="flex items-center justify-between p-2 bg-green-50 rounded-lg"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm text-gray-600 line-through">
                                {TRUST_ACTION_LABELS[action.action_type as TrustActionType]}
                            </span>
                        </div>
                        <span className="text-sm font-medium text-green-600">
                            +{action.credits_awarded} ✓
                        </span>
                    </div>
                ))}

                {/* Pending actions */}
                {progress.pending.map(action => (
                    <div
                        key={action}
                        className="flex items-center justify-between p-2 bg-white/50 rounded-lg border border-dashed border-orange-200"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                {ACTION_ICONS[action]}
                            </div>
                            <span className="text-sm text-gray-700">
                                {TRUST_ACTION_LABELS[action]}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-orange-600">
                                +{TRUST_ACTION_CREDITS[action]}
                            </span>
                            {action === 'add_phone' && onAddPhone && (
                                <button
                                    onClick={onAddPhone}
                                    className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                                >
                                    Add
                                </button>
                            )}
                            {action === 'install_pwa' && onInstallPWA && (
                                <button
                                    onClick={onInstallPWA}
                                    className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                                >
                                    Install
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
