
import React, { useState, useEffect } from 'react';
import { Candidate } from '../types';
import { getAIInsights } from '../geminiService';

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
}

const CandidateModal: React.FC<CandidateModalProps> = ({ candidate, onClose }) => {
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      const data = await getAIInsights(candidate.name, candidate.title);
      setInsights(data);
      setIsLoading(false);
    };
    fetch();
  }, [candidate]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative z-50 w-full h-full md:h-auto md:max-w-[1000px] md:max-h-[90vh] bg-white dark:bg-background-dark shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 md:zoom-in duration-300">
        <header className="px-6 md:px-12 py-8 md:py-10 border-b border-black/10 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-background-dark">
          <div className="flex items-center gap-6">
            <div className="size-16 md:size-24 bg-black dark:bg-white shrink-0 relative border border-black/10">
              <img src={candidate.avatarUrl} className="size-full object-cover" alt="" />
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white size-8 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter">AI</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none">{candidate.name}</h1>
              </div>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-40">{candidate.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 hover:rotate-90 transition-transform duration-500">
            <span className="material-symbols-outlined text-3xl font-black">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-8 md:py-12 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20">
            <div className="lg:col-span-7 space-y-12">
              <section className="bg-black text-white dark:bg-white dark:text-black p-8 md:p-10 space-y-8">
                <div className="flex items-center gap-3 text-emerald-500">
                  <span className="material-symbols-outlined animate-pulse">auto_awesome</span>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Match Reasoning</h2>
                </div>
                {isLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-white/10 dark:bg-black/10 w-full"></div>
                    <div className="h-4 bg-white/10 dark:bg-black/10 w-3/4"></div>
                  </div>
                ) : (
                  <ul className="space-y-6">
                    {insights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-4">
                        <span className="text-[10px] font-black opacity-30 mt-1">0{idx + 1}</span>
                        <span className="text-xs md:text-sm font-bold uppercase tracking-tight leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Platform History</h2>
                <div className="space-y-8">
                  <div className="flex gap-6 border-l-2 border-black/10 dark:border-white/10 pl-6">
                    <div className="space-y-2">
                      <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter">{candidate.title}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Primary Experience Pillar • {candidate.experience}</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-5 space-y-12">
              <section className="space-y-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Skill Concentration</h2>
                <div className="space-y-6">
                  {candidate.skills.map((skill, i) => {
                    const val = 85 + (i * 3);
                    return (
                      <div key={skill} className="space-y-3 group cursor-default">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="opacity-60 group-hover:opacity-100 transition-opacity">{skill}</span>
                          <span className="group-hover:text-emerald-500 transition-colors">{val}%</span>
                        </div>
                        <div className="w-full h-3 border border-black/10 dark:border-white/10 p-0.5">
                          <div className="h-full bg-black dark:bg-white group-hover:bg-emerald-500 transition-all origin-left" style={{ width: `${val}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              
              <button className="w-full py-6 border border-black dark:border-white text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center justify-center gap-3">
                <span className="material-symbols-outlined text-lg">download</span>
                Download Data Sheet
              </button>
            </div>
          </div>
        </div>

        <footer className="px-6 md:px-12 py-8 md:py-10 bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest opacity-40">
            <span className="material-symbols-outlined text-base">visibility</span>
            Viewed by 4 network nodes
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={onClose} className="flex-1 md:px-10 py-5 border border-black dark:border-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
              Dismiss
            </button>
            <button className="flex-1 md:px-10 py-5 bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest hover:invert transition-all shadow-2xl flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-base">star</span>
              Shortlist
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CandidateModal;
