import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { readSessionUid } from '../authService';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore';

/* ================= TYPES ================= */

interface PostedJob {
  id: string;
  title: string;
  department?: string;
  employmentType?: string;
  status: 'active' | 'closed' | 'draft';
  createdAt: Timestamp | null;
  applicationDeadline?: string | null;
  applicationCount?: number;
  matchThreshold?: number;
  company?: { name?: string } | string;
  location?: { city?: string; type?: string; remoteAllowed?: boolean } | string;
  salaryRange?: { min?: number | null; max?: number | null; currency?: string };
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
}

interface Application {
  id: string;
  jobId: string;
  candidateUid: string;
  matchScore: number;
  autoApplied: boolean;
  appliedAt: Timestamp | null;
  candidateName?: string;
  candidateTitle?: string;
  candidateSkills?: string[];
  candidateEmail?: string;
  candidateManifesto?: string;
  candidateEducation?: string;
  candidateExperience?: Array<{ role: string; co: string; desc: string; date?: string }>;
  resumeUrl?: string;
  status?: 'Submitted' | 'shortlisted' | 'rejected';
  stage?: string;
  shortlistedAt?: Timestamp;
  rejectedAt?: Timestamp;
}

type View = 'jobs' | 'applicants';
type DetailTab = 'profile' | 'resume';

/* ================= HELPERS ================= */

function resolveLocation(location?: { city?: string; type?: string } | string): string {
  if (!location) return '—';
  if (typeof location === 'string') return location;
  return [location.city, location.type].filter(Boolean).join(' · ') || '—';
}

function resolveCompany(company?: { name?: string } | string): string {
  if (!company) return '—';
  if (typeof company === 'string') return company;
  return company.name ?? '—';
}

function resolveSalary(job: PostedJob): string {
  const range = job.salaryRange;
  if (range?.min || range?.max) {
    const cur = range.currency ?? '$';
    const lo = range.min ? Number(range.min).toLocaleString() : '?';
    const hi = range.max ? Number(range.max).toLocaleString() : '?';
    return `${cur} ${lo} – ${cur} ${hi}`;
  }
  if (job.salaryMin || job.salaryMax) {
    const cur = job.currency ?? '$';
    return `${cur} ${(job.salaryMin ?? 0).toLocaleString()} – ${cur} ${(job.salaryMax ?? 0).toLocaleString()}`;
  }
  return '';
}

/* ================= COMPONENT ================= */

