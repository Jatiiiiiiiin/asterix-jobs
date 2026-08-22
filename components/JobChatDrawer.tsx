import React, { useState, useRef, useEffect } from 'react';
import { Job } from '../types';
import { queryJobContext } from '../geminiService';
import { auth } from '../firebase';
import { Sparkles, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface JobChatDrawerProps {
  job: Job;
  onClose: () => void;
}

const JobChatDrawer: React.FC<JobChatDrawerProps> = ({ job, onClose }) => {
  // ... existing state and logic ...
  // (Omitting implementation details for brevity in this mock chunk, but will provide full edit below)
  const [messages, setMessages] = useState<
    { role: 'user' | 'ai'; text: string }[]
  >([
    {
      role: 'ai',
      text: `Neural Bridge Established for [${job.title}] at ${typeof job.company === 'string' ? job.company : job.company.name}. The mandate has been indexed. What would you like to analyze?`
    }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Swipe to close
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = x;
    setIsDragging(true);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = x - startX.current;

    // Only allow dragging right
    if (delta > 0) {
      setDragX(delta);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragX > 150) {
      onClose();
    }
    setDragX(0);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (messageOverride?: string | React.MouseEvent | React.KeyboardEvent) => {
    let textToSend = input.trim();
    if (typeof messageOverride === 'string') {
      textToSend = messageOverride;
    }

    if (!textToSend || isTyping) return;

    if (typeof messageOverride !== 'string') {
      setInput('');
    }

    const updatedMessages = [
      ...messages,
      { role: 'user' as const, text: textToSend }
    ];

    setMessages(updatedMessages);
    setIsTyping(true);

    const uid = auth.currentUser?.uid;
    const resumeText = uid ? (localStorage.getItem(`asterix_resume_content_${uid}`) || '') : '';

    try {
      const response = await queryJobContext(
        job,
        textToSend,
        messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
        resumeText,
        job.matchScore || 0
      );

      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: response || 'Neural signal interrupted. Please retry.'
        }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Neural audit failed. Please try again.'
        }
      ]);
    }

    setIsTyping(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="relative w-full sm:w-[550px] h-full bg-white/95 dark:bg-background-dark/95 backdrop-blur-2xl border-l border-black/10 dark:border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.2)] dark:shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col transition-all duration-500"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >

        {/* Header */}
        <header className="px-6 sm:px-8 py-6 sm:py-8 border-b border-black/5 dark:border-white/5 flex justify-between items-center shrink-0 cursor-grab active:cursor-grabbing bg-white/50 dark:bg-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-black dark:bg-white flex items-center justify-center rounded-2xl shadow-xl">
              <Sparkles size={22} className="text-white dark:text-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight leading-tight">
                Neural Audit
              </h2>
              <p className="text-[10px] font-black tracking-widest opacity-40 uppercase mt-1 truncate max-w-[200px] sm:max-w-[300px]">
                {job.title} — {typeof job.company === 'string' ? job.company : job.company.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[9px] font-black tracking-[0.2em] opacity-20 sm:block hidden translate-y-0.5">DRAG TO DISMISS</span>
            <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95">
              <span className="material-symbols-outlined text-2xl opacity-40 hover:opacity-100">close</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar bg-gradient-to-b from-transparent to-black/[0.01] dark:to-white/[0.01]"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[95%] sm:max-w-[85%] px-6 py-4 text-[13px] sm:text-[14px] font-medium leading-relaxed rounded-3xl shadow-sm ${msg.role === 'user'
                  ? 'bg-black text-white dark:bg-white dark:text-black rounded-tr-none shadow-lg'
                  : 'bg-black/5 dark:bg-white/5 text-black dark:text-white rounded-tl-none border border-black/5 dark:border-white/5'
                  }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap font-semibold">{msg.text}</div>
                ) : (
                  <div className="markdown-container prose dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h3: ({ node, ...props }) => <h3 className="text-sm sm:text-[15px] font-black mt-8 mb-3 first:mt-0 flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2 uppercase tracking-widest opacity-80" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-4 leading-[1.8] opacity-90 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="mb-4 space-y-3 list-none" {...props} />,
                        li: ({ node, ...props }) => (
                          <li className="flex gap-3 items-start" {...props}>
                            <span className="mt-2.5 size-1.5 rounded-full bg-black/20 dark:bg-white/20 shrink-0" />
                            <span className="opacity-90">{props.children}</span>
                          </li>
                        ),
                        strong: ({ node, ...props }) => <strong className="font-black text-black dark:text-white" {...props} />,
                        code: ({ node, ...props }) => <code className="bg-black/10 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-[12px] font-bold" {...props} />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-3 px-2 ml-1">
              <div className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full animate-bounce" />
              <div className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="text-[10px] font-black tracking-widest opacity-20 uppercase">Analyzing Context</span>
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="flex gap-3 px-6 sm:px-8 py-4 overflow-x-auto custom-scrollbar border-t border-black/5 dark:border-white/5 shrink-0 bg-black/[0.01] dark:bg-white/[0.01]">
          {[
            "Why did I score less?",
            "What do I need to score more?",
            "What should I learn if I get shortlisted?"
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSend(suggestion)}
              disabled={isTyping}
              className="px-5 py-2.5 text-[10px] sm:text-[11px] font-black tracking-widest bg-white dark:bg-background-dark border border-black/10 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-full whitespace-nowrap disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-6 sm:p-8 border-t border-black/5 dark:border-white/5 shrink-0 bg-white/50 dark:bg-white/5 backdrop-blur-xl">
          <div className="flex gap-3 bg-white dark:bg-black/40 p-2 rounded-2xl border border-black/10 dark:border-white/10 shadow-inner">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              placeholder="Ask about JD, match, or advice..."
              className="flex-1 bg-transparent px-4 py-3 text-[14px] font-semibold outline-none placeholder:opacity-30"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-black dark:bg-white text-white dark:text-black size-12 shrink-0 rounded-xl disabled:opacity-30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        <style>{`
          .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default JobChatDrawer;


