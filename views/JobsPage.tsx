import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

import { subscribeToActiveJobs } from '../Jobservice';
import { Job } from '../types';
import { authService } from '../authService';
import { usePlan } from '../usePlan.ts';
import UpgradeModal from '../components/UpgradeModal';
import { getInterviewTips, InterviewTips } from '../geminiService';
import InterviewTipsModal from '../components/InterviewTipsModal';
import JobChatDrawer from '../components/JobChatDrawer';

import { calculateSemanticFidelityBackend, extractResumeText } from '../geminiService';
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

const JobsPage: React.FC<{ onToggleTheme: () => void, isDarkMode: boolean }> = ({ onToggleTheme, isDarkMode }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoPilotActive, setIsAutoPilotActive] = useState(() =>
    localStorage.getItem('asterix_autopilot') === 'true'
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [matchThreshold, setMatchThreshold] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const highlightedJobId = searchParams.get('jobId');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const [showFidelityFilter, setShowFidelityFilter] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dynamicJobs, setDynamicJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isVectorizing, setIsVectorizing] = useState(false);

  // ── Plan gating ─────────────────────────────────────────────
  const { canManualApply } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // ── Ace Interview States ────────────────────────────────────
  const [interviewTipsJob, setInterviewTipsJob] = useState<Job | null>(null);
  const [interviewTips, setInterviewTips] = useState<InterviewTips | null>(null);
  const [isLoadingTips, setIsLoadingTips] = useState(false);

  // ── AI Audit Chat State ─────────────────────────────────────
  const [chatDrawerJob, setChatDrawerJob] = useState<Job | null>(null);

  const fetchProfilePayload = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'profiles', uid));
      if (!snap.exists()) return { profileText: '', candidateSkills: [] };
      const data = snap.data();
      const candidateSkills = (data.skills ?? []).map((s: any) => ({ skill: (s.s ?? '').toLowerCase().trim(), weight: Number(s.l ?? 0) }));
      const profileText = [
        `Name: ${data.profile?.name ?? ''}`,
        `Title: ${data.profile?.title ?? ''}`,
        `About: ${data.profile?.manifesto ?? ''}`,
        `Skills: ${candidateSkills.map((s: any) => s.skill).join(', ')}`,
        `Experience:\n${(data.deployments ?? []).map((d: any) => `${d.role} at ${d.co} — ${d.desc}`).join('\n')}`,
        `Education: ${data.education ?? ''}`,
      ].join('\n');
      return { profileText, candidateSkills };
    } catch {
      return { profileText: '', candidateSkills: [] };
    }
  };

  const isSyncingRef = React.useRef(false);

  const performSemanticSync = async (force: boolean = false) => {
    if (isSyncingRef.current || isVectorizing) return;

    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    let resumeText = localStorage.getItem(`asterix_resume_content_${uid}`);

    try {
      isSyncingRef.current = true;
      setIsVectorizing(true);

      // ── IDENTITY RECOVERY ──
      let currentFingerprint = localStorage.getItem(`asterix_resume_hash_${uid}`) || '';

      try {
        const snap = await getDoc(doc(db, 'profiles', uid));
        const data = snap.data();

        if (data?.resumeFingerprint && data.resumeFingerprint !== currentFingerprint) {
          console.log("[JobsPage] New resume detected in vault. Updating identity...");
          resumeText = await extractResumeText(data.resumeUrl);
          localStorage.setItem(`asterix_resume_content_${uid}`, resumeText);
          localStorage.setItem(`asterix_resume_hash_${uid}`, data.resumeFingerprint);
          currentFingerprint = data.resumeFingerprint;
          force = true;
        } else if (!resumeText && data?.resumeUrl) {
          resumeText = await extractResumeText(data.resumeUrl);
          localStorage.setItem(`asterix_resume_content_${uid}`, resumeText);
        }
      } catch (err) {
        console.error("Vault recovery failed:", err);
      }

      if (!resumeText) {
        console.warn("[JobsPage] Sync aborted: No resume found.");
        return;
      }

      const { profileText, candidateSkills } = await fetchProfilePayload(uid);

      const jobsToScore = force
        ? dynamicJobs
        : dynamicJobs.filter(j => j.matchScore === undefined || j.analyzing);

      if (jobsToScore.length === 0) {
        console.log("[JobsPage] No new jobs to score.");
        return;
      }

      setDynamicJobs(prev => prev.map(j =>
        jobsToScore.some(ts => ts.id === j.id) ? { ...j, analyzing: true, matchScore: force ? 0 : j.matchScore } : j
      ));

      const CONCURRENCY_LIMIT = 3;
      const processJob = async (job: Job) => {
        try {
          const audit = await calculateSemanticFidelityBackend(null, job, profileText, candidateSkills, resumeText!);
          setDynamicJobs(prev => prev.map(j => j.id === job.id ? {
            ...j,
            matchScore: audit.fidelityScore,
            matchHighlights: audit.matchHighlights,
            breakdown: audit.breakdown,
            analyzing: false
          } : j));
        } catch (err) {
          console.error('Job sync failed:', job.id, err);
          setDynamicJobs(prev => prev.map(j => j.id === job.id ? { ...j, analyzing: false } : j));
        }
      };

      for (let i = 0; i < jobsToScore.length; i += CONCURRENCY_LIMIT) {
        const batch = jobsToScore.slice(i, i + CONCURRENCY_LIMIT).map(job => processJob(job));
        await Promise.all(batch);
      }

    } catch (err) {
      console.error("[JobsPage] Global sync error:", err);
    } finally {
      setIsVectorizing(false);
      isSyncingRef.current = false;
    }
  };

  const gateInteraction = () => {
    if (!userId) {
      setShowAuthPrompt(true);
      return true;
    }
    return false;
  };

  const handleAceInterview = async (job: Job) => {
    const uid = userId;
    const resumeText = uid ? (localStorage.getItem(`asterix_resume_content_${uid}`) || '') : '';

    if (!resumeText) {
      alert('Upload your resume in the Dashboard first to get interview tips.');
      return;
    }

    const jd = [job.jobSummary || '', ...(Array.isArray(job.responsibilities) ? job.responsibilities : [])].join(' ');

    setInterviewTipsJob(job);
    setInterviewTips(null);
    setIsLoadingTips(true);

    try {
      const tips = await getInterviewTips(resumeText, job.title, jd);
      setInterviewTips(tips);
    } catch (err) {
      console.error('AI Error', err);
      setInterviewTipsJob(null);
    } finally {
      setIsLoadingTips(false);
    }
  };

  const handleInitializeAutoPilot = () => {
    if (gateInteraction()) return;
    setIsAutoPilotActive(true);
    performSemanticSync();
  };

  useEffect(() => {
    if (isAutoPilotActive && !isLoadingJobs && dynamicJobs.length > 0 && !isVectorizing) {
      const anyUnscored = dynamicJobs.some(j => j.matchScore === undefined);
      if (anyUnscored) performSemanticSync();
    }
  }, [isAutoPilotActive, isLoadingJobs, dynamicJobs.length]);

  useEffect(() => {
    const initializeJobs = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) setUserId(user.uid);
      } catch (err) {
        console.error('Error initializing user:', err);
      }
    };

    const unsubPromise = initializeJobs();

    // ── GUEST ACCESS: Subscribe even if no user ──
    const unsubJobs = subscribeToActiveJobs(
      (liveJobs) => {
        const currentUid = auth.currentUser?.uid;
        let jobDataMap: any[] = [];
        if (currentUid) {
          const savedJobs = localStorage.getItem(`asterix_jobs_${currentUid}`);
          jobDataMap = savedJobs ? JSON.parse(savedJobs) : [];
        }

        const merged: Job[] = liveJobs.map(liveJob => {
          const savedData = Array.isArray(jobDataMap)
            ? jobDataMap.find((j: any) => j.id === liveJob.id)
            : jobDataMap[liveJob.id];

          return {
            ...liveJob,
            matchScore: savedData?.matchScore !== undefined ? savedData.matchScore : undefined,
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
        console.error('[JobsPage] Guest-ready jobs subscription error:', err);
        setIsLoadingJobs(false);
      }
    );

    return () => {
      unsubPromise?.then(() => { });
      unsubJobs();
    };
  }, []);

  useEffect(() => {
    if (userId && dynamicJobs.length > 0) {
      localStorage.setItem(`asterix_jobs_${userId}`, JSON.stringify(dynamicJobs));
    }
  }, [dynamicJobs, userId]);

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

  useEffect(() => {
    if (highlightedJobId && !isLoadingJobs && dynamicJobs.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`job-card-${highlightedJobId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightedJobId, isLoadingJobs, dynamicJobs.length]);

  // ── FILTERED JOBS ──────────────────────────────────────────
  // This is the source for both sections. 
  // We apply search, type, and threshold filters here.
  // Universe Feed: ONLY Admin Posted Jobs
  const filteredJobs = useMemo(() => {
    return dynamicJobs.filter(job => {
      if (!job.isAdminPosted) return false;

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

      const matchesThreshold = job.analyzing || (job.matchScore ?? 0) >= matchThreshold;

      return matchesText && matchesType && matchesThreshold;
    });
  }, [dynamicJobs, searchQuery, selectedTypes, matchThreshold]);

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
      <Sidebar
        role="candidate"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onAuthRequired={() => setShowAuthPrompt(true)}
      />

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
                  <button onClick={() => scrollToSection('all-jobs')} className="text-[9px] font-black  tracking-[0.25em] px-4 py-3 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-center">
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
                  onClick={handleInitializeAutoPilot}
                  className={`w-full py-3 text-[9px] font-black  tracking-widest border-2 border-white transition-all ${isAutoPilotActive ? 'bg-white text-emerald-500' : 'hover:bg-white hover:text-emerald-500'}`}
                >
                  {isAutoPilotActive ? '✓ System Active' : 'Initialize'}
                </button>
              </div>
            </div>
          </aside>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-16 custom-scrollbar">
            {isVectorizing && (
              <div className="fixed top-[73px] left-0 right-0 h-1 bg-black/5 dark:bg-white/5 z-20">
                <div className="absolute inset-0 bg-emerald-500 animate-marquee" style={{ width: '30%' }} />
              </div>
            )}


            {/* General Market Feed */}
            <section id="all-jobs" className="space-y-8 pb-32 scroll-mt-4">
              <div className="flex justify-between items-center border-b-2 border-black/10 dark:border-white/10 pb-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-4xl font-black  tracking-tighter opacity-40">Universe Feed</h2>
                  <p className="text-[9px] font-black  tracking-widest opacity-20">Full market inventory matching logic</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-[9px] font-black  tracking-widest opacity-30">
                    {isLoadingJobs ? '...' : `${filteredJobs.length} Positions Vetted`}
                  </div>
                  {!isLoadingJobs && (
                    <button
                      onClick={() => gateInteraction() ? null : performSemanticSync(true)}
                      disabled={isVectorizing}
                      className="px-3 py-1 border border-black/20 dark:border-white/20 text-[8px] font-black tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all uppercase"
                    >
                      {isVectorizing ? 'Syncing...' : 'Recalibrate'}
                    </button>
                  )}
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
                        navigate={navigate}
                        onAceInterview={() => { }} // Not used for universe feed
                        canManualApply={true}
                        onLockedClick={() => setShowUpgradeModal(true)}
                        onAIAudit={() => gateInteraction() ? null : setChatDrawerJob(job)}
                        isHighlighted={highlightedJobId === String(job.id)}
                        gateInteraction={gateInteraction}
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



      {/* UPGRADE MODAL */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

      <InterviewTipsModal
        isOpen={!!interviewTipsJob}
        jobTitle={interviewTipsJob?.title || ''}
        tips={interviewTips}
        isLoading={isLoadingTips}
        onClose={() => { setInterviewTipsJob(null); setInterviewTips(null); }}
      />

      {chatDrawerJob && (
        <JobChatDrawer job={chatDrawerJob} onClose={() => setChatDrawerJob(null)} />
      )}

      {/* GUEST AUTH PROMPT MODAL */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0a0a0a] border-2 border-black dark:border-white w-full max-w-md p-8 md:p-12 shadow-[20px_20px_0px_rgba(0,0,0,0.1)] dark:shadow-[20px_20px_0px_rgba(255,255,255,0.05)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

            <div className="space-y-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-emerald-500">
                  <span className="material-symbols-outlined text-3xl animate-pulse">auto_awesome</span>
                  <span className="text-[10px] font-black tracking-[0.4em] uppercase">Security Protocol</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-[0.85]">
                  READY TO <span className="text-emerald-500">APPLY?</span>
                </h2>
                <p className="text-sm font-bold tracking-tight text-black/60 dark:text-white/60 leading-relaxed">
                  Join 2,400+ members and unlock AI Mission Audits, Career Calibration, and fast-track job match routing.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full bg-black dark:bg-white text-white dark:text-black py-4 text-[11px] font-black tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                >
                  Create Identity
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full border-2 border-black dark:border-white text-black dark:text-white py-4 text-[11px] font-black tracking-[0.2em] uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                >
                  Existing Member
                </button>
              </div>

              <button
                onClick={() => setShowAuthPrompt(false)}
                className="w-full text-[9px] font-black tracking-widest text-black/30 dark:text-white/30 uppercase hover:text-black dark:hover:text-white transition-colors"
              >
                Continue Browsing as Guest
              </button>
            </div>

            {/* Aesthetic Background Elements */}
            <div className="absolute -bottom-10 -right-10 size-40 border border-black/[0.05] dark:border-white/[0.05] rounded-full group-hover:scale-110 transition-transform duration-700"></div>
            <div className="absolute -top-10 -left-10 size-24 border border-black/[0.05] dark:border-white/[0.05] rotate-45 group-hover:rotate-90 transition-transform duration-1000"></div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════
   JobCard UI — Specialized for JobsPage
   Shows different fidelity states for Best Fit vs Universe
════════════════════════════════════════════════════════ */
const JobCard: React.FC<{
  job: Job;
  navigate: any;
  onAceInterview: () => void;
  canManualApply: boolean;
  onLockedClick: () => void;
  onAIAudit: () => void;
  isHighlighted?: boolean;
  gateInteraction: () => boolean;
}> = ({ job, navigate, onAceInterview, canManualApply, onLockedClick, onAIAudit, isHighlighted, gateInteraction }) => {
  const handleShare = async () => {
    if (gateInteraction()) return;
    const company = typeof job.company === 'string' ? job.company : job.company?.name || 'Top Tier Co';
    const jobTitle = job.title || 'Exciting Position';

    // Hash-compatible URL for sharing
    const url = `${window.location.origin}/#/candidate/jobs?jobId=${job.id}`;

    // Professional message under 50 words
    const message = `Check out this opening for ${jobTitle} at ${company}! I thought you might be interested. View details and apply here: ${url} \n- Shared via Asterix Jobs`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${jobTitle} at ${company}`,
          text: message,
          url: url
        });
      } catch (err) {
        console.warn('Share failed or dismissed', err);
      }
    } else {
      await navigator.clipboard.writeText(message);
      alert('Professional share message copied to clipboard!');
    }
  };

  const score = job.matchScore ?? 0;
  const isApplied = job.applied;

  return (
    <div
      id={`job-card-${job.id}`}
      className={`
      relative border-2 transition-all duration-300 overflow-hidden
      bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#1a1a1a] border-l-[2px] border-l-black/10 dark:border-l-white/10
      ${isHighlighted ? 'blink-highlight scale-[1.02] z-10' : ''}
    `}>
      {/* ── HEADER ROW ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Company Box & Title Cluster */}
        <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
          <div className="size-12 sm:size-16 bg-black dark:bg-white flex items-center justify-center shrink-0 border border-black/10 dark:border-white/10">
            <span className="material-symbols-outlined text-2xl sm:text-3xl text-white dark:text-black">corporate_fare</span>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-xl font-black text-black dark:text-white uppercase tracking-tight leading-tight truncate">
              {job.title ?? 'Untitled Position'}
            </h2>
            <p className="text-[9px] sm:text-[10px] font-black tracking-widest text-black/40 dark:text-white/40 mt-1 uppercase truncate">
              {typeof job.company === 'string' ? job.company : (job.company?.name ?? 'Unknown')} · {typeof job.location === 'string' ? job.location : (job.location?.city ?? 'Remote')}
            </p>
          </div>
        </div>

        {/* Score Cluster */}
        {(job.matchScore !== undefined || job.analyzing) && (
          <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 w-full sm:w-auto pt-2 sm:pt-0 border-t border-black/5 dark:border-white/5 sm:border-0">
            {job.analyzing ? (
              <div className="text-lg sm:text-2xl font-black text-[#ffb800] animate-pulse">Scanning...</div>
            ) : (
              <>
                <div className="text-2xl sm:text-4xl font-black tabular-nums text-[#ffb800] leading-none">
                  {score}%
                </div>
                <div className="text-[7px] font-black tracking-[0.4em] text-black/30 dark:text-white/30 mt-1 uppercase">Match</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── META INFO ROW ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 pb-4 border-b border-black/5 dark:border-white/5 gap-4">
        {/* Skills */}
        <div className="flex flex-wrap gap-2">
          {(job.requiredSkills ?? []).slice(0, 4).map(skill => (
            <span key={skill} className="px-2 sm:px-3 py-1 bg-gray-100 dark:bg-[#141414] border border-black/5 dark:border-white/5 text-[8px] sm:text-[9px] font-black text-black/60 dark:text-white/60 tracking-wider">
              {skill}
            </span>
          ))}
        </div>

        {/* Economic / Engagement Meta */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[8px] sm:text-[9px] font-black text-black/30 dark:text-white/30 tracking-widest uppercase truncate max-w-[120px] sm:max-w-none">
              INR {(job.salaryRange?.min ?? 0)}-{(job.salaryRange?.max ?? 0)}L
            </span>
          </div>
          <div className="px-2 py-0.5 border border-black/10 dark:border-white/10 text-[8px] sm:text-[9px] font-black text-black/40 dark:text-white/40 tracking-widest uppercase bg-gray-100 dark:bg-[#141414] whitespace-nowrap">
            {job.employmentType ?? 'Full-Time'}
          </div>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      {(job.matchScore !== undefined || job.analyzing) && (
        <div className="h-[2px] w-full bg-black/5 dark:bg-white/5">
          <div
            className={`h-full transition-all duration-1000 ease-out ${job.analyzing ? 'bg-emerald-500 animate-marquee' : 'bg-[#ffb800]'}`}
            style={{ width: job.analyzing ? '30%' : `${score}%` }}
          />
        </div>
      )}

      {/* ── ACTION FOOTER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 bg-gray-50 dark:bg-[#0f0f0f] gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Share */}
          <button
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
            className="size-10 sm:size-11 flex items-center justify-center border border-black/10 dark:border-white/10 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-all bg-white dark:bg-[#0a0a0a]"
          >
            <span className="material-symbols-outlined text-lg">share</span>
          </button>

          {/* AI Audit */}
          <button
            onClick={(e) => { e.stopPropagation(); onAIAudit(); }}
            className="px-4 py-2 flex items-center gap-2 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all font-bold tracking-widest text-[9px] uppercase hover:shadow-lg"
          >
            <span className="material-symbols-outlined text-sm">robot_2</span>
            AI Audit
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isApplied ? (
            <div className={`flex items-center gap-2 justify-center px-5 py-3 sm:py-2.5 text-[9px] sm:text-[10px] font-black tracking-widest uppercase w-full sm:w-auto
              ${job.isAdminPosted ? 'bg-indigo-600 text-white' : 'bg-[#00d1a0] text-white dark:text-black'}`}>
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Applied
            </div>
          ) : (
            <button
              onClick={() => {
                if (gateInteraction()) return;
                canManualApply ? navigate(`/job/${job.id}`, { state: { job } }) : onLockedClick();
              }}
              className={`flex items-center gap-2 justify-center px-6 sm:px-8 py-3 sm:py-2.5 text-[9px] sm:text-[10px] font-black tracking-widest transition-all uppercase w-full sm:w-auto
                ${canManualApply ? 'bg-black text-white dark:bg-white dark:text-black hover:opacity-80 shadow-xl' : 'border border-black/20 dark:border-white/20 text-black/40 dark:text-white/40 hover:border-[#ffb800] hover:text-[#ffb800]'}`}
            >
              {!canManualApply && <span className="material-symbols-outlined text-base">lock</span>}
              View Protocol
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobsPage;