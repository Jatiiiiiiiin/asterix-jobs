import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import JobChatDrawer from '../components/JobChatDrawer';
import { subscribeToActiveJobs } from '../Jobservice';
import { Job } from '../types';
import { authService } from '../authService';
import { usePlan } from '../usePlan.ts';
import UpgradeModal from '../components/UpgradeModal';

const JobsPage: React.FC<{ onToggleTheme: () => void, isDarkMode: boolean }> = ({ onToggleTheme, isDarkMode }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoPilotActive, setIsAutoPilotActive] = useState(() =>
    localStorage.getItem('asterix_autopilot') === 'true'
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [matchThreshold, setMatchThreshold] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeChatJob, setActiveChatJob] = useState<Job | null>(null);
  const [showFidelityFilter, setShowFidelityFilter] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dynamicJobs, setDynamicJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // ── Plan gating ─────────────────────────────────────────────
  const { canManualApply } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const initializeJobs = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setUserId(user.uid);
          const savedJobs = localStorage.getItem(`asterix_jobs_${user.uid}`);
          const jobDataMap = savedJobs ? JSON.parse(savedJobs) : [];

          const unsub = subscribeToActiveJobs(
            (liveJobs) => {
              const merged: Job[] = liveJobs.map(liveJob => {
                const savedData = Array.isArray(jobDataMap)
                  ? jobDataMap.find((j: any) => j.id === liveJob.id)
                  : jobDataMap[liveJob.id];

                return {
                  ...liveJob,
                  matchScore: savedData?.matchScore ?? 0,
                  applied: savedData?.applied ?? false,
                  analyzing: savedData?.analyzing ?? false,
                  matchHighlights: savedData?.matchHighlights ?? [],
                  breakdown: savedData?.breakdown ?? null,
                };
              });

              setDynamicJobs(merged);
              setIsLoadingJobs(false);
            },
            (err) => {
              console.error('[JobsPage] Jobs subscription error:', err);
              setIsLoadingJobs(false);
            }
          );

          return unsub;
        } else {
          setIsLoadingJobs(false);
        }
      } catch (err) {
        console.error('Error initializing jobs:', err);
        setIsLoadingJobs(false);
      }
    };

    const unsubPromise = initializeJobs();
    return () => { unsubPromise?.then(unsub => unsub?.()); };
  }, []);

  useEffect(() => {
    localStorage.setItem('asterix_autopilot', String(isAutoPilotActive));
  }, [isAutoPilotActive]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) setShowMobileFilters(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredJobs = useMemo(() => {
    return dynamicJobs.filter(job => {
      const q = searchQuery.toLowerCase().trim();
      const matchesText = !q ||
        (job.title ?? "").toLowerCase().includes(q) ||
        (typeof job.company === 'string' ? job.company : (job.company?.name ?? "")).toLowerCase().includes(q) ||
        (job.requiredSkills ?? []).some(t => (t ?? "").toLowerCase().includes(q));

      const matchesType = selectedTypes.length === 0 || selectedTypes.some(type => {
        if (type === 'Remote') {
          return (typeof job.location === 'string' ? job.location : (job.location?.type ?? "")).toLowerCase() === 'remote' ||
            (job.title ?? "").toLowerCase().includes('remote');
        }
        const empType = job.employmentType ?? "";
        const empTypeStr = Array.isArray(empType) ? empType.join(" ") : empType;
        return empTypeStr.includes(type);
      });

      const matchesThreshold = (job.matchScore ?? 0) >= matchThreshold;
      return matchesText && matchesType && matchesThreshold;
    });
  }, [dynamicJobs, searchQuery, selectedTypes, matchThreshold]);

  const bestFitJobs = useMemo(() => {
    return filteredJobs
      .filter(j => (j.matchScore ?? 0) > 45)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }, [filteredJobs]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowMobileFilters(false);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden">
      <Sidebar role="candidate" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 flex flex-col custom-scrollbar scroll-smooth">
        <header className="px-6 md:px-10 py-4 md:py-5 border-b border-black/5 dark:border-white/5 shrink-0 bg-white dark:bg-background-dark sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 -ml-2 text-black dark:text-white" aria-label="Open menu">
                <span className="material-symbols-outlined text-lg">menu</span>
              </button>
              <h1 className="text-xl md:text-3xl font-black  tracking-tighter truncate">Mission Control</h1>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-2xl hidden sm:flex">
              <div className="relative group flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base opacity-30 group-focus-within:opacity-100 transition-opacity pointer-events-none">search</span>
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 pl-9 py-2 text-xs font-black  tracking-tight focus:ring-0 focus:border-black dark:focus:border-white outline-none transition-all placeholder:opacity-20"
                />
              </div>
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-black dark:border-white bg-white dark:bg-background-dark hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-base">tune</span>
                <span className="text-[10px] font-black  tracking-[0.3em]">Filters</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onToggleTheme}
                className="p-2 border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
              >
                <span className="material-symbols-outlined text-base">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
            </div>
          </div>

          <div className="relative group mt-3 sm:hidden">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base opacity-30 group-focus-within:opacity-100 transition-opacity pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 pl-9 py-2 text-xs font-black  tracking-tight focus:ring-0 focus:border-black dark:focus:border-white outline-none transition-all placeholder:opacity-20"
            />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">
          {showMobileFilters && (
            <div className="xl:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowMobileFilters(false)} />
          )}

          <aside className={`
            fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-background-dark border-r-2 border-black dark:border-white/10 p-8 space-y-8 overflow-y-auto custom-scrollbar transition-transform duration-300 shadow-2xl
            ${showMobileFilters ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="flex justify-between items-center pb-4 border-b border-black/10 dark:border-white/10">
              <h3 className="text-[10px] font-black  tracking-[0.3em] opacity-40">Filter Protocol</h3>
              <button onClick={() => setShowMobileFilters(false)} className="material-symbols-outlined text-lg hover:bg-black/5 dark:hover:bg-white/5 p-1 transition-colors">close</button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <button
                  onClick={() => setShowFidelityFilter(!showFidelityFilter)}
                  className="w-full flex items-center justify-between p-3 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">tune</span>
                    <span className="text-[10px] font-black  tracking-[0.3em]">Fidelity Guard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">{matchThreshold}%</span>
                    <span className={`material-symbols-outlined text-base transition-transform ${showFidelityFilter ? 'rotate-180' : ''}`}>expand_more</span>
                  </div>
                </button>

                {showFidelityFilter && (
                  <div className="space-y-4 p-4 border-2 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                    <div className="flex justify-between items-end">
                      <span className="text-[8px] font-black  tracking-widest opacity-60">Neural Threshold</span>
                      <span className="text-xl font-black">{matchThreshold}%</span>
                    </div>
                    <input
                      type="range" min="0" max="95" step="5" value={matchThreshold}
                      onChange={(e) => setMatchThreshold(parseInt(e.target.value))}
                      className="w-full h-1 bg-black/10 dark:bg-white/10 appearance-none accent-black dark:accent-white cursor-pointer"
                    />
                    <div className="flex justify-between text-[7px] font-black  tracking-wider opacity-30">
                      <span>0%</span><span>50%</span><span>95%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-[9px] font-black  tracking-[0.3em] opacity-40">Mission Type</h3>
                <div className="space-y-2">
                  {['Full-time', 'Contract', 'Remote'].map(type => (
                    <label key={type} className="flex items-center justify-between group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 transition-colors">
                      <span className={`text-xs font-black  tracking-widest transition-opacity ${selectedTypes.includes(type) ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'}`}>
                        {type}
                      </span>
                      <button
                        type="button" onClick={() => toggleType(type)}
                        className={`size-6 border-2 border-black dark:border-white flex items-center justify-center p-1 transition-all ${selectedTypes.includes(type) ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-transparent'}`}
                      >
                        {selectedTypes.includes(type) && <span className="material-symbols-outlined text-[12px]">check</span>}
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-black/5 dark:border-white/5">
                <h3 className="text-[9px] font-black  tracking-[0.3em] opacity-40 mb-4">Market View</h3>
                <div className="flex flex-col gap-2">
                  <button onClick={() => scrollToSection('best-fit')} className="text-[9px] font-black  tracking-[0.25em] px-4 py-3 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-center">
                    Neural Syncs ({bestFitJobs.length})
                  </button>
                  <button onClick={() => scrollToSection('all-jobs')} className="text-[9px] font-black  tracking-[0.25em] px-4 py-3 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-center opacity-40 hover:opacity-100">
                    Universe Feed ({filteredJobs.length})
                  </button>
                </div>
              </div>

              <div className="bg-emerald-500 text-white p-6 space-y-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg animate-pulse">auto_awesome</span>
                  <h4 className="text-[9px] font-black  tracking-widest">Neural Auto-Pilot</h4>
                </div>
                <p className="text-[8px] font-bold  tracking-widest opacity-80 leading-relaxed">
                  Identity is synchronized. Application routing is 98.2% calibrated.
                </p>
                <button
                  onClick={() => setIsAutoPilotActive(!isAutoPilotActive)}
                  className={`w-full py-3 text-[9px] font-black  tracking-widest border-2 border-white transition-all ${isAutoPilotActive ? 'bg-white text-emerald-500' : 'hover:bg-white hover:text-emerald-500'}`}
                >
                  {isAutoPilotActive ? '✓ System Active' : 'Initialize'}
                </button>
              </div>
            </div>
          </aside>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-16 custom-scrollbar">

            {/* Elite Neural Syncs */}
            <section id="best-fit" className="space-y-8 scroll-mt-4">
              <div className="flex justify-between items-center border-b-2 border-black dark:border-white pb-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-4xl font-black  tracking-tighter">Neural Synergy</h2>
                  <p className="text-[9px] font-black  tracking-widest opacity-40">Top-tier calibrated missions</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black  tracking-widest opacity-30">{bestFitJobs.length} SYNCED</span>
                  <div className="size-2 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
              </div>

              <div className="grid gap-6">
                {bestFitJobs.length > 0 ? (
                  bestFitJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isBestFit={true}
                      navigate={navigate}
                      setActiveChatJob={setActiveChatJob}
                      canManualApply={canManualApply}
                      onLockedClick={() => setShowUpgradeModal(true)}
                    />
                  ))
                ) : (
                  <div className="py-20 border-4 border-dashed border-black/10 dark:border-white/10 text-center space-y-4 opacity-30">
                    <span className="material-symbols-outlined text-5xl">sync_problem</span>
                    <p className="text-[10px] font-black  tracking-widest leading-relaxed px-4">
                      No high-fidelity syncs found.<br />Optimize parameters for elite view.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* General Market Feed */}
            <section id="all-jobs" className="space-y-8 pb-32 scroll-mt-4">
              <div className="flex justify-between items-center border-b-2 border-black/10 dark:border-white/10 pb-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-4xl font-black  tracking-tighter opacity-40">Universe Feed</h2>
                  <p className="text-[9px] font-black  tracking-widest opacity-20">Full market inventory matching logic</p>
                </div>
                <div className="text-[9px] font-black  tracking-widest opacity-30">
                  {isLoadingJobs ? '...' : `${filteredJobs.length} Positions Vetted`}
                </div>
              </div>

              {isLoadingJobs ? (
                <div className="flex items-center justify-center gap-3 py-20 text-black/30 dark:text-white/30">
                  <span className="material-symbols-outlined animate-spin">autorenew</span>
                  <span className="text-sm font-black  tracking-widest">Loading live jobs...</span>
                </div>
              ) : (
                <div className="grid gap-5">
                  {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isBestFit={false}
                        navigate={navigate}
                        setActiveChatJob={setActiveChatJob}
                        canManualApply={canManualApply}
                        onLockedClick={() => setShowUpgradeModal(true)}
                      />
                    ))
                  ) : (
                    <div className="py-24 text-center opacity-30 border-2 border-black/5 dark:border-white/5">
                      <p className="text-xs font-black  tracking-[0.3em]">Empty Universe Protocol engaged.</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {activeChatJob && (
        <JobChatDrawer job={activeChatJob} onClose={() => setActiveChatJob(null)} />
      )}

      {/* UPGRADE MODAL */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
};

/* ═══════════════════════════════════════════
   JOB CARD — now receives plan props
═══════════════════════════════════════════ */
const JobCard: React.FC<{
  job: Job;
  isBestFit: boolean;
  navigate: any;
  setActiveChatJob: (job: Job) => void;
  canManualApply: boolean;
  onLockedClick: () => void;
}> = ({ job, isBestFit, navigate, setActiveChatJob, canManualApply, onLockedClick }) => {
  const handleShare = async () => {
    const company = typeof job.company === 'string' ? job.company : job.company?.name || '';
    const url = `${window.location.origin}/job/${job.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${job.title} at ${company}`, url }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className={`
    group border-2 border-black dark:border-white/10 p-6 md:p-8 
    hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black 
    transition-all duration-500 relative overflow-hidden 
    bg-white dark:bg-background-dark
    ${isBestFit ? 'border-l-[8px] border-l-emerald-500 shadow-lg' : ''}
  `}>
      <div className="flex flex-col lg:flex-row gap-6 md:gap-10">
        <div className={`
        size-20 md:size-24 bg-black dark:bg-white flex items-center justify-center 
        border-2 border-black/10 dark:border-white/10
        group-hover:bg-white dark:group-hover:bg-black transition-all shrink-0
        ${isBestFit ? 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' : ''}
      `}>
          <span className="material-symbols-outlined text-4xl md:text-5xl text-white dark:text-black group-hover:text-black dark:group-hover:text-white">
            corporate_fare
          </span>
        </div>

        <div className="flex-grow space-y-4 md:space-y-5 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div className="flex-1 min-w-0 overflow-hidden">
              <h2 className="text-xl md:text-3xl font-black  tracking-tighter group-hover:text-white dark:group-hover:text-black transition-colors leading-tight break-words">
                {job.title ?? 'Untitled Position'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2">
                <span className="text-[10px] md:text-sm font-black  tracking-widest opacity-40 group-hover:text-white/60 dark:group-hover:text-black/60">
                  {typeof job.company === 'string' ? job.company : (job.company?.name ?? 'Unknown Company')}
                </span>
                <span className="size-1.5 bg-black/20 dark:bg-white/20 rounded-full group-hover:bg-white/40 dark:group-hover:bg-black/40 shrink-0"></span>
                <span className="text-[10px] md:text-sm font-black  tracking-widest opacity-40 group-hover:text-white/60 dark:group-hover:text-black/60">
                  {typeof job.location === 'string' ? job.location : (job.location?.city ?? 'Remote')}
                </span>
              </div>
            </div>

            <div className="text-right flex flex-col items-end shrink-0">
              <div className={`text-4xl md:text-6xl font-black leading-none transition-colors duration-300 ${isBestFit ? 'text-emerald-500 group-hover:text-emerald-400' : 'group-hover:text-white dark:group-hover:text-black'}`}>
                {job.matchScore ?? 0}%
              </div>
              <div className="text-[8px] font-black  tracking-[0.25em] opacity-30 group-hover:text-white/40 dark:group-hover:text-black/40">FIDELITY</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(job.requiredSkills ?? []).slice(0, 4).map(tag => (
              <span key={tag} className="px-3 md:px-4 py-1.5 border-2 border-black/10 dark:border-white/10 group-hover:border-white/20 dark:group-hover:border-black/20 text-[9px] md:text-[10px] font-black  tracking-widest group-hover:text-white/80 dark:group-hover:text-black/80 transition-all">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-5 border-t-2 border-black/5 dark:border-white/5 group-hover:border-white/10 dark:group-hover:border-black/10">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black  tracking-widest opacity-40 group-hover:text-white/40 dark:group-hover:text-black/40">Capital Package</span>
                <span className="text-xs md:text-base font-black  group-hover:text-white dark:group-hover:text-black">
                  ₹{(job.salaryRange?.min ?? 0) / 100000}L - ₹{(job.salaryRange?.max ?? 0) / 100000}L
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black  tracking-widest opacity-40 group-hover:text-white/40 dark:group-hover:text-black/40">Engagement</span>
                <span className="text-xs md:text-base font-black  group-hover:text-white dark:group-hover:text-black">{job.employmentType ?? 'Position'}</span>
              </div>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              {/* Share */}
              <button
                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                title="Share job"
                className="w-10 h-10 flex items-center justify-center border-2 border-black/15 dark:border-white/15 text-black/40 dark:text-white/40 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white group-hover:border-white/30 group-hover:text-white/60 dark:group-hover:border-black/30 dark:group-hover:text-black/60 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-base">share</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setActiveChatJob(job); }}
                className="flex items-center justify-center gap-2 border-2 border-black dark:border-white text-black dark:text-white px-5 md:px-8 py-3 md:py-4 text-[9px] md:text-[10px] font-black  tracking-[0.2em] group-hover:bg-white dark:group-hover:bg-black group-hover:text-black dark:group-hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-base md:text-lg">neurology</span>
                <span className="hidden sm:inline">AI Audit</span>
              </button>

              {/* ── Plan-gated Initialize ── */}
              {canManualApply ? (
                <button
                  onClick={() => navigate(`/job/${job.id}`, { state: { job } })}
                  className="flex-1 sm:flex-none bg-black dark:bg-white text-white dark:text-black px-8 md:px-12 py-3 md:py-4 text-[9px] md:text-[10px] font-black  tracking-[0.2em] group-hover:bg-white dark:group-hover:bg-black group-hover:text-black dark:group-hover:text-white transition-all shadow-xl"
                >
                  Initialize
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onLockedClick(); }}
                  className="flex-1 sm:flex-none relative px-8 md:px-12 py-3 md:py-4 text-[9px] md:text-[10px] font-black  tracking-[0.2em] border-2 border-black/20 dark:border-white/20 text-black/30 dark:text-white/30 hover:border-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Initialize
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[6px] font-black  tracking-widest px-1.5 py-0.5">
                    PRO
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobsPage;