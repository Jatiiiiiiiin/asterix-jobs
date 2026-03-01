import React from 'react';
import { InterviewTips } from '../geminiService';

interface Props {
    isOpen: boolean;
    jobTitle: string;
    tips: InterviewTips | null;
    isLoading: boolean;
    onClose: () => void;
}

const SECTIONS = [
    {
        key: 'strengths' as keyof InterviewTips,
        label: 'Strengths',
        sublabel: 'Lead with these',
        icon: 'verified',
        color: '#10b981',
        tag: '01',
    },
    {
        key: 'gapAreas' as keyof InterviewTips,
        label: 'Gap Areas',
        sublabel: 'Prepare these',
        icon: 'warning',
        color: '#f59e0b',
        tag: '02',
    },
    {
        key: 'powerTips' as keyof InterviewTips,
        label: 'Power Tips',
        sublabel: 'Tactical moves',
        icon: 'bolt',
        color: '#818cf8',
        tag: '03',
    },
];

export default function InterviewTipsModal({ isOpen, jobTitle, tips, isLoading, onClose }: Props) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[900] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="w-full max-w-3xl flex flex-col"
                style={{
                    background: '#111',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 80px 160px rgba(0,0,0,0.8)',
                    maxHeight: 'min(800px, 85vh)',
                }}
            >
                {/* ── HEADER BAR ─────────────────────── */}
                <div
                    className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="w-9 h-9 flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
                        >
                            <span className="material-symbols-outlined text-lg" style={{ color: '#10b981' }}>emoji_objects</span>
                        </div>
                        <div>
                            <p className="text-[6px] md:text-[7px] font-black tracking-[0.4em] md:tracking-[0.5em] mb-0.5 opacity-80" style={{ color: '#10b981' }}>
                                Interview Ace Protocol
                            </p>
                            <h2 className="text-sm md:text-base font-black tracking-tight text-white leading-none truncate max-w-[150px] sm:max-w-xs lg:max-w-md">
                                {jobTitle}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div
                            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1"
                            style={{ border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.05)' }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                            <span className="text-[7px] font-black tracking-widest" style={{ color: '#10b981' }}>
                                HuggingFace AI
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="transition-opacity hover:opacity-50 flex items-center justify-center"
                            style={{ width: 32, height: 32, border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <span className="material-symbols-outlined text-sm text-white">close</span>
                        </button>
                    </div>
                </div>

                {/* ── BODY ────────────────────────────── */}
                <div className="overflow-y-auto flex-1 custom-scrollbar bg-black/20">
                    {isLoading ? (

                        /* Loading */
                        <div className="flex flex-col items-center justify-center gap-6 py-24">
                            <span
                                className="material-symbols-outlined text-6xl"
                                style={{ color: '#10b981', animation: 'ace-spin 1.2s linear infinite' }}
                            >
                                neurology
                            </span>
                            <div className="text-center">
                                <p className="text-[11px] font-black tracking-[0.35em] text-white mb-1">
                                    Analysing Resume vs JD
                                </p>
                                <p className="text-[8px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                    Keyword matching in progress…
                                </p>
                            </div>
                            <div
                                className="w-48 overflow-hidden"
                                style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}
                            >
                                <div style={{ width: '35%', height: '100%', background: '#10b981', animation: 'ace-slide 1.4s linear infinite' }} />
                            </div>
                        </div>

                    ) : tips ? (

                        <div className="p-4 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                {SECTIONS.map(s => {
                                    const items = tips[s.key] as string[];
                                    return (
                                        <div key={s.key} className="space-y-4">
                                            {/* Category Header */}
                                            <div
                                                className="flex items-center gap-3 px-3 py-3"
                                                style={{ background: `${s.color}0f`, border: `1px solid ${s.color}30` }}
                                            >
                                                <span className="material-symbols-outlined text-lg" style={{ color: s.color }}>{s.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black tracking-widest text-white uppercase">{s.label}</p>
                                                    <p className="text-[7px] font-black tracking-widest opacity-60" style={{ color: s.color }}>{s.sublabel}</p>
                                                </div>
                                                <span className="text-xl font-black tabular-nums opacity-10" style={{ color: s.color }}>{s.tag}</span>
                                            </div>

                                            {/* Tip Cards for this category */}
                                            <div className="space-y-3">
                                                {items.slice(0, 3).map((tip, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex flex-col gap-2.5 p-4"
                                                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                                                    >
                                                        <div
                                                            className="w-5 h-5 flex items-center justify-center shrink-0"
                                                            style={{ background: `${s.color}15`, border: `1px solid ${s.color}35` }}
                                                        >
                                                            <span className="text-[8px] font-black leading-none" style={{ color: s.color }}>{i + 1}</span>
                                                        </div>
                                                        <p className="text-[11px] leading-relaxed text-white/70 font-medium">
                                                            {tip}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    ) : (

                        /* Error */
                        <div className="flex flex-col items-center gap-3 py-20 text-white" style={{ opacity: 0.25 }}>
                            <span className="material-symbols-outlined text-4xl">sentiment_dissatisfied</span>
                            <p className="text-xs font-black tracking-widest">Could not generate tips</p>
                        </div>

                    )}
                </div>

                {/* ── FOOTER ─────────────────────────── */}
                {!isLoading && tips && (
                    <div
                        className="px-4 md:px-6 py-4 md:py-3 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}
                    >
                        <p className="text-[6px] md:text-[7px] font-black tracking-widest text-center sm:text-left opacity-30">
                            Powered by resume ⟷ JD keyword analysis · HuggingFace enriched
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full sm:w-auto px-10 py-3 md:py-2 text-[9px] font-black tracking-widest text-black transition-all hover:opacity-80 active:scale-95"
                            style={{ background: '#10b981' }}
                        >
                            Got it ✓
                        </button>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes ace-spin  { to { transform: rotate(360deg); } }
        @keyframes ace-slide { 0% { transform: translateX(-200%); } 100% { transform: translateX(600%); } }
      `}</style>
        </div>
    );
}

