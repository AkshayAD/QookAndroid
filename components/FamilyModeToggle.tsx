/**
 * FamilyModeToggle Component
 * A toggle switch for users to switch between Personal and Family Mode
 * Only visible when user belongs to a family group
 * Gated to Family Pro tier only
 */

import React, { useState } from 'react';
import { User, Users, Lock } from 'lucide-react';
import { useFamily } from '../contexts/FamilyContext';
import { useFeatureGate } from '../hooks/useFeatureGate';
import FeatureGateModal from './FeatureGateModal';

interface FamilyModeToggleProps {
    className?: string;
    compact?: boolean;  // For header placement
}

export default function FamilyModeToggle({ className = '', compact = false }: FamilyModeToggleProps) {
    const { isInFamily, isFamilyModeActive, toggleFamilyMode, familyGroup, loading } = useFamily();
    const { canAccess, getFeatureGate } = useFeatureGate();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const hasFamilyModeAccess = canAccess('family_mode');

    // Don't render if not in a family
    if (!isInFamily || loading) {
        return null;
    }

    // Handle button click - show upgrade modal if no access
    const handleFamilyClick = () => {
        if (!hasFamilyModeAccess) {
            setShowUpgradeModal(true);
        } else if (!isFamilyModeActive) {
            toggleFamilyMode();
        }
    };

    const handlePersonalClick = () => {
        if (isFamilyModeActive) {
            toggleFamilyMode();
        }
    };

    if (compact) {
        // Elegant iOS-style pill toggle
        return (
            <>
                <div className={`flex items-center ${className}`}>
                    <div className="relative flex items-center bg-gray-100 rounded-full p-0.5 shadow-inner">
                        {/* Sliding indicator */}
                        <div
                            className={`absolute top-0.5 bottom-0.5 w-1/2 rounded-full transition-all duration-300 ease-out ${isFamilyModeActive && hasFamilyModeAccess
                                ? 'translate-x-full bg-gradient-to-r from-purple-500 to-violet-500 shadow-md'
                                : 'translate-x-0 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md'
                                }`}
                        />
                        {/* Personal */}
                        <button
                            onClick={handlePersonalClick}
                            className={`relative z-10 flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${!isFamilyModeActive ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <User className="w-3 h-3" />
                            <span className="hidden sm:inline">Personal</span>
                        </button>
                        {/* Family */}
                        <button
                            onClick={handleFamilyClick}
                            className={`relative z-10 flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${isFamilyModeActive && hasFamilyModeAccess ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {!hasFamilyModeAccess ? (
                                <Lock className="w-3 h-3 text-amber-500" />
                            ) : (
                                <Users className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">Family</span>
                        </button>
                    </div>
                </div>
                {showUpgradeModal && (
                    <FeatureGateModal
                        isOpen={showUpgradeModal}
                        feature="family_mode"
                        onClose={() => setShowUpgradeModal(false)}
                    />
                )}
            </>
        );
    }

    // Full toggle with labels
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <button
                onClick={() => !isFamilyModeActive || toggleFamilyMode()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${!isFamilyModeActive
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
            >
                <User className="w-4 h-4" />
                <span className="font-medium text-sm">Personal</span>
            </button>

            <button
                onClick={() => isFamilyModeActive || toggleFamilyMode()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${isFamilyModeActive
                    ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
            >
                <Users className="w-4 h-4" />
                <span className="font-medium text-sm">{familyGroup?.name || 'Family'}</span>
            </button>
        </div>
    );
}

/**
 * Inline mode indicator (no toggle, just shows current mode)
 */
export function FamilyModeIndicator({ className = '' }: { className?: string }) {
    const { isInFamily, isFamilyModeActive, familyGroup } = useFamily();

    if (!isInFamily) {
        return null;
    }

    return (
        <div className={`flex items-center gap-1.5 text-xs ${className}`}>
            {isFamilyModeActive ? (
                <>
                    <Users className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-orange-600 font-medium">
                        {familyGroup?.name || 'Family'} Mode
                    </span>
                </>
            ) : (
                <>
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-blue-600 font-medium">Personal Mode</span>
                </>
            )}
        </div>
    );
}
