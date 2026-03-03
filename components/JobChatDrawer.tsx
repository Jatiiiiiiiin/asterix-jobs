import React, { useState, useRef, useEffect } from 'react';
import { Job } from '../types';
import { queryJobContext } from '../geminiService';
import { auth } from '../firebase';
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
      text: `Neural Bridge Established for [${job.title}] at ${job.company.name}. The mandate has been indexed. What would you like to analyze?`
    }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full sm:w-[500px] h-full bg-white dark:bg-background-dark border-l border-black dark:border-white/20 shadow-2xl flex flex-col transition-all duration-300">

        {/* Header */}
        <header className="px-4 sm:px-6 py-4 sm:py-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight">
              Neural Audit
            </h2>
            <p className="text-[9px] sm:text-[10px] font-black tracking-widest opacity-40 truncate max-w-[200px] sm:max-w-[250px]">
              {job.title} @ {job.company.name}
            </p>
          </div>

          <button onClick={onClose} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-xl sm:text-2xl">close</span>
          </button>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
            >
              <div
                className={`max-w-[95%] sm:max-w-[85%] px-4 py-3 text-[13px] sm:text-sm font-medium rounded-2xl ${msg.role === 'user'
                  ? 'bg-black text-white dark:bg-white dark:text-black rounded-tr-none shadow-lg'
                  : 'bg-gray-100 dark:bg-white/5 text-black dark:text-white rounded-tl-none border border-black/5 dark:border-white/5'
                  }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap font-semibold">{msg.text}</div>
                ) : (
                  <div className="markdown-container">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h3: ({ node, ...props }) => <h3 className="text-sm sm:text-base font-black mt-6 mb-2 first:mt-0 flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-1" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-4 leading-relaxed opacity-90 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="mb-4 space-y-2 list-none" {...props} />,
                        li: ({ node, ...props }) => (
                          <li className="flex gap-2 items-start" {...props}>
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20 shrink-0" />
                            <span>{props.children}</span>
                          </li>
                        ),
                        strong: ({ node, ...props }) => <strong className="font-black text-black dark:text-white" {...props} />,
                        code: ({ node, ...props }) => <code className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[12px]" {...props} />,
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
            <div className="text-[10px] sm:text-xs font-bold opacity-40 animate-pulse">
              AI analyzing job context...
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto custom-scrollbar border-t border-black/10 dark:border-white/10 shrink-0">
          {[
            "Why did I score less?",
            "What do I need to score more?",
            "What should I learn if I get shortlisted?"
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSend(suggestion)}
              disabled={isTyping}
              className="px-3 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-widest bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full whitespace-nowrap disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-black/10 dark:border-white/10 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about JD, match, or advice..."
              className="flex-1 bg-black/5 dark:bg-white/5 px-3 sm:px-4 py-2 sm:py-3 text-[13px] sm:text-sm font-semibold outline-none border border-transparent focus:border-black/10 dark:focus:border-white/10 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-black dark:bg-white text-white dark:text-black px-4 sm:px-6 disabled:opacity-30 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobChatDrawer;

