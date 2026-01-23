import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, MousePointer2 } from 'lucide-react';

interface TourStep {
    id: string;
    title: string;
    description: string;
    targetSelector?: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    type: 'info' | 'click' | 'action';
    triggerAction?: string;
    highlightPadding?: number;
    autoAction?: string; // Action to trigger when entering this step
}

const TOUR_STEPS: TourStep[] = [
    // Welcome
    {
        id: 'welcome',
        title: "Welcome to Qook! 👋",
        description: "Let's walk through all the features. You'll set up your preferences and learn the entire app in about 3 minutes.",
        position: 'center',
        type: 'info'
    },
    // Preferences Section
    {
        id: 'profile-selector',
        title: "1. Profile Selector",
        description: "Switch between meal profiles for different family members. Each profile has its own preferences and meal plans.",
        targetSelector: '[data-tour="profile-selector"]',
        position: 'bottom',
        type: 'info',
        autoAction: 'switch-to-plan'
    },
    {
        id: 'preferences-button',
        title: "2. Open Preferences",
        description: "Click the settings icon to customize your dietary preferences, allergies, dislikes, and favorite cuisines.",
        targetSelector: '[data-tour="preferences-button"]',
        position: 'bottom',
        type: 'click',
        triggerAction: 'open-preferences'
    },
    {
        id: 'dietary-type',
        title: "3. Dietary Type",
        description: "Select your dietary preference: Vegetarian, Vegan, Eggetarian, Non-Veg, or Jain. This affects all meal suggestions.",
        targetSelector: '[data-tour="dietary-type"]',
        position: 'right',
        type: 'info',
        highlightPadding: 8,
        autoAction: 'open-preferences'
    },
    {
        id: 'dislikes-input',
        title: "4. Dislikes",
        description: "Add foods you don't like (e.g., 'bitter gourd, brinjal'). AI will never suggest these ingredients.",
        targetSelector: '[data-tour="dislikes-input"]',
        position: 'right',
        type: 'info'
    },
    {
        id: 'save-preferences',
        title: "5. Save Preferences",
        description: "Click Save to store your preferences. They'll be used for all future meal plan generations.",
        targetSelector: '[data-tour="save-preferences"]',
        position: 'top',
        type: 'click',
        triggerAction: 'save-preferences'
    },
    // Generate Section
    {
        id: 'generate-button',
        title: "6. Generate Plan",
        description: "Click this button to generate a complete 7-day meal plan based on your preferences!",
        targetSelector: '[data-tour="generate-button"]',
        position: 'bottom',
        type: 'click',
        triggerAction: 'generate-plan',
        autoAction: 'close-preferences'
    },
    {
        id: 'meal-cards',
        title: "7. Your Meal Plan",
        description: "Here's a sample plan! Each card shows one day with breakfast, lunch, and dinner. Scroll to see all 7 days.",
        targetSelector: '[data-tour="meal-card"]',
        position: 'right',
        type: 'info',
        autoAction: 'load-demo-plan'
    },
    // Quick Actions
    {
        id: 'regenerate-meal',
        title: "8. Regenerate Any Meal",
        description: "Click the refresh icon on any meal to regenerate just that one. Great for quick fixes!",
        targetSelector: '[data-tour="meal-regenerate"]',
        position: 'left',
        type: 'info'
    },
    {
        id: 'smart-edit',
        title: "9. Smart Edit ✨",
        description: "Click Edit with AI for bulk edits. Say 'make all dinners lighter' and AI updates multiple meals at once!",
        targetSelector: '[data-tour="smart-edit"]',
        position: 'left',
        type: 'info'
    },
    // Calendar/Schedule Section
    {
        id: 'calendar-tab',
        title: "10. Schedule Tab",
        description: "Click this tab to see your meal calendar. View past meals, schedule future ones, and track your meal history.",
        targetSelector: '[data-tour="calendar-tab-desktop"], [data-tour="calendar-tab-mobile"]',
        position: 'bottom',
        type: 'info',
        highlightPadding: 4,
        autoAction: 'switch-to-calendar'
    },
    // Grocery Section
    {
        id: 'grocery-tab',
        title: "11. Grocery Tab",
        description: "Click this tab to access your grocery management. Generate shopping lists from your meal plans!",
        targetSelector: '[data-tour="grocery-tab-desktop"], [data-tour="grocery-tab-mobile"]',
        position: 'bottom',
        type: 'info',
        highlightPadding: 4,
        autoAction: 'switch-to-grocery'
    },
    {
        id: 'generate-grocery',
        title: "12. Generate Grocery List",
        description: "Use the 'Generate List' button to create a shopping list from your scheduled meals!",
        targetSelector: '[data-tour="generate-grocery-button"]',
        position: 'top',
        type: 'info',
        highlightPadding: 4,
        autoAction: 'load-demo-grocery'
    },
    // Complete
    {
        id: 'complete',
        title: "You're All Set! 🎉",
        description: "You've learned all the key features! Start planning your meals and enjoy stress-free cooking. Restart tour anytime from the menu.",
        position: 'center',
        type: 'info'
    }
];

