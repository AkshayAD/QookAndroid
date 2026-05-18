import React from 'react';
import { ChevronDown, RefreshCw, Share2, Heart } from 'lucide-react';

interface PlannerActionStripProps {
    currentProfileId: string;
    profiles: Array<{ id: string; name: string }>;
    hasVisibleWeekMeals: boolean;
    loading: boolean;
    onProfileChange: (profileId: string) => void;
    onGeneratePlan: () => void;
    onOpenSavedRecipes: () => void;
    onShare?: () => void;
}

export default function PlannerActionStrip({
    currentProfileId,
    profiles,
    hasVisibleWeekMeals,
    loading,
    onProfileChange,
    onGeneratePlan,
    onOpenSavedRecipes,
    onShare,
}: PlannerActionStripProps) {
    return (
        <div className="md:hidden">
            <div className="grid gap-2">
                <div className="relative">
                    <select
                        value={currentProfileId}
                        onChange={(event) => onProfileChange(event.target.value)}
                        className="w-full appearance-none rounded-full border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-gray-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        title="Switch meal profile"
                    >
                        {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                                {profile.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <ActionPill
                        icon={RefreshCw}
                        label={hasVisibleWeekMeals ? 'Regenerate' : 'Generate'}
                        emphasis
                        loading={loading}
                        onClick={onGeneratePlan}
                    />
                    <ActionPill icon={Heart} label="Recipes" onClick={onOpenSavedRecipes} />
                    {onShare && (
                        <ActionPill icon={Share2} label="Share" iconOnly onClick={onShare} />
                    )}
                </div>
            </div>
        </div>
    );
}

function ActionPill({
    icon: Icon,
    label,
    onClick,
    disabled = false,
    emphasis = false,
    loading = false,
    iconOnly = false,
}: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    emphasis?: boolean;
    loading?: boolean;
    iconOnly?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            title={iconOnly ? `${label} plan` : undefined}
            aria-label={iconOnly ? `${label} plan` : undefined}
            className={`touch-target inline-flex flex-shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors ${iconOnly ? 'h-9 w-9 px-0 py-0' : 'gap-1.5 px-3 py-1.5'} ${emphasis
                ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                } ${disabled ? 'opacity-50' : ''}`}
        >
            <Icon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {!iconOnly && label}
        </button>
    );
}
