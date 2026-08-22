import React, { useState, useEffect } from 'react';

export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    targetId?: string; // DOM element ID to highlight
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: string;
    requireClick?: boolean; // hide Next — user MUST click the target element to proceed
}

interface OnboardingTutorialProps {
    steps: TutorialStep[];
    onComplete: () => void;
    storageKey: string;
    onStepChange?: (stepIndex: number) => void; // called when step changes (e.g. open sidebar)
}

const HIGHLIGHT_PADDING = 8;

function getTargetRect(targetId?: string): DOMRect | null {
    if (!targetId) return null;
    // Use querySelectorAll to handle cases where the same id appears in both
    // mobile and desktop sidebars — pick the one actually visible in viewport
    const elements = Array.from(document.querySelectorAll<HTMLElement>(`#${targetId}`));
    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        ) {
            return rect;
        }
    }
    // Fallback: return the first non-zero rect even if partially offscreen
    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return rect;
    }
    return null;
}

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ steps, onComplete, storageKey, onStepChange }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [visible, setVisible] = useState(false);

    const step = steps[currentStep];

    // notify parent when step changes (e.g. to open sidebar)
    useEffect(() => {
        onStepChange?.(currentStep);
    }, [currentStep]);

    // on step change, find and highlight target element (with delay to let parent respond)
    useEffect(() => {
        const t = setTimeout(() => {
            const rect = getTargetRect(step?.targetId);
            setTargetRect(rect);
            if (step?.targetId) {
                const el = document.getElementById(step.targetId);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 650); // wait for sidebar animation (300ms) + React render
        return () => clearTimeout(t);
    }, [currentStep, step?.targetId]);

    // entrance animation
    useEffect(() => {
        setVisible(false);
        const t = setTimeout(() => setVisible(true), 80);
        return () => clearTimeout(t);
    }, [currentStep]);

    // For requireClick steps: listen for a click on the target element (all matching, mobile+desktop)
    useEffect(() => {
        if (!step?.requireClick || !step.targetId) return;
        const elements = Array.from(document.querySelectorAll<HTMLElement>(`#${step.targetId}`));
        if (elements.length === 0) return;

        const handleTargetClick = () => {
            // advance or complete after tiny delay so navigation can start first
            setTimeout(() => handleNext(), 150);
        };

        elements.forEach(el => el.addEventListener('click', handleTargetClick, { once: true }));
        return () => elements.forEach(el => el.removeEventListener('click', handleTargetClick));
    }, [currentStep, step?.requireClick, step?.targetId]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(s => s + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        localStorage.setItem(storageKey, 'done');
        onComplete();
    };

    if (steps.length === 0) return null;

    const isLastStep = currentStep === steps.length - 1;
    const isRequireClick = !!step?.requireClick;

    const overlayStyle: React.CSSProperties = targetRect
        ? {
            clipPath: `polygon(
          0% 0%, 100% 0%, 100% 100%, 0% 100%,
          0% ${targetRect.top - HIGHLIGHT_PADDING}px,
          ${targetRect.left - HIGHLIGHT_PADDING}px ${targetRect.top - HIGHLIGHT_PADDING}px,
          ${targetRect.left - HIGHLIGHT_PADDING}px ${targetRect.bottom + HIGHLIGHT_PADDING}px,
          ${targetRect.right + HIGHLIGHT_PADDING}px ${targetRect.bottom + HIGHLIGHT_PADDING}px,
          ${targetRect.right + HIGHLIGHT_PADDING}px ${targetRect.top - HIGHLIGHT_PADDING}px,
          0% ${targetRect.top - HIGHLIGHT_PADDING}px
        )`,
        }
        : {};

    // tooltip placement
    let tooltipStyle: React.CSSProperties = {};
    const tooltipPos = step?.position ?? (targetRect ? 'bottom' : 'center');

    if (!targetRect || tooltipPos === 'center') {
        tooltipStyle = {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
        };
    } else {
        const PAD = 20;
        const TIP_W = 340;
        const TIP_H = 280;

        switch (tooltipPos) {
            case 'bottom':
                tooltipStyle = {
                    position: 'fixed',
                    top: Math.min(targetRect.bottom + HIGHLIGHT_PADDING + PAD, window.innerHeight - TIP_H - PAD),
                    left: Math.min(Math.max(targetRect.left, PAD), window.innerWidth - TIP_W - PAD),
                };
                break;
            case 'top':
                tooltipStyle = {
                    position: 'fixed',
                    bottom: window.innerHeight - targetRect.top + HIGHLIGHT_PADDING + PAD,
                    left: Math.min(Math.max(targetRect.left, PAD), window.innerWidth - TIP_W - PAD),
                };
                break;
            case 'right':
                tooltipStyle = {
                    position: 'fixed',
                    top: Math.max(targetRect.top, PAD),
                    left: targetRect.right + HIGHLIGHT_PADDING + PAD,
                };
                break;
            case 'left':
                tooltipStyle = {
                    position: 'fixed',
                    top: Math.max(targetRect.top, PAD),
                    right: window.innerWidth - targetRect.left + HIGHLIGHT_PADDING + PAD,
                };
                break;
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* 4-quadrant overlay — leaves spotlight area open for real clicks */}
            {targetRect ? (
                <>
                    {/* Top */}
                    <div className="absolute bg-black/60 pointer-events-auto left-0 right-0 top-0"
                        style={{ height: Math.max(0, targetRect.top - HIGHLIGHT_PADDING) }}
                        onClick={isRequireClick ? undefined : handleNext} />
                    {/* Bottom */}
                    <div className="absolute bg-black/60 pointer-events-auto left-0 right-0 bottom-0"
                        style={{ top: targetRect.bottom + HIGHLIGHT_PADDING }}
                        onClick={isRequireClick ? undefined : handleNext} />
                    {/* Left */}
                    <div className="absolute bg-black/60 pointer-events-auto top-0 bottom-0 left-0"
                        style={{
                            top: Math.max(0, targetRect.top - HIGHLIGHT_PADDING),
                            bottom: `calc(100% - ${targetRect.bottom + HIGHLIGHT_PADDING}px)`,
                            width: Math.max(0, targetRect.left - HIGHLIGHT_PADDING),
                        }}
                        onClick={isRequireClick ? undefined : handleNext} />
                    {/* Right */}
                    <div className="absolute bg-black/60 pointer-events-auto top-0 bottom-0 right-0"
                        style={{
                            top: Math.max(0, targetRect.top - HIGHLIGHT_PADDING),
                            bottom: `calc(100% - ${targetRect.bottom + HIGHLIGHT_PADDING}px)`,
                            left: targetRect.right + HIGHLIGHT_PADDING,
                        }}
                        onClick={isRequireClick ? undefined : handleNext} />
                </>
            ) : (
                /* No target — full dark overlay */
                <div
                    className="absolute inset-0 bg-black/60 pointer-events-auto"
                    onClick={isRequireClick ? undefined : handleNext}
                />
            )}


            {/* Highlight border */}
            {targetRect && (
                <div
                    className="absolute pointer-events-none transition-all duration-500"
                    style={{
                        top: targetRect.top - HIGHLIGHT_PADDING,
                        left: targetRect.left - HIGHLIGHT_PADDING,
                        width: targetRect.width + HIGHLIGHT_PADDING * 2,
                        height: targetRect.height + HIGHLIGHT_PADDING * 2,
                        border: '2px solid #34d399',
                        boxShadow: '0 0 0 4px rgba(52,211,153,0.25)',
                    }}
                />
            )}

            {/* Bouncing arrow indicator for requireClick steps */}
            {isRequireClick && targetRect && (
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: targetRect.bottom + HIGHLIGHT_PADDING + 8,
                        left: Math.max(targetRect.left + targetRect.width / 2 - 12, 20),
                    }}
                >
                    <span className="material-symbols-outlined text-emerald-400 text-3xl drop-shadow-lg" style={{ animation: 'bounce 1s infinite' }}>
                        arrow_upward
                    </span>
                </div>
            )}

            {/* Tooltip card */}
            <div
                className={`pointer-events-auto w-[340px] bg-white dark:bg-[#111] shadow-2xl transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                style={tooltipStyle as any}
            >
                {/* Progress bar */}
                <div className="h-1 bg-black/5 dark:bg-white/5">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="p-6 space-y-4">
                    {/* Step counter */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black tracking-[0.4em] opacity-30">
                            STEP {currentStep + 1} OF {steps.length}
                        </span>
                        <button
                            onClick={handleComplete}
                            className="text-[8px] font-black tracking-widest opacity-30 hover:opacity-60 transition-opacity"
                        >
                            SKIP
                        </button>
                    </div>

                    {/* Icon + Title */}
                    <div className="flex items-start gap-3">
                        {step.icon && (
                            <div className="w-10 h-10 bg-emerald-500 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-white text-lg">{step.icon}</span>
                            </div>
                        )}
                        <h3 className="text-lg font-black tracking-tight text-black dark:text-white mt-1">{step.title}</h3>
                    </div>

                    {/* Description */}
                    <p className="text-sm font-medium text-black/60 dark:text-white/60 leading-relaxed">
                        {step.description}
                    </p>

                    {/* Actions */}
                    {isRequireClick ? (
                        /* Mandatory step — no Next button, must click highlighted element */
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30">
                            <span className="material-symbols-outlined text-emerald-500 text-sm animate-pulse">touch_app</span>
                            <span className="text-[9px] font-black tracking-widest text-emerald-600 dark:text-emerald-400">
                                Click the highlighted item to continue
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 pt-2">
                            {currentStep > 0 && (
                                <button
                                    onClick={() => setCurrentStep(s => s - 1)}
                                    className="px-4 py-2 text-[9px] font-black tracking-widest border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="flex-1 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black text-[9px] font-black tracking-widest hover:opacity-80 transition-all flex items-center justify-center gap-2"
                            >
                                {isLastStep ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm">check</span>
                                        Got It!
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingTutorial;
