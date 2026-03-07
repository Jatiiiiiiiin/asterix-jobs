import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Sparkles, Zap, Shield, Cpu } from 'lucide-react';

interface Message {
    role: 'user' | 'ai';
    text: string;
}

const SITE_KNOWLEDGE = {
    about: "Asterix is a premium AI-powered career platform that bridges the gap between talent and opportunity using smart AI matching.",
    features: [
        { name: "Find Jobs", desc: "Our AI-powered job board where we list all open jobs with real-time match scores based on your resume." },
        { name: "AI Audit", desc: "A deep analysis of how your resume aligns with a specific job, with detailed feedback to improve your chances." },
        { name: "Recalibrate", desc: "Refresh your job scores anytime. No need to re-upload your resume — just click Recalibrate to re-score all open jobs." },
        { name: "Auto-Pilot", desc: "Automatically scores and applies to jobs that match your profile without you needing to do anything." }
    ],
    pricing: "We offer Student and Pro plans. Student plans starting at ₹99/mo provide full access to AI tools and fast-track applications.",
    autoApply: "Yes, our Auto-Pilot feature handles automatic applications. It checks your profile against all open jobs and applies where your match score is above the recruiter's threshold."
};

const AsterixAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: "Hey! I'm Asterix Scout. How can I help you find your next job today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Gestures
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        startX.current = x;
        setIsDragging(true);
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const delta = x - startX.current;

        if (isHidden) {
            setDragX(Math.min(0, delta));
        } else {
            setDragX(Math.max(0, delta));
        }
    };

    const handleDragEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        if (!isHidden && dragX > 50) {
            setIsHidden(true);
            setShowPopup(false);
        } else if (isHidden && dragX < -50) {
            setIsHidden(false);
        }
        setDragX(0);
    };

    // Interval Popup Logic
    useEffect(() => {
        const checkPopup = () => {
            const lastShown = localStorage.getItem('asterix_scout_last_popup');
            const now = Date.now();

            // 2 minute cooldown (120000ms) instead of 5 minutes
            if (!isHidden && !isOpen && !showPopup && (!lastShown || now - parseInt(lastShown) > 120000)) {
                setShowPopup(true);
                localStorage.setItem('asterix_scout_last_popup', now.toString());

                if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
                popupTimerRef.current = setTimeout(() => {
                    setShowPopup(false);
                }, 10000);
            }
        };

        // Initial delay of 10s instead of 45s
        const timer = setTimeout(checkPopup, 10000);

        return () => {
            clearTimeout(timer);
            if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        };
    }, [isOpen, isHidden, showPopup]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async (textOverride?: string) => {
        const text = textOverride || input.trim();
        if (!text) return;

        if (!textOverride) setInput('');
        setMessages(prev => [...prev, { role: 'user', text }]);
        setIsTyping(true);

        // Simulate AI thinking and enhanced matching
        setTimeout(() => {
            let response = "I'm still learning about that. Try asking me about 'jobs', 'auto-pilot', 'pricing', or 'what do you do'.";
            const query = text.toLowerCase();

            const matches = (keywords: string[]) => keywords.some(k => {
                const regex = new RegExp(`\\b${k}\\b`, 'i');
                return regex.test(query);
            });

            if (matches(['what', 'whay', 'who', 'do', 'motive', 'goal', 'purpose', 'about'])) {
                response = `${SITE_KNOWLEDGE.about}\n\nKey features include:\n` +
                    SITE_KNOWLEDGE.features.map(f => `• **${f.name}**: ${f.desc}`).join('\n');
            } else if (matches(['mission control', 'job board', 'jobs', 'feed', 'find jobs'])) {
                response = SITE_KNOWLEDGE.features[0].desc;
            } else if (matches(['audit', 'resume', 'feedback', 'analysis', 'calibrate', 'recalibrate'])) {
                response = SITE_KNOWLEDGE.features[2].desc;
            } else if (matches(['auto-pilot', 'sync', 'background', 'every job', 'apply', 'automatic', 'candidates'])) {
                response = SITE_KNOWLEDGE.autoApply;
            } else if (matches(['pricing', 'cost', 'plan', 'student', 'pro', 'money', 'buy'])) {
                response = SITE_KNOWLEDGE.pricing;
            } else if (matches(['hello', 'hi', 'greetings', 'hey', 'start'])) {
                response = "Hey! I'm here to help you get the most out of Asterix. What would you like to know?";
            }

            setMessages(prev => [...prev, { role: 'ai', text: response }]);
            setIsTyping(false);
        }, 800);
    };

    return (
        <div
            className="fixed bottom-6 right-0 z-[999] flex flex-col items-end pointer-events-none pr-6"
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
        >

            {/* ── Popup Message ── */}
            {showPopup && !isOpen && !isHidden && (
                <div className="mb-4 bg-white/80 dark:bg-background-dark/80 backdrop-blur-xl border border-black/10 dark:border-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-float pointer-events-auto max-w-[220px] relative rounded-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-black/[0.02] to-transparent dark:from-white/[0.02] pointer-events-none" />
                    <button
                        onClick={() => setShowPopup(false)}
                        className="absolute top-2 right-2 size-5 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                        <X size={10} />
                    </button>
                    <p className="text-[10px] font-black tracking-widest leading-relaxed opacity-60">
                        SCOUT
                    </p>
                    <p className="mt-1 text-[11px] font-bold leading-relaxed">
                        Wanna save time? Ask me what we actually do.
                    </p>
                    <button
                        onClick={() => {
                            setIsOpen(true);
                            setShowPopup(false);
                            handleSend("What do you actually do?");
                        }}
                        className="mt-3 w-full bg-black dark:bg-white text-white dark:text-black py-2 text-[9px] font-black tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all rounded-lg"
                    >
                        TALK TO SCOUT
                    </button>
                </div>
            )}

            {/* ── Chat Window ── */}
            {isOpen && (
                <div className="mb-4 w-[350px] sm:w-[400px] h-[550px] bg-white/90 dark:bg-background-dark/90 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col pointer-events-auto animate-slide-up rounded-3xl overflow-hidden">

                    <header className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/5 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="size-10 bg-black dark:bg-white flex items-center justify-center rounded-xl shadow-lg">
                                <Sparkles size={18} className="text-white dark:text-black" />
                            </div>
                            <div>
                                <h3 className="text-[11px] font-black tracking-[0.2em] leading-none">ASTERIX SCOUT</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="size-1.5 bg-[#826BF0] rounded-full animate-pulse shadow-[0_0_8px_rgba(130,107,240,0.5)]" />
                                    <span className="text-[8px] font-bold tracking-widest opacity-40">ONLINE</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="size-8 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all">
                            <X size={20} className="opacity-40 hover:opacity-100" />
                        </button>
                    </header>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`max-w-[85%] p-4 text-[12px] font-semibold leading-relaxed shadow-sm ${m.role === 'user'
                                    ? 'bg-black text-white dark:bg-white dark:text-black rounded-2xl rounded-tr-none'
                                    : 'bg-black/5 text-black dark:bg-white/5 dark:text-white rounded-2xl rounded-tl-none border border-black/5 dark:border-white/5'
                                    }`}>
                                    {m.text.split('\n').map((line, idx) => (
                                        <p key={idx} className={line.startsWith('•') ? 'ml-2 mb-1 last:mb-0 text-[11px] opacity-80' : 'mb-2 last:mb-0'}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex items-center gap-2 px-2 ml-1">
                                <div className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full animate-bounce" />
                                <div className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/5">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Query system knowledge..."
                                className="flex-1 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:ring-2 ring-black/5 dark:ring-white/5 transition-all"
                            />
                            <button
                                onClick={() => handleSend()}
                                className="size-11 bg-black text-white dark:bg-white dark:text-black rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Toggle Button ── */}
            <div
                className={`transition-all duration-500 pointer-events-auto cursor-grab active:cursor-grabbing ${isHidden ? 'translate-x-[calc(100%+12px)]' : ''}`}
                style={{ transform: `translateX(${dragX}px) ${isHidden ? 'translateX(calc(100% + 12px))' : ''}` }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <button
                    onClick={() => { if (!isDragging || Math.abs(dragX) < 5) { setIsOpen(!isOpen); setShowPopup(false); } }}
                    className="size-16 bg-black text-white dark:bg-white dark:text-black rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all overflow-hidden relative group"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    {isOpen ? <X size={28} /> : <Cpu size={28} className="animate-pulse" />}
                </button>
            </div>

            {/* ── Drag Back Zone ── */}
            {isHidden && (
                <div
                    className="fixed top-0 right-0 w-12 h-full z-[1000] pointer-events-auto cursor-pointer flex items-center justify-center group"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <div className="w-1.5 h-16 bg-black/10 dark:bg-white/10 rounded-full group-hover:bg-black/30 dark:group-hover:bg-white/30 transition-all group-hover:h-24" />
                </div>
            )}

            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes slideUp {
          from { transform: translateY(40px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>


    );
};

export default AsterixAssistant;