interface OnboardingTourProps {
    onComplete: () => void;
    forceShow?: boolean;
    onTriggerAction?: (action: string) => void;
    currentAction?: string;
}

export default function OnboardingTour({
    onComplete,
    forceShow = false,
    onTriggerAction,
    currentAction
}: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const step = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;
    const isFirstStep = currentStep === 0;
    const isCenterStep = step.position === 'center';
    const isMobile = windowSize.width < 768;

    // Update window size
    useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Update target element position
    const updateTargetRect = useCallback(() => {
        if (step.targetSelector) {
            const target = document.querySelector(step.targetSelector);
            if (target) {
                const rect = target.getBoundingClientRect();
                setTargetRect(rect);
                // Scroll into view if needed
                const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
                if (!isInView) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                setTargetRect(null);
            }
        } else {
            setTargetRect(null);
        }
    }, [step.targetSelector]);

    useEffect(() => {
        updateTargetRect();
        // Re-check position periodically for dynamic elements
        const interval = setInterval(updateTargetRect, 500);
        return () => clearInterval(interval);
    }, [currentStep, updateTargetRect]);

    // Handle action completion from parent
    useEffect(() => {
        if (currentAction && step.triggerAction === currentAction) {
            // Action completed, advance to next step
            handleNext();
        }
    }, [currentAction, step.triggerAction]);

    // Trigger autoAction when entering a step
    useEffect(() => {
        if (step.autoAction && onTriggerAction) {
            // Small delay to ensure UI is ready
            const timer = setTimeout(() => {
                onTriggerAction(step.autoAction!);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [currentStep, step.autoAction, onTriggerAction]);

    const handleNext = () => {
        if (isLastStep) {
            handleComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        setIsExiting(true);
        if (!forceShow) {
            localStorage.setItem('qook_tour_completed', 'true');
        }
        setTimeout(() => onComplete(), 300);
    };

    const handleSkip = () => {
        // Restore user's original data if demo was loaded
        if (onTriggerAction) {
            onTriggerAction('clear-demo');
        }
        if (!forceShow) {
            localStorage.setItem('qook_tour_completed', 'true');
        }
        onComplete();
    };

    // Calculate tooltip position based on target and screen space
    const getTooltipStyle = (): React.CSSProperties => {
        const tooltipWidth = isMobile ? Math.min(280, windowSize.width - 32) : 320;
        const tooltipHeight = 180; // Increased for button visibility
        const padding = 16;
        const arrowSize = 12;

        if (isCenterStep || !targetRect) {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: tooltipWidth,
                maxHeight: windowSize.height - 40,
                overflowY: 'auto',
            };
        }

        const spotPadding = step.highlightPadding || 8;
        let top: number | undefined;
        let left: number | undefined;
        let bottom: number | undefined;
        let right: number | undefined;

        // On mobile, prefer positioning below or above with full width
        if (isMobile) {
            // Calculate if there's more space above or below
            const spaceBelow = windowSize.height - targetRect.bottom - spotPadding;
            const spaceAbove = targetRect.top - spotPadding;

            if (spaceBelow >= tooltipHeight + arrowSize + 20) {
                // Position below
                top = targetRect.bottom + spotPadding + arrowSize + 4;
            } else if (spaceAbove >= tooltipHeight + arrowSize + 20) {
                // Position above
                top = Math.max(padding, targetRect.top - tooltipHeight - arrowSize - spotPadding - 4);
            } else {
                // Center vertically if neither fits
                top = Math.max(padding, (windowSize.height - tooltipHeight) / 2);
            }

            // Center horizontally
            left = Math.max(padding, (windowSize.width - tooltipWidth) / 2);

            // Ensure tooltip doesn't go below viewport
            if (top + tooltipHeight > windowSize.height - padding) {
                top = windowSize.height - tooltipHeight - padding;
            }
        } else {
            // Desktop positioning
            switch (step.position) {
                case 'bottom':
                    top = targetRect.bottom + spotPadding + arrowSize + 4;
                    left = Math.max(padding, Math.min(
                        windowSize.width - tooltipWidth - padding,
                        targetRect.left + targetRect.width / 2 - tooltipWidth / 2
                    ));
                    break;
                case 'top':
                    bottom = windowSize.height - targetRect.top + spotPadding + arrowSize + 4;
                    left = Math.max(padding, Math.min(
                        windowSize.width - tooltipWidth - padding,
                        targetRect.left + targetRect.width / 2 - tooltipWidth / 2
                    ));
                    break;
                case 'left':
                    top = Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
                    right = windowSize.width - targetRect.left + spotPadding + arrowSize + 4;
                    break;
                case 'right':
                    top = Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
                    left = targetRect.right + spotPadding + arrowSize + 4;
                    break;
            }

            // Ensure tooltip doesn't go below viewport on desktop too
            if (top !== undefined && top + tooltipHeight > windowSize.height - padding) {
                top = windowSize.height - tooltipHeight - padding;
            }
        }

        // Final clamping - ensure tooltip never goes off-screen
        if (left !== undefined) {
            left = Math.max(padding, Math.min(left, windowSize.width - tooltipWidth - padding));
        }
        if (top !== undefined) {
            top = Math.max(padding, Math.min(top, windowSize.height - tooltipHeight - padding));
        }

        return {
            position: 'fixed',
            top: top !== undefined ? `${top}px` : undefined,
            bottom: bottom !== undefined ? `${bottom}px` : undefined,
            left: left !== undefined ? `${left}px` : undefined,
            right: right !== undefined ? `${right}px` : undefined,
            width: tooltipWidth,
            maxHeight: windowSize.height - 40,
            overflowY: 'auto',
        };
    };

    const spotPadding = step.highlightPadding || 8;

    return (
        <div className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            {/* Overlay with spotlight cutout */}
            <div className="absolute inset-0 pointer-events-none">
                {targetRect && !isCenterStep ? (
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                        <defs>
                            <mask id="spotlight-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                <rect
                                    x={targetRect.left - spotPadding}
                                    y={targetRect.top - spotPadding}
                                    width={targetRect.width + spotPadding * 2}
                                    height={targetRect.height + spotPadding * 2}
                                    rx="8"
                                    fill="black"
                                />
                            </mask>
                        </defs>
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="rgba(0,0,0,0.6)"
                            mask="url(#spotlight-mask)"
                            style={{ pointerEvents: 'auto' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </svg>
                ) : (
                    <div
                        className="absolute inset-0 bg-black/60"
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>

            {/* Spotlight border */}
            {targetRect && !isCenterStep && (
                <div
                    className="absolute rounded-lg pointer-events-none"
                    style={{
                        left: targetRect.left - spotPadding,
                        top: targetRect.top - spotPadding,
                        width: targetRect.width + spotPadding * 2,
                        height: targetRect.height + spotPadding * 2,
                        border: '2px solid rgba(251, 146, 60, 0.8)',
                        boxShadow: '0 0 0 2px rgba(251, 146, 60, 0.3), 0 0 20px rgba(251, 146, 60, 0.4)',
                        animation: 'pulse 2s ease-in-out infinite',
                    }}
                />
            )}

            {/* Arrow pointer */}
            {targetRect && !isCenterStep && (
                <div
                    className="absolute"
                    style={{
                        left: step.position === 'left' ? targetRect.left - 28 :
                            step.position === 'right' ? targetRect.right + 8 :
                                targetRect.left + targetRect.width / 2 - 10,
                        top: step.position === 'top' ? targetRect.top - 28 :
                            step.position === 'bottom' ? targetRect.bottom + 8 :
                                targetRect.top + targetRect.height / 2 - 10,
                    }}
                >
                    <MousePointer2
                        className="w-5 h-5 text-orange-400 animate-bounce"
                        style={{
                            transform: step.position === 'top' ? 'rotate(180deg)' :
                                step.position === 'left' ? 'rotate(90deg)' :
                                    step.position === 'right' ? 'rotate(-90deg)' : 'none'
                        }}
                    />
                </div>
            )}

            {/* Spotlight area - clicks pass through to actual element */}
            {/* No blocking div - users can interact with highlighted elements */}

            {/* Tooltip */}
            <div
                className={`bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                    }`}
                style={getTooltipStyle()}
            >
                {/* Header */}
                <div className={`px-4 py-3 ${isCenterStep ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' : 'bg-orange-50 border-b border-orange-100'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isCenterStep && <Sparkles className="w-4 h-4" />}
                            <h3 className={`font-semibold text-sm ${isCenterStep ? 'text-white' : 'text-gray-900'}`}>
                                {step.title}
                            </h3>
                        </div>
                        <button
                            onClick={handleSkip}
                            className={`p-1 rounded hover:bg-black/10 ${isCenterStep ? 'text-white/80' : 'text-gray-400'}`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">{step.description}</p>

                    {/* Progress */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-1">
                            {TOUR_STEPS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1 rounded-full transition-all ${idx === currentStep ? 'w-3 bg-orange-500' :
                                        idx < currentStep ? 'w-1.5 bg-orange-300' : 'w-1.5 bg-gray-200'
                                        }`}
                                />
                            ))}
                        </div>
                        <span className="text-xs text-gray-400">{currentStep + 1}/{TOUR_STEPS.length}</span>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-2">
                        {!isFirstStep && (
                            <button
                                onClick={handlePrev}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                            >
                                <ArrowLeft className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 flex items-center justify-center gap-1"
                        >
                            {isLastStep ? 'Done!' : 'Next'}
                            {!isLastStep && <ArrowRight className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
}

export function shouldShowTour(): boolean {
    return localStorage.getItem('qook_tour_completed') !== 'true';
}

export function resetTour(): void {
    localStorage.removeItem('qook_tour_completed');
}