const RecruiterDashboard: React.FC<{ onToggleTheme: () => void; isDarkMode: boolean; isPremium?: boolean }> = ({
  onToggleTheme,
  isDarkMode,
  isPremium = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState<View>('jobs');
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<PostedJob | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [recruiterId, setRecruiterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('profile');
  const [actionInProgress, setActionInProgress] = useState<'shortlist' | 'pass' | 'restore' | 'message' | null>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ── Auth ──────────────────────────────────────────────────── */
  useEffect(() => {
    setRecruiterId(readSessionUid());
  }, []);

  /* ── Jobs listener ─────────────────────────────────────────── */
  useEffect(() => {
    if (!recruiterId) {
      setLoadingJobs(false);
      return;
    }
    setLoadingJobs(true);

    const q = query(collection(db, 'jobs'), where('recruiterId', '==', recruiterId));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const jobs: PostedJob[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PostedJob, 'id'>),
        }));

        jobs.sort((a, b) => {
          const ta = (a.createdAt as any)?.seconds ?? 0;
          const tb = (b.createdAt as any)?.seconds ?? 0;
          return tb - ta;
        });

        const withCounts = await Promise.all(
          jobs.map(async (job) => {
            const appQuery = query(collection(db, 'applications'), where('jobId', '==', job.id));
            const countSnap = await getCountFromServer(appQuery).catch(() => null);
            return { ...job, applicationCount: countSnap?.data().count ?? 0 };
          })
        );

        setPostedJobs(withCounts);
        setLoadingJobs(false);
      },
      (err) => {
        console.error('[RecruiterDashboard] Jobs error:', err.message);
        setLoadingJobs(false);
      }
    );

    return () => unsub();
  }, [recruiterId]);

  /* ── Applicants listener ───────────────────────────────────── */
  useEffect(() => {
    if (!selectedJob) return;
    setLoadingApplicants(true);
    setApplications([]);

    const q = query(collection(db, 'applications'), where('jobId', '==', selectedJob.id));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const raw = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Application, 'id'>),
          autoApplied: Boolean((d.data() as any).aiApplied ?? (d.data() as any).autoApplied),
        }));

        const hydrated = await Promise.all(
          raw.map(async (app) => {
            const appMatchScore =
              typeof app.matchScore === 'number'
                ? app.matchScore
                : typeof (app as any).progress === 'number'
                  ? (app as any).progress
                  : 0;

            try {
              if (!app.candidateUid) throw new Error('Missing candidateUid');
              const pSnap = await getDoc(doc(db, 'profiles', app.candidateUid));

              if (!pSnap.exists()) {
                return {
                  ...app,
                  matchScore: appMatchScore,
                  candidateName: app.candidateName || `Candidate (${app.candidateUid.slice(0, 6)})`,
                  status: (app.status ?? 'Submitted') as Application['status'],
                };
              }

              const p = pSnap.data() as any;

              // 🔥 Safe string extraction
              const resolvedName =
                (p.profile?.name && typeof p.profile.name === 'string' ? p.profile.name.trim() : '') ||
                (app.candidateName && typeof app.candidateName === 'string' ? app.candidateName.trim() : '') ||
                `Candidate (${app.candidateUid.slice(0, 6)})`;

              // 🔥 Safe skills extraction
              const candidateSkills = Array.isArray(p.skills)
                ? p.skills
                  .map((s: any) => {
                    try {
                      if (!s) return '';
                      const skillValue = s?.s ?? s?.skill ?? '';
                      return (typeof skillValue === 'string' ? skillValue : String(skillValue)).trim();
                    } catch {
                      return '';
                    }
                  })
                  .filter((s: string) => s && s.length > 0)
                : [];

              return {
                ...app,
                matchScore: appMatchScore,
                candidateName: resolvedName,
                candidateTitle:
                  (p.profile?.title && typeof p.profile.title === 'string' ? p.profile.title : '') ||
                  app.candidateTitle ||
                  '',
                candidateEmail:
                  (p.contact?.email && typeof p.contact.email === 'string' ? p.contact.email : '') ||
                  (p.profile?.email && typeof p.profile.email === 'string' ? p.profile.email : '') ||
                  '',
                candidateManifesto:
                  (p.profile?.manifesto && typeof p.profile.manifesto === 'string' ? p.profile.manifesto : '') || '',
                candidateEducation:
                  (p.education && typeof p.education === 'string' ? p.education : '') || '',
                candidateSkills: candidateSkills,
                candidateExperience: Array.isArray(p.deployments) ? p.deployments : [],
                resumeUrl:
                  (p.resumeUrl && typeof p.resumeUrl === 'string' ? p.resumeUrl : '') ||
                  (app.resumeUrl && typeof app.resumeUrl === 'string' ? app.resumeUrl : '') ||
                  undefined,
                status: (app.status ?? 'Submitted') as Application['status'],
              };
            } catch (err) {
              console.error('[RecruiterDashboard] Profile hydration failed:', err);
              return {
                ...app,
                matchScore: appMatchScore,
                candidateName:
                  app.candidateName ?? `Candidate (${app.candidateUid?.slice(0, 6) ?? 'Anon'})`,
                candidateTitle: '',
                candidateSkills: [],
                candidateExperience: [],
                candidateEducation: '',
                resumeUrl: undefined,
                status: (app.status ?? 'Submitted') as Application['status'],
              };
            }
          })
        );

        // Free plan = first-come-first-serve (earliest appliedAt first)
        // Premium = highest match score first
        if (isPremium) {
          hydrated.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
        } else {
          hydrated.sort((a, b) => {
            const tA = (a as any).appliedAt?.seconds ?? (a as any).createdAt?.seconds ?? 0;
            const tB = (b as any).appliedAt?.seconds ?? (b as any).createdAt?.seconds ?? 0;
            return tA - tB; // oldest first (FCFS)
          });
        }
        setApplications(hydrated);
        setLoadingApplicants(false);
      },
      (err) => {
        console.error('[RecruiterDashboard] Applicants error:', err.message);
        setLoadingApplicants(false);
      }
    );

    return () => unsub();
  }, [selectedJob]);

  /* ── Delete job ────────────────────────────────────────────── */
  const handleDeleteJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      if (selectedJob?.id === jobId) backToJobs();
    } catch (err: any) {
      console.error('[RecruiterDashboard] Delete failed:', err.message);
    } finally {
      setDeletingJobId(null);
      setConfirmDeleteId(null);
    }
  };

  /* ── Applicant actions with immediate UI update ─────────────── */

  const handleShortlist = async (app: Application) => {
    setActionInProgress('shortlist');
    try {
      // 🔥 Immediately update UI
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: 'shortlisted' as Application['status'] } : a
        )
      );

      if (selectedApplicant?.id === app.id) {
        setSelectedApplicant((prev) =>
          prev ? { ...prev, status: 'shortlisted' as Application['status'] } : null
        );
      }

      // Update Firestore
      await setDoc(
        doc(db, 'applications', app.id),
        {
          status: 'shortlisted',
          shortlistedAt: Timestamp.now(),
        },
        { merge: true }
      );

      // Add to Talent Pipeline
      const pipelineId = `${app.candidateUid}_${selectedJob!.id}`;

      const pipelineData = {
        recruiterId,
        jobId: selectedJob!.id,
        jobTitle: selectedJob!.title,
        candidateUid: app.candidateUid,
        applicationId: app.id,           // ← real Firestore application doc ID
        candidateName: app.candidateName,
        candidateTitle: app.candidateTitle,
        candidateEmail: app.candidateEmail,
        candidateSkills: app.candidateSkills ?? [],
        candidateExperience: app.candidateExperience ?? [],
        candidateEducation: app.candidateEducation ?? '',
        candidateManifesto: app.candidateManifesto ?? '',
        matchScore: app.matchScore,
        autoApplied: app.autoApplied ?? false,
        pipelineStage: 'shortlisted',
        addedAt: Timestamp.now(),
        source: 'shortlist',
        ...(app.resumeUrl ? { resumeUrl: app.resumeUrl } : {}),
      };

      await setDoc(doc(db, 'talentPipeline', pipelineId), pipelineData, { merge: true });

    } catch (err) {
      console.error('❌ Shortlist failed:', err);
      // Revert UI on error
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: 'Submitted' as Application['status'] } : a
        )
      );
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (app: Application) => {
    setActionInProgress('pass');
    try {
      // 🔥 Immediately update UI
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: 'rejected' as Application['status'] } : a
        )
      );

      if (selectedApplicant?.id === app.id) {
        setSelectedApplicant((prev) =>
          prev ? { ...prev, status: 'rejected' as Application['status'] } : null
        );
      }

      // Update Firestore
      await setDoc(
        doc(db, 'applications', app.id),
        { status: 'rejected', rejectedAt: Timestamp.now() },
        { merge: true }
      );

    } catch (err) {
      console.error('❌ Reject failed:', err);
      // Revert UI on error
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: 'Submitted' as Application['status'] } : a
        )
      );
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestore = async (app: Application) => {
    setActionInProgress('restore');

    const pipelineId = `${app.candidateUid}_${selectedJob!.id}`;

    try {
      // 🔥 Immediate UI update
      setApplications(prev =>
        prev.map(a =>
          a.id === app.id ? { ...a, status: 'Submitted' } : a
        )
      );

      if (selectedApplicant?.id === app.id) {
        setSelectedApplicant(prev =>
          prev ? { ...prev, status: 'Submitted' } : null
        );
      }

      // 1️⃣ Restore Application
      await setDoc(
        doc(db, 'applications', app.id),
        {
          status: 'Submitted',
          stage: 'submitted',
          shortlistedAt: null,
          rejectedAt: null,
        },
        { merge: true }
      );

      // 2️⃣ Restore Pipeline (optional but recommended)
      await setDoc(
        doc(db, 'talentPipeline', pipelineId),
        {
          pipelineStage: 'shortlisted',
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

    } catch (err) {
      console.error('❌ Restore failed:', err);

      // rollback UI
      const originalStatus = selectedApplicant?.status ?? 'Submitted';
      setApplications(prev =>
        prev.map(a =>
          a.id === app.id ? { ...a, status: originalStatus } : a
        )
      );
    } finally {
      setActionInProgress(null);
    }
  };
  const handleMessage = async (app: Application) => {
    setActionInProgress('message');
    setTimeout(() => setActionInProgress(null), 1000);
  };

  /* ── Navigation ────────────────────────────────────────────── */
  const openJob = useCallback((job: PostedJob) => {
    setSelectedJob(job);
    setView('applicants');
    setSelectedApplicant(null);
    setSearchQuery('');
    setDetailTab('profile');
  }, []);

  const backToJobs = useCallback(() => {
    setView('jobs');
    setSelectedJob(null);
    setSelectedApplicant(null);
  }, []);

  const closeApplicantModal = useCallback(() => {
    setSelectedApplicant(null);
    setDetailTab('profile');
  }, []);

  /* ── Derived ───────────────────────────────────────────────── */
  const filteredApplicants = applications.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      (a.candidateName ?? '').toLowerCase().includes(q) ||
      (a.candidateTitle ?? '').toLowerCase().includes(q) ||
      (a.candidateSkills ?? []).some((s) => typeof s === 'string' && s.toLowerCase().includes(q))
    );
  });

  const avgScore =
    applications.length > 0
      ? Math.round(applications.reduce((s, a) => s + (a.matchScore ?? 0), 0) / applications.length)
      : 0;

  const aboveThreshold =
    selectedJob?.matchThreshold != null
      ? applications.filter((a) => a.matchScore >= selectedJob.matchThreshold!).length
      : null;

  /* ── Status Badge Component ──────────────────────────────────── */
  const StatusPill = ({ status }: { status: PostedJob['status'] }) => {
    const map = {
      active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      closed: 'bg-red-500/15 text-red-400 border-red-500/30',
      draft: 'bg-white/10 text-white/40 border-white/10',
    };
    return (
      <span className={`text-[7px] font-black  tracking-[0.3em] px-2 py-1 border ${map[status]}`}>
        {status}
      </span>
    );
  };

  const ApplicationStatusBadge = ({ status }: { status?: Application['status'] }) => {
    const statusMap: Record<string, { bg: string; border: string; text: string; label: string }> = {
      Submitted: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', label: 'Submitted' },
      shortlisted: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Shortlisted' },
      rejected: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: 'Rejected' },
    };
    const safeStatus = status && status in statusMap ? status : 'Submitted';
    const config = statusMap[safeStatus];
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[7px] font-black  tracking-widest ${config.bg} border ${config.border} ${config.text}`}>
        <span className="material-symbols-outlined text-[10px]">
          {status === 'shortlisted' ? 'check_circle' : status === 'rejected' ? 'cancel' : 'schedule'}
        </span>
        {config.label}
      </span>
    );
  };

  /* ── Candidate Detail Component ──────────────────────────────── */
  const CandidateDetailContent = ({ applicant, job }: { applicant: Application; job: PostedJob }) => {
    const scoreColor =
      applicant.matchScore >= 80
        ? 'text-emerald-400'
        : applicant.matchScore >= 60
          ? 'text-amber-400'
          : applicant.matchScore > 0
            ? 'text-red-400'
            : 'text-white/30';

    const initials = (applicant.candidateName?.trim() || '?')[0].toUpperCase();
    const isAboveThreshold = job.matchThreshold != null && applicant.matchScore >= job.matchThreshold;

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="grid grid-rows-[auto_auto_1fr] gap-0">
            {/* Hero Section */}
            <div className="px-4 md:px-10 py-5 md:py-8 border-b border-white/5 bg-white/[0.01]">
              <div className="flex items-start justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-3 md:gap-6">
                  <div
                    className={`size-12 md:size-20 flex items-center justify-center text-xl md:text-3xl font-black border-2 shrink-0 ${isAboveThreshold
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/30'
                      }`}
                  >
                    {initials}
                  </div>
                  <div className="space-y-0.5 md:space-y-1 min-w-0">
                    <h3 className="text-xl md:text-3xl font-black  tracking-tight leading-tight truncate">
                      {applicant.candidateName ?? 'Unknown'}
                    </h3>
                    <p className="text-[10px] md:text-sm font-black  tracking-widest text-white/40 truncate">
                      {applicant.candidateTitle}
                    </p>
                    {applicant.candidateEmail && (
                      <p className="text-[8px] md:text-[10px] font-medium text-white/30 tracking-wide truncate">
                        {applicant.candidateEmail}
                      </p>
                    )}
                    {applicant.autoApplied && (
                      <span className="inline-flex items-center gap-1 text-[5px] md:text-[7px] font-black  tracking-[0.3em] text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 mt-1">
                        <span className="material-symbols-outlined text-[8px] md:text-[9px]">auto_awesome</span>
                        Auto
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-0.5 md:space-y-2">
                  <div className={`text-4xl md:text-6xl font-black tabular-nums leading-none ${scoreColor}`}>
                    {applicant.matchScore > 0 ? `${applicant.matchScore}%` : '—'}
                  </div>
                  <p className="text-[5px] md:text-[7px] font-black  tracking-[0.3em] text-white/30">Fidelity</p>

                  {job.matchThreshold != null && applicant.matchScore > 0 && (
                    <div
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 text-[5px] md:text-[7px] font-black  tracking-widest ${isAboveThreshold
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[7px] md:text-[10px]">
                        {isAboveThreshold ? 'check_circle' : 'cancel'}
                      </span>
                      {isAboveThreshold ? `≥${job.matchThreshold}%` : `<${job.matchThreshold}%`}
                    </div>
                  )}

                  {applicant.matchScore === 0 && (
                    <p className="text-[7px] font-black  tracking-widest text-white/20 max-w-[100px]">
                      Score pending sync
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="border-b border-white/5 flex z-10 bg-[#080808]">
              <button
                onClick={() => setDetailTab('profile')}
                className={`flex-1 px-6 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black  tracking-widest transition-all border-b-2 ${detailTab === 'profile'
                  ? 'text-white border-b-emerald-400'
                  : 'text-white/40 border-b-transparent hover:text-white/70'
                  }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">person</span>
                  Profile
                </span>
              </button>

              <button
                onClick={() => setDetailTab('resume')}
                className={`flex-1 px-6 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black  tracking-widest transition-all border-b-2 ${detailTab === 'resume'
                  ? 'text-white border-b-emerald-400'
                  : 'text-white/40 border-b-transparent hover:text-white/70'
                  }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">description</span>
                  Resume
                  {!applicant.resumeUrl && (
                    <span className="text-[5px] font-black  tracking-widest text-white/20 border border-white/10 px-1 py-0.5">
                      Profile
                    </span>
                  )}
                </span>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto">
              {detailTab === 'profile' && (
                <div className="px-6 md:px-10 py-6 md:py-8 space-y-8 md:space-y-10">
                  {applicant.candidateManifesto && (
                    <section className="space-y-4">
                      <h4 className="text-[7px] md:text-[8px] font-black  tracking-[0.5em] text-white/30 flex items-center gap-3">
                        <span className="flex-1 h-px bg-white/5" />
                        About
                        <span className="flex-1 h-px bg-white/5" />
                      </h4>
                      <p className="text-sm md:text-base font-medium text-white/70 leading-relaxed">
                        {applicant.candidateManifesto}
                      </p>
                    </section>
                  )}

                  {(applicant.candidateSkills ?? []).length > 0 && (
                    <section className="space-y-4">
                      <h4 className="text-[7px] md:text-[8px] font-black  tracking-[0.5em] text-white/30 flex items-center gap-3">
                        <span className="flex-1 h-px bg-white/5" />
                        Skills
                        <span className="flex-1 h-px bg-white/5" />
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {applicant.candidateSkills!.map((s) => (
                          <span
                            key={s}
                            className="text-[8px] md:text-[9px] font-black  tracking-widest px-3 md:px-4 py-1.5 md:py-2 border border-white/10 text-white/60 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {(applicant.candidateExperience ?? []).length > 0 && (
                    <section className="space-y-4">
                      <h4 className="text-[7px] md:text-[8px] font-black  tracking-[0.5em] text-white/30 flex items-center gap-3">
                        <span className="flex-1 h-px bg-white/5" />
                        Experience
                        <span className="flex-1 h-px bg-white/5" />
                      </h4>
                      <div className="space-y-6">
                        {applicant.candidateExperience!.map((exp, i) => (
                          <div key={i} className="border-l-2 border-white/10 pl-4 md:pl-5 space-y-1.5">
                            <p className="text-sm md:text-base font-black  tracking-tight">
                              {exp.role}
                              <span className="text-white/30 font-medium mx-2">@</span>
                              {exp.co}
                            </p>
                            <p className="text-xs md:text-sm font-medium text-white/40 leading-relaxed">{exp.desc}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {applicant.candidateEducation && (
                    <section className="space-y-4">
                      <h4 className="text-[7px] md:text-[8px] font-black  tracking-[0.5em] text-white/30 flex items-center gap-3">
                        <span className="flex-1 h-px bg-white/5" />
                        Education
                        <span className="flex-1 h-px bg-white/5" />
                      </h4>
                      <p className="text-xs md:text-sm font-medium text-white/50 leading-relaxed">
                        {applicant.candidateEducation}
                      </p>
                    </section>
                  )}

                  <div className="h-20 md:h-32" />
                </div>
              )}

              {detailTab === 'resume' &&
                (applicant.resumeUrl ? (
                  <div className="w-full h-full min-h-[600px] bg-white/[0.02]">
                    <iframe
                      src={`${applicant.resumeUrl}#toolbar=0`}
                      className="w-full h-full border-0"
                      title="Candidate Resume"
                      style={{ minHeight: '600px' }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-6 p-10 text-center">
                    <span className="material-symbols-outlined text-5xl text-white/10">description</span>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black  tracking-widest text-white/30">No resume uploaded</p>
                      <p className="text-[8px] font-medium text-white/20  tracking-widest max-w-xs">
                        Candidate hasn't synced a resume file yet. Their profile is visible in the Profile tab.
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="shrink-0 pt-4 md:pt-6 pb-6 md:pb-8 px-6 md:px-10 bg-gradient-to-t from-[#080808] via-[#080808]/95 to-transparent border-t border-white/5">
          <div className="space-y-3">
            {(() => {
              const currentStatus = applicant.status ?? 'Submitted';

              return (
                <>
                  <ApplicationStatusBadge status={currentStatus as Application['status']} />

                  {/* SUBMITTED */}
                  {(currentStatus === 'Submitted' || !currentStatus) && (
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                      <button
                        onClick={() => handleShortlist(applicant)}
                        disabled={!!actionInProgress}
                        className="flex-1 bg-emerald-500 text-white py-2.5 md:py-3.5 text-[8px] md:text-[9px] font-black  tracking-widest hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {actionInProgress === 'shortlist' ? 'hourglass_empty' : 'verified'}
                        </span>
                        {actionInProgress === 'shortlist' ? 'Shortlisting…' : 'Shortlist'}
                      </button>
                      <button
                        onClick={() => handleMessage(applicant)}
                        disabled={!!actionInProgress}
                        className="flex-1 border border-white/10 py-2.5 md:py-3.5 text-[8px] md:text-[9px] font-black  tracking-widest text-white/50 hover:border-white/30 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-sm">mail</span>
                        Message
                      </button>
                      <button
                        onClick={() => handleReject(applicant)}
                        disabled={!!actionInProgress}
                        className="px-4 md:px-6 py-2.5 md:py-3.5 border border-red-500/20 text-[8px] md:text-[9px] font-black  tracking-widest text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                        Pass
                      </button>
                    </div>
                  )}

                  {/* SHORTLISTED */}
                  {currentStatus === 'shortlisted' && (
                    <div className="space-y-2">
                      <div className="p-3 md:p-4 bg-emerald-500/10 border border-emerald-500/30 text-[8px] md:text-[9px] font-black  tracking-widest text-emerald-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Shortlisted — added to Talent Pipeline
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMessage(applicant)}
                          disabled={!!actionInProgress}
                          className="flex-1 border border-white/10 py-2 text-[8px] font-black  tracking-widest text-white/40 hover:border-white/30 hover:text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">mail</span>
                          Message
                        </button>
                        <button
                          onClick={() => handleRestore(applicant)}
                          disabled={!!actionInProgress}
                          className="px-4 py-2 border border-white/10 text-[8px] font-black  tracking-widest text-white/30 hover:border-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                          title="Move back to Applied"
                        >
                          <span className="material-symbols-outlined text-sm">undo</span>
                          Undo
                        </button>
                        <button
                          onClick={() => handleReject(applicant)}
                          disabled={!!actionInProgress}
                          className="px-4 py-2 border border-red-500/20 text-[8px] font-black  tracking-widest text-red-400/50 hover:border-red-500/40 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          Pass
                        </button>
                      </div>
                    </div>
                  )}

                  {/* REJECTED */}
                  {currentStatus === 'rejected' && (
                    <div className="space-y-2">
                      <div className="p-3 md:p-4 bg-red-500/5 border border-red-500/20 text-[8px] md:text-[9px] font-black  tracking-widest text-red-400/70 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Marked as passed — use buttons below to reconsider
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestore(applicant)}
                          disabled={!!actionInProgress}
                          className="flex-1 border border-white/20 py-2.5 text-[8px] md:text-[9px] font-black  tracking-widest text-white/60 hover:border-white/40 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {actionInProgress === 'restore' ? 'hourglass_empty' : 'undo'}
                          </span>
                          {actionInProgress === 'restore' ? 'Restoring…' : 'Move back to Applied'}
                        </button>
                        <button
                          onClick={() => handleShortlist(applicant)}
                          disabled={!!actionInProgress}
                          className="flex-1 bg-emerald-500/10 border border-emerald-500/30 py-2.5 text-[8px] md:text-[9px] font-black  tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {actionInProgress === 'shortlist' ? 'hourglass_empty' : 'verified'}
                          </span>
                          {actionInProgress === 'shortlist' ? 'Shortlisting…' : 'Shortlist Instead'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <div className="flex h-screen overflow-hidden bg-[#080808] text-white">
      <Sidebar role="recruiter" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 flex flex-col overflow-hidden border-l border-white/5">

        {/* TOP BAR */}
        <header className="shrink-0 flex items-center justify-between px-4 md:px-10 py-3 md:py-5 border-b border-white/5 bg-[#080808]/90 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-white/40 hover:text-white">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-black  tracking-[0.4em]">
              <button
                onClick={backToJobs}
                className={`transition-colors truncate max-w-[50px] sm:max-w-none ${view === 'jobs' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                JOBS
              </button>
              {selectedJob && (
                <>
                  <span className="text-white/20">›</span>
                  <span className="text-white truncate max-w-[100px] md:max-w-[200px]">{selectedJob.title}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={onToggleTheme}
              className="p-2 md:p-2.5 border border-white/10 hover:border-white/30 transition-colors text-white/50 hover:text-white"
            >
              <span className="material-symbols-outlined text-sm md:text-base">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <Link
              to="/post-job"
              className="flex items-center gap-1.5 md:gap-2 bg-white text-black px-3 md:px-5 py-2 md:py-2.5 text-[7px] md:text-[9px] font-black  tracking-widest hover:bg-white/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] md:text-sm">add</span>
              <span className="hidden sm:inline">New Job</span>
              <span className="sm:hidden">Post</span>
            </Link>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* VIEW: JOBS */}
          {view === 'jobs' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
              <div className="space-y-1">
                <p className="text-[8px] md:text-[9px] font-black  tracking-[0.5em] text-white/30">Recruiter Command</p>
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-black  tracking-tighter leading-none">
                  Talent<br />
                  <span className="text-white/20">Inventory</span>
                </h1>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 border border-white/10">
                {[
                  { label: 'Jobs Posted', val: postedJobs.length },
                  { label: 'Active', val: postedJobs.filter((j) => j.status === 'active').length },
                  { label: 'Total Applicants', val: postedJobs.reduce((s, j) => s + (j.applicationCount ?? 0), 0) },
                  { label: 'Closed', val: postedJobs.filter((j) => j.status === 'closed').length },
                ].map((s, i) => (
                  <div key={i} className="p-3 md:p-6 border-r last:border-r-0 border-b md:border-b-0 border-white/10 group hover:bg-white/[0.02] transition-colors">
                    <p className="text-[6px] md:text-[8px] font-black  tracking-[0.3em] text-white/30 mb-0.5 md:mb-1">
                      {s.label}
                    </p>
                    <p className="text-xl md:text-3xl font-black tabular-nums">{s.val}</p>
                  </div>
                ))}
              </div>

              {loadingJobs ? (
                <div className="flex items-center gap-3 text-white/30 py-20">
                  <span className="material-symbols-outlined animate-spin">autorenew</span>
                  <span className="text-[9px] md:text-[10px] font-black  tracking-widest">Fetching mandates…</span>
                </div>
              ) : postedJobs.length === 0 ? (
                <div className="py-32 text-center space-y-4">
                  <span className="material-symbols-outlined text-4xl md:text-5xl text-white/10">work_off</span>
                  <p className="text-[9px] md:text-[10px] font-black  tracking-widest text-white/30">
                    No jobs posted yet
                  </p>
                  <Link
                    to="/post-job"
                    className="inline-block mt-4 border border-white/20 px-6 md:px-8 py-2 md:py-3 text-[8px] md:text-[9px] font-black  tracking-widest hover:bg-white hover:text-black transition-all"
                  >
                    Post First Job
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedJobs.map((job) => {
                    const locationStr = resolveLocation(job.location);
                    const salaryStr = resolveSalary(job);
                    const companyStr = resolveCompany(job.company);
                    const isConfirming = confirmDeleteId === job.id;
                    const isDeleting = deletingJobId === job.id;

                    return (
                      <div
                        key={job.id}
                        className="border border-white/10 bg-gradient-to-br from-white/[0.02] to-white/[0.01] hover:border-white/20 hover:from-white/[0.04] hover:to-white/[0.02] transition-all group relative overflow-hidden"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openJob(job)}
                          onKeyDown={(e) => e.key === 'Enter' && openJob(job)}
                          className="w-full text-left p-4 md:p-6 space-y-4 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill status={job.status} />
                              {job.employmentType && (
                                <span className="text-[6px] md:text-[7px] font-black  tracking-[0.3em] text-white/40 border border-white/10 px-2 py-1 bg-white/[0.02]">
                                  {job.employmentType}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isConfirming) {
                                  handleDeleteJob(job.id);
                                } else {
                                  setConfirmDeleteId(job.id);
                                }
                              }}
                              className={`shrink-0 p-2 transition-colors md:hidden ${isConfirming ? 'bg-red-500/20 text-red-400' : 'text-white/20 hover:text-red-400'
                                }`}
                              title={isConfirming ? 'Confirm delete' : 'Delete job'}
                            >
                              <span className="material-symbols-outlined text-lg">
                                {isDeleting ? 'hourglass_empty' : 'delete'}
                              </span>
                            </button>
                          </div>

                          <div>
                            <h3 className="text-xl md:text-2xl lg:text-2xl font-black  tracking-tight leading-tight mb-2">
                              {job.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] md:text-[10px] font-bold  tracking-wider text-white/50">
                              {companyStr !== '—' && (
                                <>
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">business</span>
                                    {companyStr}
                                  </span>
                                </>
                              )}
                              {locationStr !== '—' && (
                                <>
                                  {companyStr !== '—' && <span className="text-white/20">•</span>}
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                                    {locationStr}
                                  </span>
                                </>
                              )}
                            </div>

                            {salaryStr && (
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] md:text-[11px] font-black  tracking-wider text-emerald-400">
                                <span className="material-symbols-outlined text-[14px]">payments</span>
                                {salaryStr}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <div className="flex items-center gap-4 md:gap-6">
                              <div className="flex items-center gap-2">
                                <div className="size-10 md:size-12 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                  <span className="text-lg md:text-xl font-black text-emerald-400 tabular-nums">
                                    {job.applicationCount ?? 0}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-[10px] md:text-[11px] font-black  tracking-tight leading-none">
                                    Applicants
                                  </p>
                                  <p className="text-[7px] md:text-[8px] font-bold  tracking-wider text-white/30">
                                    Total received
                                  </p>
                                </div>
                              </div>

                              {job.matchThreshold != null && (
                                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                                  <span className="material-symbols-outlined text-[12px] text-emerald-400">verified</span>
                                  <span className="text-[8px] md:text-[9px] font-black  tracking-wider text-emerald-400">
                                    ≥{job.matchThreshold}%
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="hidden md:block text-[9px] font-black  tracking-widest text-white/30">
                                View Details
                              </span>
                              <span className="material-symbols-outlined text-white/40 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">
                                arrow_forward
                              </span>
                            </div>
                          </div>

                          {job.matchThreshold != null && (
                            <div className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20">
                              <span className="material-symbols-outlined text-[12px] text-emerald-400">verified</span>
                              <span className="text-[8px] font-black  tracking-wider text-emerald-400">
                                Match Threshold: ≥{job.matchThreshold}%
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="hidden md:block absolute top-4 right-4">
                          {isConfirming ? (
                            <div className="flex items-center gap-2 bg-[#080808]/95 backdrop-blur-sm border border-red-500/30 px-3 py-2">
                              <span className="text-[7px] md:text-[8px] font-black  tracking-widest text-red-400/70">
                                Delete?
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteJob(job.id);
                                }}
                                disabled={isDeleting}
                                className="px-3 py-1.5 bg-red-500 text-white text-[7px] md:text-[8px] font-black  tracking-widest hover:bg-red-400 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? '…' : 'Yes'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-3 py-1.5 border border-white/10 text-white/40 text-[7px] md:text-[8px] font-black  tracking-widest hover:text-white hover:border-white/30 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(job.id);
                              }}
                              className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>

                        {isConfirming && (
                          <div className="md:hidden absolute inset-0 bg-[#080808]/98 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6 z-10">
                            <div className="text-center space-y-2">
                              <span className="material-symbols-outlined text-4xl text-red-400">delete_forever</span>
                              <p className="text-sm font-black  tracking-tight">Delete this job?</p>
                              <p className="text-[9px] font-medium  tracking-wider text-white/40">
                                This action cannot be undone
                              </p>
                            </div>
                            <div className="flex gap-3 w-full max-w-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="flex-1 py-3 border border-white/20 text-[9px] font-black  tracking-widest text-white/60 hover:text-white hover:border-white/40 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteJob(job.id);
                                }}
                                disabled={isDeleting}
                                className="flex-1 py-3 bg-red-500 text-white text-[9px] font-black  tracking-widest hover:bg-red-400 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? 'Deleting…' : 'Delete Job'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
          }

          {/* VIEW: APPLICANTS */}
          {
            view === 'applicants' && selectedJob && (
              <>
                {/* DESKTOP */}
                <div className="hidden lg:flex flex-1 overflow-hidden">
                  <div
                    className={`flex flex-col border-r border-white/5 shrink-0 overflow-hidden transition-all duration-300 ${selectedApplicant ? 'w-[340px] lg:w-[380px]' : 'w-full max-w-2xl'
                      }`}
                  >
                    {/* Header + list scroll together in one container */}
                    <div className="flex-1 overflow-y-auto flex flex-col">
                      <div className="shrink-0 px-6 py-5 border-b border-white/5 space-y-4 bg-[#080808]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <h2 className="text-base font-black  tracking-tight leading-tight truncate">
                              {selectedJob.title}
                            </h2>
                            <p className="text-[8px] font-black  tracking-[0.3em] text-white/30">
                              {resolveLocation(selectedJob.location)}
                            </p>
                          </div>
                          <StatusPill status={selectedJob.status} />
                        </div>

                        <div className="grid grid-cols-3 border border-white/5">
                          <div className="px-4 py-3 border-r border-white/5">
                            <p className="text-[7px] font-black  tracking-widest text-white/30 mb-1">Total</p>
                            <p className="text-xl font-black tabular-nums">{applications.length}</p>
                          </div>
                          <div className="px-4 py-3 border-r border-white/5">
                            <p className="text-[7px] font-black  tracking-widest text-white/30 mb-1">Avg Score</p>
                            <p className="text-xl font-black tabular-nums text-emerald-400">
                              {avgScore > 0 ? `${avgScore}%` : '—'}
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[7px] font-black  tracking-widest text-white/30 mb-1">Threshold</p>
                            {selectedJob.matchThreshold != null ? (
                              <p className="text-xl font-black tabular-nums text-emerald-400">{selectedJob.matchThreshold}%</p>
                            ) : (
                              <p className="text-xl font-black tabular-nums text-white/20">—</p>
                            )}
                          </div>
                        </div>

                        {/* Free plan FCFS banner */}
                        {!isPremium && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/20">
                            <span className="material-symbols-outlined text-amber-400 text-sm">sort</span>
                            <span className="text-[7px] font-black  tracking-widest text-amber-400/80">
                              Free plan · Candidates in order of application
                            </span>
                          </div>
                        )}
                        {aboveThreshold != null && selectedJob.matchThreshold != null && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">verified</span>
                            <span className="text-[8px] font-black  tracking-widest text-emerald-400">
                              {aboveThreshold} of {applications.length} above {selectedJob.matchThreshold}% threshold
                            </span>
                          </div>
                        )}

                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-base">
                            search
                          </span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, title, skill…"
                            className="w-full bg-white/[0.03] border border-white/10 pl-9 pr-4 py-2.5 text-[10px] font-medium  tracking-widest placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        {loadingApplicants ? (
                          <div className="flex items-center gap-3 text-white/30 p-8">
                            <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                            <span className="text-[9px] font-black  tracking-widest">Loading applicants…</span>
                          </div>
                        ) : filteredApplicants.length === 0 ? (
                          <div className="p-10 text-center space-y-3">
                            <span className="material-symbols-outlined text-4xl text-white/10">person_off</span>
                            <p className="text-[9px] font-black  tracking-widest text-white/30">
                              {applications.length === 0 ? 'No applications yet' : 'No matches'}
                            </p>
                          </div>
                        ) : (
                          filteredApplicants.map((app) => {
                            const isAbove =
                              selectedJob.matchThreshold != null && app.matchScore >= selectedJob.matchThreshold;
                            const scoreColor =
                              app.matchScore >= 80
                                ? 'text-emerald-400'
                                : app.matchScore >= 60
                                  ? 'text-amber-400'
                                  : app.matchScore > 0
                                    ? 'text-red-400'
                                    : 'text-white/20';

                            return (
                              <button
                                key={app.id}
                                onClick={() => {
                                  setSelectedApplicant(app);
                                  setDetailTab('profile');
                                }}
                                className={`w-full text-left px-5 py-4 border-b border-white/5 transition-all flex items-center gap-4 group relative ${selectedApplicant?.id === app.id
                                  ? 'bg-white/[0.08] border-l-2 border-l-emerald-500'
                                  : 'hover:bg-white/[0.02]'
                                  }`}
                              >
                                <div
                                  className={`size-12 shrink-0 flex items-center justify-center text-sm font-black border-2 transition-all ${isAbove
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-white/40'
                                    }`}
                                >
                                  {(app.candidateName?.trim() || '?')[0].toUpperCase()}
                                </div>

                                <div className="flex-grow min-w-0 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-black  tracking-tight truncate">
                                      {app.candidateName ?? 'Unknown Candidate'}
                                    </p>
                                    {app.autoApplied && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 text-[6px] font-black  tracking-widest text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 shrink-0">
                                        <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                                        Auto
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] font-medium  tracking-widest text-white/40 truncate">
                                    {app.candidateTitle || 'Job Seeker'}
                                  </p>
                                  {selectedJob.matchThreshold != null && (
                                    <p className="text-[7px] font-black  tracking-widest text-white/25">
                                      {isAbove ? '✓ Above threshold' : '↓ Below threshold'}
                                    </p>
                                  )}
                                </div>

                                <div className="shrink-0 text-right flex flex-col items-end gap-1">
                                  {isPremium ? (
                                    <>
                                      <div className={`text-3xl font-black tabular-nums leading-none ${scoreColor}`}>
                                        {app.matchScore > 0 ? `${app.matchScore}%` : '—'}
                                      </div>
                                      <p className="text-[6px] font-black  tracking-[0.3em] text-white/30">Match</p>
                                      {selectedJob.matchThreshold != null && app.matchScore > 0 && (
                                        <span className={`text-[5px] font-black  tracking-widest px-1.5 py-0.5 border ${isAbove
                                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                                          }`}>
                                          {isAbove ? `≥${selectedJob.matchThreshold}%` : `<${selectedJob.matchThreshold}%`}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-center gap-0.5 opacity-30">
                                      <span className="material-symbols-outlined text-lg">lock</span>
                                      <p className="text-[6px] font-black  tracking-[0.3em]">Score</p>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>{/* end list */}
                    </div>{/* end scrollable header+list wrapper */}
                  </div>

                  {selectedApplicant ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <CandidateDetailContent applicant={selectedApplicant} job={selectedJob} />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
                      <div className="size-20 border border-white/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-white/10">person_search</span>
                      </div>
                      <p className="text-[10px] font-black  tracking-widest text-white/20">
                        Select a candidate to review
                      </p>
                    </div>
                  )}
                </div>

                {/* MOBILE */}
                <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="shrink-0 px-4 py-4 border-b border-white/5 space-y-3 bg-[#080808]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <h2 className="text-xs md:text-sm font-black  tracking-tight leading-tight truncate">
                            {selectedJob.title}
                          </h2>
                          <p className="text-[6px] md:text-[7px] font-black  tracking-[0.3em] text-white/30">
                            {resolveLocation(selectedJob.location)}
                          </p>
                        </div>
                        <StatusPill status={selectedJob.status} />
                      </div>

                      <div className="grid grid-cols-3 border border-white/5 text-[10px]">
                        <div className="px-3 py-2 border-r border-white/5">
                          <p className="text-[6px] font-black  tracking-widest text-white/30 mb-0.5">Total</p>
                          <p className="text-lg font-black">{applications.length}</p>
                        </div>
                        <div className="px-3 py-2 border-r border-white/5">
                          <p className="text-[6px] font-black  tracking-widest text-white/30 mb-0.5">Avg Score</p>
                          <p className="text-lg font-black text-emerald-400">
                            {avgScore > 0 ? `${avgScore}%` : '—'}
                          </p>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[6px] font-black  tracking-widest text-white/30 mb-0.5">Threshold</p>
                          <p className="text-lg font-black text-emerald-400">
                            {selectedJob.matchThreshold != null ? `${selectedJob.matchThreshold}%` : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-base">
                          search
                        </span>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search…"
                          className="w-full bg-white/[0.03] border border-white/10 pl-9 pr-4 py-2 text-[9px] font-medium  tracking-widest placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {loadingApplicants ? (
                        <div className="flex items-center gap-3 text-white/30 p-6">
                          <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                          <span className="text-[8px] font-black  tracking-widest">Loading…</span>
                        </div>
                      ) : filteredApplicants.length === 0 ? (
                        <div className="p-8 text-center space-y-2">
                          <span className="material-symbols-outlined text-3xl text-white/10">person_off</span>
                          <p className="text-[8px] font-black  tracking-widest text-white/30">
                            {applications.length === 0 ? 'No applications' : 'No matches'}
                          </p>
                        </div>
                      ) : (
                        filteredApplicants.map((app) => {
                          const isAbove =
                            selectedJob.matchThreshold != null && app.matchScore >= selectedJob.matchThreshold;
                          const scoreColor =
                            app.matchScore >= 80
                              ? 'text-emerald-400'
                              : app.matchScore >= 60
                                ? 'text-amber-400'
                                : app.matchScore > 0
                                  ? 'text-red-400'
                                  : 'text-white/20';

                          return (
                            <button
                              key={app.id}
                              onClick={() => {
                                setSelectedApplicant(app);
                                setDetailTab('profile');
                              }}
                              className="w-full text-left px-4 py-3 border-b border-white/5 transition-all flex items-center gap-3 active:bg-white/[0.03]"
                            >
                              <div
                                className={`size-9 shrink-0 flex items-center justify-center text-[10px] font-black border ${isAbove
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-white/5 border-white/10 text-white/40'
                                  }`}
                              >
                                {(app.candidateName?.trim() || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-grow min-w-0">
                                <p className="text-[10px] font-black  tracking-tight truncate">
                                  {app.candidateName ?? 'Unknown'}
                                </p>
                                <p className="text-[7px] font-medium  tracking-widest text-white/30 truncate">
                                  {app.candidateTitle ?? '—'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-xl font-black ${scoreColor}`}>
                                  {app.matchScore > 0 ? `${app.matchScore}%` : '—'}
                                </p>
                                <p className="text-[5px] font-black  text-white/20">Match</p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </>
            )
          }
        </div >
      </main >

      {/* MOBILE MODAL */}
      {
        selectedApplicant && isMobileView && view === 'applicants' && selectedJob && (
          <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm lg:hidden flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#080808]/95 backdrop-blur-xl">
              <h3 className="text-sm font-black  tracking-tight">Candidate Details</h3>
              <button onClick={closeApplicantModal} className="p-2 hover:bg-white/10 transition-colors -mr-2">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <CandidateDetailContent applicant={selectedApplicant} job={selectedJob} />
            </div>
          </div>
        )
      }
    </div >
  );
};

export default RecruiterDashboard;