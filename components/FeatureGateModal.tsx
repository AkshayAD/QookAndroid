/**
 * Feature Gate Modal
 * 
 * Shows a modal when a user tries to access a locked feature.
 * Displays upgrade options based on the required tier.
 */

import React from 'react';
import { Lock, X, Crown, Zap, Users, ArrowRight } from 'lucide-react';
import { Feature, FEATURE_DESCRIPTIONS, getUpgradeText } from '../hooks/useFeatureGate';

interface FeatureGateModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature: Feature;
    onUpgrade?: () => void;
}

export default function FeatureGateModal({
    isOpen,
    onClose,
    feature,
    onUpgrade
}: FeatureGateModalProps) {
    if (!isOpen) return null;

    const featureInfo = FEATURE_DESCRIPTIONS[feature];

    const getTierIcon = (tier: string) => {
        switch (tier) {
            case 'Standard':
                return <Zap className="w-6 h-6" />;
            case 'Pro':
                return <Crown className="w-6 h-6" />;
            case 'Family Pro':
                return <Users className="w-6 h-6" />;
            default:
                return <Lock className="w-6 h-6" />;
        }
    };

    const getTierGradient = (tier: string) => {
        switch (tier) {
            case 'Standard':
                return 'from-blue-500 to-indigo-600';
            case 'Pro':
                return 'from-orange-500 to-red-600';
            case 'Family Pro':
                return 'from-pink-500 to-rose-600';
            default:
                return 'from-gray-500 to-gray-600';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
                {/* Header with gradient */}
                <div className={`bg-gradient-to-r ${getTierGradient(featureInfo.requiredTier)} p-6 text-white relative`}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Lock className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{featureInfo.name}</h2>
                            <p className="text-sm text-white/80">
                                {featureInfo.requiredTier} feature
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 mb-6">
                        {featureInfo.description}
                    </p>

                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 bg-gradient-to-br ${getTierGradient(featureInfo.requiredTier)} rounded-lg flex items-center justify-center text-white`}>
                                {getTierIcon(featureInfo.requiredTier)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">{featureInfo.requiredTier}</p>
                                <p className="text-xs text-gray-500">Required to unlock</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            Upgrade to {featureInfo.requiredTier} to access {featureInfo.name.toLowerCase()} and other premium features.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                        >
                            Maybe Later
                        </button>
                        <button
                            onClick={() => {
                                onUpgrade?.();
                                onClose();
                            }}
                            className={`flex-1 px-4 py-3 bg-gradient-to-r ${getTierGradient(featureInfo.requiredTier)} text-white rounded-xl font-medium hover:shadow-lg flex items-center justify-center gap-2`}
                        >
                            <span>Upgrade</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Inline Feature Lock Badge
 * Shows a small lock indicator on locked features
 */
interface FeatureLockBadgeProps {
    feature: Feature;
    className?: string;
}

export function FeatureLockBadge({ feature, className = '' }: FeatureLockBadgeProps) {
    const featureInfo = FEATURE_DESCRIPTIONS[feature];

    return (
        <span
            className={`inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ${className}`}
            title={`Requires ${featureInfo.requiredTier}`}
        >
            <Lock className="w-3 h-3" />
            {featureInfo.requiredTier}
        </span>
    );
}

/**
 * Feature Gate Wrapper
 * Wraps any element and shows lock state if feature is gated
 */
interface FeatureGateWrapperProps {
    feature: Feature;
    allowed: boolean;
    children: React.ReactNode;
    onLockedClick?: () => void;
    showBadge?: boolean;
    className?: string;
}

export function FeatureGateWrapper({
    feature,
    allowed,
    children,
    onLockedClick,
    showBadge = true,
    className = ''
}: FeatureGateWrapperProps) {
    if (allowed) {
        return <>{children}</>;
    }

    return (
        <div
            className={`relative opacity-60 cursor-not-allowed ${className}`}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLockedClick?.();
            }}
        >
            <div className="pointer-events-none">
                {children}
            </div>
            {showBadge && (
                <div className="absolute top-1 right-1">
                    <FeatureLockBadge feature={feature} />
                </div>
            )}
        </div>
    );
}
