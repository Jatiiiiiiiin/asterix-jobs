import React, { useState, useRef, useEffect } from "react";

export default function AIChatOverlay({ job }: { job: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping || !job) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsTyping(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jobTitle: job?.title || "Unknown Job",
          jobDescription: (job?.jobSummary || "") + "\n" + (job?.responsibilities?.join("\n") || ""),
          question: userMessage,
          history: []
        })
      });

      const data = await response.json();
      const aiText = data.answer;


      setMessages(prev => [...prev, { role: "ai", text: aiText }]);

    } catch (error) {
      setMessages(prev => [...prev, { role: "ai", text: "Connection error." }]);
    }

    setIsTyping(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end">
      {isOpen && (
        <div className="w-[400px] h-[600px] bg-white dark:bg-background-dark border border-black dark:border-white/20 shadow-2xl flex flex-col mb-4">

          <header className="p-4 border-b border-black dark:border-white/10 bg-black text-white dark:bg-white dark:text-black flex justify-between">
            <h4 className="text-[11px] font-black tracking-[0.3em]">
              AI Assistant
            </h4>
            <button onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 text-sm ${m.role === "user"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-200 dark:bg-white/10"
                    }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {isTyping && <div className="text-xs opacity-40">Thinking...</div>}
          </div>

          <div className="p-4 border-t border-black dark:border-white/10">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 bg-black/5 dark:bg-white/5 p-3 text-sm"
                placeholder="Ask something..."
              />
              <button
                onClick={handleSend}
                className="bg-black dark:bg-white text-white dark:text-black px-4"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="size-16 bg-black dark:bg-white text-white dark:text-black shadow-2xl flex items-center justify-center"
      >
        <span className="material-symbols-outlined">
          {isOpen ? "close" : "neurology"}
        </span>
      </button>
    </div>
  );
}

