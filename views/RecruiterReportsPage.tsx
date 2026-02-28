import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { readSessionUid } from '../authService';
import { ApplicationPayload, ApplicationStage } from '../applicationService';
import { Job } from '../types';
import Sidebar from '../components/Sidebar';

/* ── Types ── */
interface LiveApplication extends ApplicationPayload {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface LiveJob extends Job {
  recruiterId?: string;
  status?: 'open' | 'filled' | 'paused';
}

/* ── Helpers ── */
const STAGE_ORDER: ApplicationStage[] = [
  'submitted',
  'reviewing',
  'interview',
  'offer',
  'rejected',
];

const STAGE_LABELS: Record<ApplicationStage, string> = {
  submitted: 'Applied',
  reviewing: 'Reviewing',
  interview: 'Interview',
  offer:     'Offered',
  rejected:  'Rejected',
};

const STAGE_ICON: Record<ApplicationStage, string> = {
  submitted: 'send',
  reviewing: 'manage_search',
  interview: 'people',
  offer:     'handshake',
  rejected:  'cancel',
};

function daysSince(dateStr: string | Timestamp | undefined): number {
  if (!dateStr) return 0;
  const d =
    dateStr instanceof Timestamp
      ? dateStr.toDate()
      : new Date(dateStr as string);
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function timeAgo(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  const secs = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function activityIcon(app: LiveApplication): { icon: string; color: string } {
  if (app.stage === 'offer')     return { icon: 'handshake',     color: 'text-emerald-500' };
  if (app.stage === 'rejected')  return { icon: 'person_remove', color: 'text-red-500'     };
  if (app.stage === 'interview') return { icon: 'people',        color: 'text-blue-400'    };
  if (app.aiApplied)             return { icon: 'auto_awesome',  color: 'text-purple-400'  };
  return                                { icon: 'person_add',    color: 'opacity-40'       };
}

function activityLabel(app: LiveApplication): string {
  if (app.stage === 'offer')     return 'Offer extended';
  if (app.stage === 'rejected')  return 'Application closed';
  if (app.stage === 'interview') return 'Interview scheduled';
  if (app.aiApplied)             return 'Auto-matched & applied';
  return 'New application';
}

/* ════════════════════════════════════════════════════════════════
   RecruiterReportsPage — 100% real-time via Firestore onSnapshot
   Applications are always filtered to only currently-existing jobs,
   so deleting a job instantly removes it from all metrics.
════════════════════════════════════════════════════════════════ */
const RecruiterReportsPage: React.FC<{
  onToggleTheme: () => void;
  isDarkMode: boolean;
}> = ({ onToggleTheme, isDarkMode }) => {
  const [isMenuOpen, setIsMenuOpen]     = useState(false);
  const [activeTab, setActiveTab]       = useState<'funnel' | 'roles' | 'skills'>('funnel');
  const [applications, setApplications] = useState<LiveApplication[]>([]);
  const [jobs, setJobs]                 = useState<LiveJob[]>([]);
  const [loadingApps, setLoadingApps]   = useState(true);
  const [loadingJobs, setLoadingJobs]   = useState(true);

  const recruiterId = readSessionUid();

  /* ── Real-time: recruiter's applications ── */
  useEffect(() => {
    if (!recruiterId) return;
    const q = query(
      collection(db, 'applications'),
      where('recruiterId', '==', recruiterId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setApplications(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveApplication, 'id'>) }))
      );
      setLoadingApps(false);
    });
    return () => unsub();
  }, [recruiterId]);

  /* ── Real-time: recruiter's jobs ── */
  useEffect(() => {
    if (!recruiterId) return;
    const q = query(
      collection(db, 'jobs'),
      where('recruiterId', '==', recruiterId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setJobs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveJob, 'id'>) }))
      );
      setLoadingJobs(false);
    });
    return () => unsub();
  }, [recruiterId]);

  /* ════════════════════════════════════════════════════════════
     KEY FIX: Only count applications for jobs that still exist.
     When a job is deleted, its applications are orphaned in
     Firestore but should vanish from all metrics instantly.
  ════════════════════════════════════════════════════════════ */
  const activeJobIds = useMemo(
    () => new Set(jobs.map((j) => j.id)),
    [jobs]
  );

  const activeApplications = useMemo(
    () => applications.filter((a) => a.jobId && activeJobIds.has(a.jobId)),
    [applications, activeJobIds]
  );

  /* ════════════════════════════════════════════════════════════
     DERIVED METRICS — all use activeApplications
  ════════════════════════════════════════════════════════════ */

  /* Hiring funnel: each stage = everyone who reached AT LEAST that stage */
  const funnelStages = useMemo(() => {
    const active = activeApplications.filter((a) => a.stage !== 'rejected');
    const total  = activeApplications.length;
    return STAGE_ORDER.filter((s) => s !== 'rejected').map((stage) => {
      const reached = active.filter((a) => {
        const ai = STAGE_ORDER.indexOf(a.stage);
        const si = STAGE_ORDER.indexOf(stage);
        return ai >= si;
      }).length;
      return {
        stage,
        label: STAGE_LABELS[stage],
        icon:  STAGE_ICON[stage],
        count: reached,
        pct:   total > 0 ? Math.round((reached / total) * 100) : 0,
      };
    });
  }, [activeApplications]);

  /* Per-job stats */
  const jobStats = useMemo(() => {
    return jobs
      .map((job) => {
        const jobApps = activeApplications.filter((a) => a.jobId === job.id);
        const avgScore =
          jobApps.length > 0
            ? Math.round(jobApps.reduce((s, a) => s + (a.progress ?? 0), 0) / jobApps.length)
            : 0;
        return {
          ...job,
          applicants:   jobApps.length,
          avgScore,
          daysOpen:     daysSince(job.postedDate),
          isFilled:     job.status === 'filled',
          activeOffers: jobApps.filter((a) => a.stage === 'offer').length,
        };
      })
      .sort((a, b) => b.applicants - a.applicants);
  }, [jobs, activeApplications]);

  /* Source breakdown: AI vs manual */
  const sourceBreakdown = useMemo(() => {
    const total  = activeApplications.length;
    if (total === 0) return [];
    const ai     = activeApplications.filter((a) => a.aiApplied).length;
    const manual = total - ai;
    return [
      { label: 'Auto-Match (Asterix)', count: ai,     pct: Math.round((ai     / total) * 100), highlight: true  },
      { label: 'Manual Apply',         count: manual, pct: Math.round((manual / total) * 100), highlight: false },
    ];
  }, [activeApplications]);

  /* Top required skills by frequency across all live mandates */
  const skillDemand = useMemo(() => {
    const freq: Record<string, number> = {};
    jobs.forEach((j) => {
      (j.requiredSkills ?? []).forEach((s) => { freq[s] = (freq[s] ?? 0) + 1; });
    });
    const max = Math.max(...Object.values(freq), 1);
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([skill, count]) => ({ skill, count, pct: Math.round((count / max) * 100) }));
  }, [jobs]);

  /* Activity feed: most recent 8 active applications */
  const recentActivity = useMemo(() => {
    return [...activeApplications]
      .filter((a) => a.createdAt)
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      .slice(0, 8);
  }, [activeApplications]);

  /* Top-level KPIs — all from activeApplications */
  const totalApps     = activeApplications.length;
  const offeredCount  = activeApplications.filter((a) => a.stage === 'offer').length;
  const rejectedCount = activeApplications.filter((a) => a.stage === 'rejected').length;
  const placementRate = totalApps > 0 ? ((offeredCount / totalApps) * 100).toFixed(1) : '0';
  const openJobs      = jobs.filter((j) => j.status !== 'filled').length;
  const avgFill       = jobStats.length > 0
    ? Math.round(jobStats.reduce((s, j) => s + j.daysOpen, 0) / jobStats.length)
    : 0;

  const loading = loadingApps || loadingJobs;

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden font-display">
      <Sidebar role="recruiter" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 flex flex-col custom-scrollbar">

        {/* ── HEADER ── */}
        <header className="px-6 md:px-12 py-8 md:py-12 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 sticky top-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl z-[100]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 -ml-2">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <div className="text-[9px] font-black tracking-[0.5em] opacity-40 mb-1">Recruitment Analytics</div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter">Sourcing Intelligence</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`hidden md:flex items-center gap-2 px-4 py-2 border transition-all
              ${loading
                ? 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5'
                : 'border-emerald-500/30 bg-emerald-500/10'}`}>
              {loading
                ? <span className="material-symbols-outlined text-sm animate-spin opacity-40">autorenew</span>
                : <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
              <span className={`text-[8px] font-black tracking-widest ${loading ? 'opacity-40' : 'text-emerald-500'}`}>
                {loading ? 'Syncing...' : 'Live Data'}
              </span>
            </div>
            <button onClick={onToggleTheme} className="p-3 md:p-4 border border-black dark:border-white hover:invert transition-all">
              <span className="material-symbols-outlined text-lg">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </header>

        <div className="p-6 md:p-12 space-y-10 pb-24">

          {/* ── KPI STATS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-black dark:border-white/20">
            {[
              { label: 'Active Applicants', val: loading ? '…' : String(totalApps),             sub: 'Across live mandates',  icon: 'groups'      },
              { label: 'Offer Rate',        val: loading ? '…' : `${placementRate}%`,            sub: 'Applied → Offered',     icon: 'trending_up' },
              { label: 'Avg. Days Open',    val: loading ? '…' : avgFill ? `${avgFill}d` : '—', sub: 'Per mandate',           icon: 'schedule'    },
              { label: 'Open Mandates',     val: loading ? '…' : String(openJobs),               sub: `${jobs.length} total`,  icon: 'work'        },
            ].map((s, i) => (
              <div
                key={i}
                className="p-6 md:p-8 border-r last:border-0 border-b lg:border-b-0 border-black/5 dark:border-white/5 group hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[8px] font-black tracking-widest opacity-40 group-hover:opacity-60">{s.label}</p>
                  <span className="material-symbols-outlined text-base opacity-20 group-hover:opacity-60">{s.icon}</span>
                </div>
                <p className="text-3xl md:text-5xl font-black tracking-tighter">{s.val}</p>
                <p className="text-[8px] font-black tracking-widest opacity-30 mt-2">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── MAIN GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT: Tabbed analytics */}
            <div className="lg:col-span-8 space-y-6">

              {/* Tab switcher */}
              <div className="flex border border-black dark:border-white/20">
                {(['funnel', 'roles', 'skills'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-3 text-[9px] font-black tracking-widest transition-all
                      ${activeTab === tab
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-40 hover:opacity-100'}`}
                  >
                    {tab === 'funnel' ? 'Hiring Funnel' : tab === 'roles' ? 'Open Roles' : 'Skill Demand'}
                  </button>
                ))}
              </div>

              {/* ── TAB: Hiring Funnel ── */}
              {activeTab === 'funnel' && (
                <div className="border border-black dark:border-white/20 p-6 md:p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black tracking-[0.4em] opacity-40">Pipeline Conversion</h3>
                    <span className="text-[8px] font-black tracking-widest opacity-20">
                      {totalApps} active applicant{totalApps !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {totalApps === 0 && !loading ? (
                    <div className="py-16 flex flex-col items-center gap-3 opacity-20">
                      <span className="material-symbols-outlined text-4xl">inbox</span>
                      <span className="text-xs font-black tracking-widest">No applications on live mandates</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {funnelStages.map((stage, i) => (
                        <div key={stage.stage} className="group">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm opacity-40">{stage.icon}</span>
                              <span className="text-[9px] font-black tracking-widest">{stage.label}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-[8px] font-black tracking-widest opacity-40">
                                {stage.count} candidate{stage.count !== 1 ? 's' : ''}
                              </span>
                              <span className="text-[9px] font-black text-emerald-500 w-10 text-right">{stage.pct}%</span>
                            </div>
                          </div>
                          <div className="h-8 bg-black/5 dark:bg-white/5 relative overflow-hidden">
                            <div
                              className="h-full bg-black dark:bg-white group-hover:bg-emerald-500 transition-all duration-700"
                              style={{ width: `${stage.pct}%` }}
                            />
                            {i < funnelStages.length - 1 && stage.pct > 0 && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-black tracking-widest opacity-0 group-hover:opacity-100 transition-all text-white dark:text-black mix-blend-difference pointer-events-none">
                                {stage.pct - funnelStages[i + 1].pct}% drop-off →
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rejected callout */}
                  {rejectedCount > 0 && (
                    <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-red-500">cancel</span>
                        <span className="text-[8px] font-black tracking-widest text-red-500">Rejected / Closed</span>
                      </div>
                      <span className="text-[9px] font-black text-red-500">
                        {rejectedCount} applicant{rejectedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Open Roles ── */}
              {activeTab === 'roles' && (
                <div className="border border-black dark:border-white/20 divide-y divide-black/5 dark:divide-white/5">
                  {loadingJobs ? (
                    <div className="py-16 flex items-center justify-center gap-3 opacity-30">
                      <span className="material-symbols-outlined animate-spin">autorenew</span>
                      <span className="text-xs font-black tracking-widest">Loading mandates...</span>
                    </div>
                  ) : jobStats.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3 opacity-20">
                      <span className="material-symbols-outlined text-4xl">work_off</span>
                      <span className="text-xs font-black tracking-widest">No mandates published yet</span>
                    </div>
                  ) : (
                    jobStats.map((job) => (
                      <div
                        key={job.id}
                        className="p-6 md:p-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center group hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black tracking-tight truncate">{job.title}</h4>
                            {job.isFilled ? (
                              <span className="text-[7px] font-black tracking-widest px-2 py-0.5 bg-emerald-500 text-white shrink-0">Filled</span>
                            ) : (
                              <span className="text-[7px] font-black tracking-widest px-2 py-0.5 border border-black/20 dark:border-white/20 group-hover:border-white/40 shrink-0">Open</span>
                            )}
                            {job.activeOffers > 0 && (
                              <span className="text-[7px] font-black tracking-widest px-2 py-0.5 bg-blue-500/10 border border-blue-400/40 text-blue-500 shrink-0">
                                {job.activeOffers} offer{job.activeOffers !== 1 ? 's' : ''} out
                              </span>
                            )}
                          </div>
                          <p className="text-[8px] font-black tracking-widest opacity-40">
                            {job.applicants} applicant{job.applicants !== 1 ? 's' : ''} · {job.daysOpen}d open
                            {job.location?.city ? ` · ${job.location.city}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-6 shrink-0">
                          <div className="text-right">
                            <p className="text-[7px] font-black tracking-widest opacity-40">Avg Match</p>
                            <p className={`text-xl font-black ${job.avgScore >= 75 ? 'text-emerald-500' : ''}`}>
                              {job.applicants > 0 ? `${job.avgScore}%` : '—'}
                            </p>
                          </div>
                          <div className="w-20 h-2 bg-black/10 dark:bg-white/10 group-hover:bg-white/20 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${job.avgScore >= 75 ? 'bg-emerald-500' : 'bg-black dark:bg-white group-hover:bg-white dark:group-hover:bg-black'}`}
                              style={{ width: `${job.avgScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── TAB: Skill Demand ── */}
              {activeTab === 'skills' && (
                <div className="border border-black dark:border-white/20 p-6 md:p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black tracking-[0.4em] opacity-40">Required Skills — Frequency</h3>
                    <span className="text-[8px] font-black tracking-widest opacity-20">
                      Across {jobs.length} mandate{jobs.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {skillDemand.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3 opacity-20">
                      <span className="material-symbols-outlined text-4xl">psychology</span>
                      <span className="text-xs font-black tracking-widest">No skill data yet</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {skillDemand.map(({ skill, count, pct }) => (
                        <div key={skill} className="group">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[9px] font-black tracking-widest">{skill}</span>
                            <span className="text-[8px] font-black tracking-widest opacity-40">
                              {count} mandate{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="h-6 bg-black/5 dark:bg-white/5 overflow-hidden">
                            <div
                              className="h-full bg-black dark:bg-white group-hover:bg-emerald-500 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR */}
            <aside className="lg:col-span-4 space-y-6">

              {/* Source breakdown */}
              <div className="bg-black text-white dark:bg-white dark:text-black p-6 md:p-8 space-y-6">
                <h4 className="text-[10px] font-black tracking-[0.4em] opacity-60">Source Breakdown</h4>
                {sourceBreakdown.length === 0 ? (
                  <p className="text-[8px] font-black tracking-widest opacity-30">No data yet</p>
                ) : (
                  <div className="space-y-5">
                    {sourceBreakdown.map((s) => (
                      <div key={s.label} className="space-y-2">
                        <div className="flex justify-between text-[9px] font-black tracking-widest">
                          <span className={s.highlight ? 'text-emerald-400' : 'opacity-70'}>{s.label}</span>
                          <span>
                            {s.pct}%{' '}
                            <span className="opacity-40 text-[7px]">({s.count})</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 dark:bg-black/10">
                          <div
                            className={`h-full transition-all duration-700 ${s.highlight ? 'bg-emerald-400' : 'bg-white/40 dark:bg-black/40'}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[8px] font-black tracking-widest opacity-40 leading-relaxed border-t border-white/10 dark:border-black/10 pt-4">
                  {sourceBreakdown[0]?.pct >= 50
                    ? `Auto-Match is your strongest channel at ${sourceBreakdown[0]?.pct}%. Candidates sourced via Asterix carry higher profile fidelity.`
                    : 'Increase Auto-Match coverage by setting competitive match thresholds on your mandates.'}
                </p>
              </div>

              {/* Live activity feed */}
              <div className="border border-black dark:border-white/20 p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black tracking-[0.4em] opacity-40">Live Activity</h4>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {recentActivity.length === 0 && !loadingApps ? (
                  <div className="py-8 flex flex-col items-center gap-2 opacity-20">
                    <span className="material-symbols-outlined">notifications_none</span>
                    <span className="text-[8px] font-black tracking-widest">No activity yet</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((a) => {
                      const { icon, color } = activityIcon(a);
                      return (
                        <div key={a.id} className="flex gap-3">
                          <div className={`size-8 shrink-0 flex items-center justify-center bg-black/5 dark:bg-white/5 ${color}`}>
                            <span className="material-symbols-outlined text-sm">{icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black tracking-widest">{activityLabel(a)}</p>
                            <p className="text-[8px] font-black tracking-widest opacity-40 truncate mt-0.5">
                              {a.role} · {a.company}
                            </p>
                          </div>
                          <span className="text-[7px] font-black tracking-widest opacity-20 shrink-0 pt-0.5 whitespace-nowrap">
                            {timeAgo(a.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RecruiterReportsPage;
