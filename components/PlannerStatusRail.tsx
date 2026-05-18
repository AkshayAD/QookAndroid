import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronDown, ChevronUp, Gift, Phone, Save, Sparkles, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ACTIVE_TRUST_ACTIONS, getTrustProgress, TRUST_ACTION_CREDITS, TRUST_ACTION_LABELS, type TrustActionType, type TrustProgress } from '../services/trustActions';

interface PlannerStatusRailProps {
    onShowPricing?: () => void;
    onAddPhone?: () => void;
    className?: string;
}

const DISMISS_KEY = 'qookcommander_planner_status_rail_dismissed_v1';

const ACTION_ICONS: Record<TrustActionType, React.ReactNode> = {
    signup: <Gift className="w-3.5 h-3.5" />,
    complete_profile: <CheckCircle2 className="w-3.5 h-3.5" />,
    add_phone: <Phone className="w-3.5 h-3.5" />,
    generate_second_menu: <Calendar className="w-3.5 h-3.5" />,
    share_menu_commands: <Save className="w-3.5 h-3.5" />,
    install_pwa: <Gift className="w-3.5 h-3.5" />,
};

export default function PlannerStatusRail({
    onShowPricing,
    onAddPhone,
    className = '',
}: PlannerStatusRailProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { subscription, credits, plans, isTrialActive } = useSubscription();
    const [progress, setProgress] = useState<TrustProgress | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const loadProgress = useCallback(async () => {
        if (!user?.id) {
            setProgress(null);
            return;
        }

        try {
            const nextProgress = await getTrustProgress(user.id);
            setProgress(nextProgress);
        } catch (error) {
            console.error('Failed to load planner trust progress:', error);
        }
    }, [user?.id]);

    useEffect(() => {
        void loadProgress();
    }, [loadProgress]);

    useEffect(() => {
        const handleTrustUpdate = () => {
            void loadProgress();
        };

        window.addEventListener('trust-actions-updated', handleTrustUpdate);
        return () => window.removeEventListener('trust-actions-updated', handleTrustUpdate);
    }, [loadProgress]);

    const currentPlan = plans.find((plan) => plan.id === subscription?.plan_id);
    const planId = subscription?.plan_id || 'free';
    const totalCredits = credits?.total_meal_credits || 0;
    const remainingCredits = progress
        ? Math.max(0, progress.maxPossibleCredits - progress.totalCreditsEarned)
        : ACTIVE_TRUST_ACTIONS.reduce((sum, action) => sum + TRUST_ACTION_CREDITS[action], 0);
    const pendingActions = progress?.pending || [];
    const completedCount = progress?.completed.length || 0;
    const canExpand = pendingActions.length > 0;

    const railStateKey = useMemo(() => (
        JSON.stringify({
            planId,
            isTrialActive,
            pending: pendingActions,
            remainingCredits,
        })
    ), [planId, isTrialActive, pendingActions, remainingCredits]);

    useEffect(() => {
        try {
            const storedState = window.localStorage.getItem(DISMISS_KEY);
            setDismissed(storedState === railStateKey);
            if (storedState !== railStateKey) {
                setExpanded(false);
            }
        } catch {
            setDismissed(false);
        }
    }, [railStateKey]);

    if (dismissed) {
        return null;
    }

    const statusSummary = canExpand
        ? `${pendingActions.length} trust step${pendingActions.length === 1 ? '' : 's'} left for +${remainingCredits}`
        : isTrialActive
            ? `${currentPlan?.name || 'Free Trial'} active`
            : 'Credits ready to use';

    const ctaLabel = planId === 'free'
        ? 'Upgrade'
        : planId === 'basic' || planId === 'pro'
            ? 'Buy credits'
            : 'Manage';

    const openPricing = () => {
        if (onShowPricing) {
            onShowPricing();
            return;
        }

        navigate('/plan');
    };

    const handleDismiss = (event: React.MouseEvent) => {
        event.stopPropagation();
        try {
            window.localStorage.setItem(DISMISS_KEY, railStateKey);
        } catch {
            // Ignore storage errors and just dismiss for this session.
        }
        setDismissed(true);
        setExpanded(false);
    };

    return (
        <div className={`relative z-20 md:hidden ${className}`}>
            <div
                className={`overflow-visible rounded-xl border border-orange-200/80 bg-white/95 shadow-sm transition-all ${canExpand ? 'cursor-pointer' : ''}`}
                onClick={() => {
                    if (canExpand) {
                        setExpanded((current) => !current);
                    }
                }}
            >
                <div className="grid min-h-12 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 px-3 py-2">
                    <div className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                        <Sparkles className="w-3.5 h-3.5" />
                        {totalCredits}
                    </div>
                    <div className="inline-flex flex-shrink-0 items-center rounded-full bg-gray-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                        {planId}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-gray-700">{statusSummary}</p>
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            openPricing();
                        }}
                        className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-orange-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        {ctaLabel}
                    </button>
                    {canExpand && (
                        <div className="flex-shrink-0 text-gray-400">
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="touch-target -mr-1 flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        aria-label="Dismiss planner status rail"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {expanded && progress && (
                <div className="mt-2 rounded-2xl border border-orange-200 bg-white px-3 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Free credits checklist</p>
                            <p className="text-xs text-gray-500">
                                {completedCount}/{completedCount + pendingActions.length} actions completed
                            </p>
                        </div>
                        <div className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            +{remainingCredits} left
                        </div>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-orange-100">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-300"
                            style={{ width: `${((completedCount / Math.max(1, completedCount + pendingActions.length)) * 100).toFixed(1)}%` }}
                        />
                    </div>

                    <div className="mt-3 space-y-2">
                        {pendingActions.map((action) => (
                            <div
                                key={action}
                                className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm">
                                        {ACTION_ICONS[action]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-gray-900">
                                            {TRUST_ACTION_LABELS[action]}
                                        </p>
                                        <p className="text-[11px] text-gray-500">Earn +{TRUST_ACTION_CREDITS[action]} credits</p>
                                    </div>
                                </div>
                                {action === 'add_phone' && onAddPhone ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onAddPhone();
                                        }}
                                        className="rounded-full bg-orange-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                ) : (
                                    <div className="text-xs font-semibold text-orange-600">
                                        +{TRUST_ACTION_CREDITS[action]}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
