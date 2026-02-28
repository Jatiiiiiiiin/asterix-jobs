import React, { useState, useRef, useEffect } from 'react';
import { Job } from '../types';
import { queryJobContextHF } from '../huggingfaceService';

interface JobChatDrawerProps {
  job: Job;
  onClose: () => void;
}

const JobChatDrawer: React.FC<JobChatDrawerProps> = ({ job, onClose }) => {
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

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');

    const updatedMessages = [
      ...messages,
      { role: 'user' as const, text: userMessage }
    ];

    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await queryJobContextHF(
        job,
        userMessage
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
      <div className="relative w-full max-w-[480px] h-full bg-white dark:bg-background-dark border-l border-black dark:border-white/20 shadow-2xl flex flex-col">

        {/* Header */}
        <header className="px-6 py-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black tracking-tight">
              Neural Audit
            </h2>
            <p className="text-[10px] font-black tracking-widest opacity-40 truncate max-w-[250px]">
              {job.title} @ {job.company.name}
            </p>
          </div>

          <button onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 text-sm font-semibold rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-gray-100 dark:bg-white/5 text-black dark:text-white'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="text-xs font-bold opacity-40 animate-pulse">
              AI analyzing job context...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-black/10 dark:border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about tech stack, responsibilities, growth..."
              className="flex-1 bg-black/5 dark:bg-white/5 px-4 py-3 text-sm font-semibold outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-black dark:bg-white text-white dark:text-black px-6 disabled:opacity-30"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobChatDrawer;

