import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToActiveJobs } from '../Jobservice';
import Sidebar from '../components/Sidebar';
import { getAIInsights, getDetailedSkillAudit, getMatchingSummary } from '../geminiService';
import { useLocation } from 'react-router-dom';
import { authService, readSessionUid } from '../authService';
import { saveApplication, buildApplicationPayload, hasApplied as checkAlreadyApplied } from '../applicationService';
import { usePlan } from '../usePlan.ts';
import UpgradeModal from '../components/UpgradeModal';


const JobDetailsPage: React.FC<{ onToggleTheme: () => void, isDarkMode: boolean }> = ({ onToggleTheme, isDarkMode }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isApplying, setIsApplying] = useState(false);
  const [appliedLocally, setAppliedLocally] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [interviewPrep, setInterviewPrep] = useState<string[]>([]);
  const [isLoadingPrep, setIsLoadingPrep] = useState(true);
  const [skillAudit, setSkillAudit] = useState<{ tag: string, score: number }[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const passedJob = location.state?.job;
  const [job, setJob] = useState<any>(passedJob || null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  // ── Plan gating ─────────────────────────────────────────────
  const { canManualApply, isLoading: isPlanLoading } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const fetchResumeUrl = async () => {
      try {
        const { authService } = await import('../authService');
        const user = await authService.getCurrentUser();
        if (!user) return;

        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const snap = await getDoc(doc(db, 'profiles', user.uid));
        if (snap.exists() && snap.data().resumeUrl) {
          setResumeUrl(snap.data().resumeUrl);
        }
      } catch (err) {
        console.error('Failed to fetch resumeUrl', err);
      }
    };
    fetchResumeUrl();
  }, []);

  useEffect(() => {
    if (!job) {
      const loadJob = async () => {
        try {
          const liveJobs: any[] = [];
          const unsub = subscribeToActiveJobs(
            (jobs) => { liveJobs.push(...jobs); },
            (err) => console.error('Error fetching live jobs:', err)
          );
          await new Promise(resolve => setTimeout(resolve, 500));
          unsub();

          const found = liveJobs.find((j: any) => String(j.id) === String(id));
          if (found) { setJob(found); return; }

          const user = await authService.getCurrentUser();
          const key = user?.uid ? `asterix_jobs_${user.uid}` : 'asterix_jobs_guest';
          const saved = localStorage.getItem(key);
          const jobsList = saved ? JSON.parse(saved) : [];
          const foundLocal = jobsList.find((j: any) => String(j.id) === String(id));
          setJob(foundLocal || null);
        } catch (e) {
          console.error('Failed to load job', e);
          setJob(null);
        }
      };
      loadJob();
    }
  }, [id, job]);

  useEffect(() => {
    const checkApplied = async () => {
      if (!job) return;
      const user = await authService.getCurrentUser();
      if (!user) return;

      const already = await checkAlreadyApplied(user.uid, String(job.id));
      if (already) { setAppliedLocally(true); return; }

      const saved = localStorage.getItem(`asterix_jobs_${user.uid}`);
      if (saved) {
        try {
          const jobs = JSON.parse(saved);
          const match = jobs.find((j: any) => String(j.id) === String(job.id));
          if (match?.applied) setAppliedLocally(true);
        } catch (_) { }
      }
    };
    checkApplied();
  }, [job]);

  const uid = readSessionUid();

  const resumeName = uid ? (localStorage.getItem(`asterix_resume_name_${uid}`) || localStorage.getItem('asterix_resume_name') || 'Guest') : (localStorage.getItem('asterix_resume_name') || 'Guest');
  const resumeContent = uid ? (localStorage.getItem(`asterix_resume_content_${uid}`) || localStorage.getItem('asterix_resume_content') || '') : (localStorage.getItem('asterix_resume_content') || '');

  useEffect(() => {
    const fetchAuditData = async (force: boolean = false) => {
      if (job) {
        setIsLoadingPrep(true);
        try {
          let skillsToAudit = Array.from(new Set([...(job.techStack || []), ...(job.requiredSkills || [])]));
          const jobDesc = `${job.title}\n\n${job.jobSummary || job.description || ''}`;
          
          if (skillsToAudit.length === 0 && jobDesc.trim().length > 10) {
            try {
              const summaryData = await getMatchingSummary(jobDesc);
              if (summaryData && Array.isArray(summaryData.requirements)) {
                skillsToAudit = summaryData.requirements;
              }
            } catch (err) {
              console.error("Fallback skill audit failed", err);
            }
          }

          // Pass forceRefresh parameter to getAIInsights
          const [insights, detailedAudit] = await Promise.all([
            getAIInsights(resumeName, job.title ?? 'Position', jobDesc, resumeContent, force),
            getDetailedSkillAudit(resumeContent, skillsToAudit)
          ]);
          setInterviewPrep(insights);
          setSkillAudit(detailedAudit);
        } catch (e) {
          console.error("Audit failed", e);
        } finally {
          setIsLoadingPrep(false);
        }
      }
    };
    fetchAuditData();
  }, [job, resumeName, resumeContent]);

  if (!job) {
    return (
      <div className="p-20 text-center">
        <h2 className="text-xl font-bold">Mandate Not Found</h2>
        <button onClick={() => navigate("/candidate")} className="mt-4 border px-4 py-2">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleApply = async () => {
    // ── Plan check first ──
    // Plan check usually goes here, but we are keeping it open on this page

    if (appliedLocally || isApplying) return;

    // ── External Admin Job Handling ──
    if (job.isAdminPosted && job.externalUrl) {
      window.open(job.externalUrl, '_blank');
      setAppliedLocally(true);
      return;
    }

    setIsApplying(true);
    setApplyError(null);

    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error("Not logged in — please sign in to apply.");

      const jobIdStr = String(job.id);
      const already = await checkAlreadyApplied(user.uid, jobIdStr);

      if (!already) {
        const payload = buildApplicationPayload(user.uid, job, job.matchScore ?? 0, false, resumeUrl || undefined);
        await saveApplication(payload);
      }

      try {
        const saved = localStorage.getItem(`asterix_jobs_${user.uid}`);
        if (saved) {
          const jobs = JSON.parse(saved);
          const updated = jobs.map((j: any) =>
            String(j.id) === jobIdStr ? { ...j, applied: true } : j
          );
          localStorage.setItem(`asterix_jobs_${user.uid}`, JSON.stringify(updated));
        }
      } catch (_) { }

      setAppliedLocally(true);

    } catch (err: any) {
      console.error('[handleApply] Failed:', err);
      setApplyError(err?.message ?? 'Application failed. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const toggleCheck = (item: string) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const formatSalary = () => {
    if (job?.salaryRange) {
      const { min, max, currency } = job.salaryRange;
      const formatNumber = (num: number) => {
        if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
        return num.toString();
      };
      return `${currency ?? ''} ${formatNumber(min ?? 0)} - ${formatNumber(max ?? 0)}`;
    }
    return job?.salary ?? 'Not specified';
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden font-display">
      <Sidebar role="candidate" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 flex flex-col custom-scrollbar relative">
        <header className="px-4 md:px-8 py-3 md:py-4 border-b border-black dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 text-black dark:text-white group shrink-0">
              <span className="material-symbols-outlined text-lg group-hover:scale-125 transition-transform">west</span>
            </button>
            <div className="h-5 w-px bg-black/10 dark:bg-white/10 shrink-0"></div>
            <div className="text-[8px] md:text-[9px] font-black tracking-[0.2em] opacity-40 truncate">
              MANDATE_ID: {(job?.id ?? '').toString().toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggleTheme} className="p-2 border border-black dark:border-white hover:invert transition-all">
              <span className="material-symbols-outlined text-base">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 border border-black dark:border-white">
              <span className="material-symbols-outlined text-base">menu</span>
            </button>
          </div>
        </header>

        <div className="pb-48 md:pb-40">
          {/* Hero */}
          <div className="relative px-4 md:px-8 py-6 md:py-12 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-[#826BF0] text-white px-2 py-0.5 text-[7px] font-black tracking-widest">
                    {job?.department ?? 'Priority Recruitment'}
                  </span>
                  <span className="text-[7px] font-black tracking-widest opacity-40">
                    {job?.employmentType ?? 'Full-time'} • {job?.experienceRequired ?? '0-2 Years'}
                  </span>
                  {/* Plan badge in hero */}
                  {/* Hero badge removed to keep view clean for open applications */}
                </div>
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-[0.85] break-words">
                  {job?.title ?? 'Position'}
                </h1>
                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="size-7 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-[8px]">
                      {(typeof job?.company === 'string' ? job.company : job?.company?.name ?? 'CO').substring(0, 2)}
                    </div>
                    <span className="text-base md:text-lg font-black tracking-tight">
                      {typeof job?.company === 'string' ? job.company : (job?.company?.name ?? 'Unknown')}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-black/10 dark:bg-white/10"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm opacity-40">location_on</span>
                    <span className="text-sm md:text-base font-black tracking-tight opacity-40">
                      {typeof job?.location === 'string' ? job.location : (job?.location?.city ?? 'Remote')}
                      {job?.location?.type && ` • ${job.location.type}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col items-start lg:items-end gap-1">
                <div className="text-4xl md:text-5xl lg:text-6xl font-black leading-none text-[#826BF0] tracking-tighter">
                  {job?.matchScore ?? 0}%
                </div>
                <div className="text-[8px] md:text-[9px] font-black tracking-[0.3em] opacity-40 lg:text-right">
                  Neural Fidelity
                </div>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="px-4 md:px-8 py-6 md:py-12 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
            <div className="lg:col-span-8 space-y-12 md:space-y-16">

              <section className="space-y-5">
                <div className="border-b border-black dark:border-white pb-3">
                  <h3 className="text-[9px] md:text-[10px] font-black tracking-[0.3em]">01 / Job Summary</h3>
                </div>
                <p className="text-base md:text-lg font-medium tracking-tight leading-snug text-black/90 dark:text-white/95 whitespace-pre-wrap">
                  {job?.jobSummary || job?.description || 'No description available. Please click Apply to view the original posting.'}
                </p>
              </section>

              {job?.responsibilities && Array.isArray(job.responsibilities) && job.responsibilities.length > 0 && (
                <section className="space-y-5">
                  <div className="border-b border-black dark:border-white pb-3">
                    <h3 className="text-[9px] md:text-[10px] font-black tracking-[0.3em]">02 / Key Responsibilities</h3>
                  </div>
                  <ul className="space-y-3">
                    {job.responsibilities.map((item: string, i: number) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="text-[#826BF0] font-black text-xs shrink-0 mt-1">→</span>
                        <span className="text-sm md:text-base font-medium tracking-tight leading-relaxed">{item ?? ''}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="space-y-6">
                <div className="border-b border-black dark:border-white pb-3">
                  <h3 className="text-[9px] md:text-[10px] font-black tracking-[0.3em]">03 / Technical Mastery Audit</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isLoadingPrep ? (
                    <div className="col-span-full py-12 text-center animate-pulse border border-dashed border-black/10">
                      <p className="text-[8px] font-black tracking-[0.3em] opacity-40">Evaluating Technical Nodes...</p>
                    </div>
                  ) : skillAudit.length > 0 ? (
                    skillAudit.map(({ tag, score }) => (
                      <div key={tag} className="bg-white dark:bg-[#0c0c0c] border border-black dark:border-white/10 p-5 md:p-6 space-y-6 group hover:border-black dark:hover:border-white transition-all shadow-sm">
                        <div className="flex justify-between items-start gap-3">
                          <h4 className="text-xl md:text-2xl font-black tracking-tighter leading-none break-words">{tag ?? ''}</h4>
                          <span className="material-symbols-outlined text-lg opacity-20 group-hover:opacity-100 group-hover:text-[#826BF0] transition-all shrink-0">shield_with_heart</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-[7px] md:text-[8px] font-black tracking-[0.15em] opacity-40">Skill Match Rate</span>
                            <span className="text-xs md:text-sm font-black">{score ?? 0}%</span>
                          </div>
                          <div className="w-full h-[2px] bg-black/5 dark:bg-white/5 relative">
                            <div className={`h-full transition-all duration-1000 ease-out ${(score ?? 0) > 70 ? 'bg-[#826BF0] shadow-[0_0_8px_rgba(130,107,240,0.3)]' : 'bg-amber-500'}`} style={{ width: `${score ?? 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center border border-dashed border-black/10">
                      <p className="text-[8px] font-black tracking-[0.3em] opacity-40">No skill audit data available</p>
                    </div>
                  )}
                </div>
              </section>

              {job?.requiredSkills && Array.isArray(job.requiredSkills) && job.requiredSkills.length > 0 && (
                <section className="space-y-5">
                  <div className="border-b border-black dark:border-white pb-3">
                    <h3 className="text-[9px] md:text-[10px] font-black tracking-[0.3em]">04 / Required Skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(job.requiredSkills ?? []).map((skill: string) => (
                      <span key={skill} className="px-3 py-1.5 border border-black dark:border-white text-[9px] md:text-[10px] font-black tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">{skill ?? ''}</span>
                    ))}
                  </div>
                </section>
              )}

              {job?.preferredSkills && Array.isArray(job.preferredSkills) && job.preferredSkills.length > 0 && (
                <section className="space-y-5">
                  <div className="border-b border-black dark:border-white pb-3">
                    <h3 className="text-[9px] md:text-[10px] font-black tracking-[0.3em]">05 / Preferred Skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(job.preferredSkills ?? []).map((skill: string) => (
                      <span key={skill} className="px-3 py-1.5 border border-black/30 dark:border-white/30 text-[9px] md:text-[10px] font-black tracking-widest opacity-60 hover:opacity-100 hover:border-black dark:hover:border-white transition-all">{skill ?? ''}</span>
                    ))}
                  </div>
                </section>
              )}

              {job?.hiringProcess && Array.isArray(job.hiringProcess) && job.hiringProcess.length > 0 && (
                <section className="space-y-5">
                  <div className="border-b border-black dark:border-white pb-3">
                    <h3 className="text-[9px] md:text-[10px] font-black tracking-[0.3em]">06 / Hiring Process</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {job.hiringProcess.map((step: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="size-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                        <span className="text-[10px] md:text-xs font-black tracking-wide">{step ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="lg:col-span-4 space-y-10">
              {job?.company?.name && (
                <div className="border-2 border-black dark:border-white p-5 space-y-4">
                  <h4 className="text-[9px] font-black tracking-[0.3em]">Company Details</h4>
                  <div className="space-y-3 text-xs">
                    {job.company.industry && <div className="flex justify-between"><span className="opacity-40 font-black text-[8px]">Industry</span><span className="font-bold">{job.company.industry}</span></div>}
                    {job.company.size && <div className="flex justify-between"><span className="opacity-40 font-black text-[8px]">Size</span><span className="font-bold">{job.company.size}</span></div>}
                    {job.company.founded && <div className="flex justify-between"><span className="opacity-40 font-black text-[8px]">Founded</span><span className="font-bold">{job.company.founded}</span></div>}
                    {job.company.headquarters && <div className="flex justify-between"><span className="opacity-40 font-black text-[8px]">HQ</span><span className="font-bold">{job.company.headquarters}</span></div>}
                  </div>
                </div>
              )}

              <div className="bg-black text-white dark:bg-white dark:text-black p-6 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 text-[#826BF0]">
                  <span className="material-symbols-outlined animate-pulse text-lg">insights</span>
                  <h4 className="text-[8px] font-black tracking-[0.3em]">Audit Intelligence</h4>
                </div>
                {isLoadingPrep ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/10 dark:bg-black/10 rounded"></div>)}
                  </div>
                ) : (
                  <ul className="space-y-5">
                    {interviewPrep.map((tip, i) => (
                      <li key={i} className="space-y-1.5">
                        <p className="text-[7px] font-black tracking-widest opacity-40">Protocol 0{i + 1}</p>
                        <p className="text-[10px] md:text-xs font-black tracking-widest leading-relaxed">{tip ?? ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {job?.benefits && Array.isArray(job.benefits) && job.benefits.length > 0 && (
                <div className="space-y-5">
                  <h4 className="text-[8px] font-black tracking-[0.3em] opacity-40">Benefits & Perks</h4>
                  <div className="space-y-2">
                    {job.benefits.map((benefit: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 border border-black/10 dark:border-white/10 p-3">
                        <span className="material-symbols-outlined text-[#826BF0] text-sm">check_circle</span>
                        <span className="text-[9px] md:text-[10px] font-black tracking-wide">{benefit ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <h4 className="text-[8px] font-black tracking-[0.3em] opacity-40">Vetting Checklist</h4>
                <div className="space-y-3">
                  {['Review Case Study', 'Validate Tech Stack', 'Company Research'].map(item => (
                    <div key={item} onClick={() => toggleCheck(item)} className={`flex items-center gap-3 group cursor-pointer border border-black/5 dark:border-white/5 p-3 transition-all ${checkedItems[item] ? 'bg-[#826BF0]/5 border-[#826BF0]' : 'hover:bg-black/5'}`}>
                      <div className={`size-5 border border-black dark:border-white flex items-center justify-center transition-all shrink-0 ${checkedItems[item] ? 'bg-[#826BF0] border-[#826BF0]' : 'opacity-20'}`}>
                        {checkedItems[item] && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                      </div>
                      <span className={`text-[9px] md:text-[10px] font-black tracking-widest ${checkedItems[item] ? 'opacity-100' : 'opacity-40'}`}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Floating Terminal */}
        <div className="fixed bottom-0 left-0 right-0 z-[300] md:left-64 pointer-events-none p-3 md:p-6">
          <div className="max-w-4xl mx-auto pointer-events-auto bg-white dark:bg-background-dark border-2 border-black dark:border-white/30 shadow-[0_-20px_60px_rgba(0,0,0,0.15)] p-4 md:p-6">

            {applyError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500 text-red-500 text-[9px] font-black tracking-widest">
                ⚠ {applyError}
              </div>
            )}

            {/* Free plan banner */}
            {/* Manual apply is open on this page */}

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 md:gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-6 flex-1 min-w-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-black tracking-[0.25em] opacity-40">Salary Range</span>
                  <span className="text-[9px] md:text-[10px] font-black text-[#826BF0]">{formatSalary()}</span>
                </div>
                <div className="hidden sm:block h-8 w-px bg-black/10 dark:bg-white/10 shrink-0"></div>
                <div className="flex flex-col gap-0.5 overflow-hidden flex-1 min-w-0">
                  <span className="text-[7px] font-black tracking-[0.25em] opacity-40">Openings</span>
                  <span className="text-[9px] md:text-[10px] font-black">
                    {(job?.openings ?? 1)} Position{((job?.openings ?? 1) > 1) ? 's' : ''}
                  </span>
                </div>
                {job?.applicationDeadline && (
                  <>
                    <div className="hidden sm:block h-8 w-px bg-black/10 dark:bg-white/10 shrink-0"></div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[7px] font-black tracking-[0.25em] opacity-40">Deadline</span>
                      <span className="text-[9px] md:text-[10px] font-black">{new Date(job.applicationDeadline).toLocaleDateString()}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 w-full lg:w-auto">


                {/* ── Plan-gated apply button ── */}
                {appliedLocally ? (
                  <button
                    disabled
                    className={`flex-1 lg:flex-none px-8 py-2.5 text-[8px] md:text-[9px] font-black tracking-wider text-white cursor-default shadow-lg flex items-center justify-center gap-2
                      ${job.isAdminPosted ? 'bg-[#826BF0]' : 'bg-[#826BF0]'}`}
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {job.isAdminPosted ? 'Applied' : 'Synced'}
                  </button>
                ) : job.isAdminPosted && job.externalUrl ? (
                  <button
                    onClick={handleApply}
                    className="flex-1 lg:flex-none px-12 py-2.5 text-[8px] md:text-[9px] font-black tracking-wider bg-[#826BF0] text-white hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">external_link</span>
                    Apply on External Site
                  </button>
                ) : (
                  <button
                    disabled={isApplying}
                    onClick={handleApply}
                    className={`
                      flex-1 lg:flex-none px-6 py-2.5 text-[8px] md:text-[9px] font-black tracking-wider transition-all shadow-lg
                      ${isApplying
                        ? 'bg-black/50 dark:bg-white/50 text-white dark:text-black cursor-wait'
                        : applyError
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105'
                      }
                    `}
                  >
                    {isApplying ? 'Processing...' : applyError ? 'Retry' : 'Initialize'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* UPGRADE MODAL */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
};

export default JobDetailsPage;
