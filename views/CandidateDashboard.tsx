import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToActiveJobs } from '../Jobservice';
import Sidebar from '../components/Sidebar';
import { calculateSemanticFidelityBackend, extractResumeText } from '../geminiService';
import { authService, readSessionUid } from '../authService';
import { Job } from '../types';
import { saveApplication, buildApplicationPayload, hasApplied } from "../applicationService";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { usePlan } from '../usePlan';
import UpgradeModal from '../components/UpgradeModal';
import '../App.css';


/* ── Types ── */
interface Notification {
  id: string;
  title: string;
  msg: string;
  type: 'info' | 'success' | 'alert';
}

interface ProfileData {
  name?: string;
  title?: string;
  manifesto?: string;
  skills: Array<{ skill: string; weight: number }>;
  deployments: Array<{ role: string; co: string; desc: string }>;
  education?: string;
}

interface ProfilePayload {
  profileText: string;
  candidateSkills: Array<{ skill: string; weight: number }>;
}

/* ════════════════════════════════════════════════════════
   CandidateDashboard
   - Resume stored in-memory only (no Firebase Storage)
   - AI matching, auto-pilot, manual apply all preserved
════════════════════════════════════════════════════════ */
export default function CandidateDashboard({ onToggleTheme, isDarkMode }: any) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Persistent refs (survive re-renders without triggering them) ── */
  const resumeFileRef = useRef<File | null>(null);
  const jobsRef = useRef<Job[]>([]);
  const autoPilotRef = useRef<boolean>(false);
  const vectorizingRef = useRef<boolean>(false);
  const lastSyncRef = useRef<number | null>(null);
  const mountedUidRef = useRef<string | null>(null);

  /* ── State ── */
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [resumeName, setResumeName] = useState('Resume.pdf');
  const [isAutoPilotOn, setIsAutoPilotOn] = useState(false);
  const [dynamicJobs, setDynamicJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isResumeViewOpen, setIsResumeViewOpen] = useState(false);
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  /* ── Plan ── */
  const { canManualApply, plan, isLoading: isPlanLoading } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  /* ════════════════════════════════════════════════════════
     INIT: load user, restore local state, subscribe to jobs
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    const init = async () => {
      const uid = readSessionUid();
      if (!uid) return;

      setUserId(uid);
      mountedUidRef.current = uid;

      // Fetch profile in background to avoid blocking job load
      getDoc(doc(db, 'profiles', uid)).then(snap => {
        if (snap.exists()) {
          const p = snap.data();
          if (p.resumeUrl) setResumeUrl(p.resumeUrl);
        }
      }).catch(err => console.warn('Profile fetch failed:', err));

      const savedResumeName = localStorage.getItem(`asterix_resume_name_${uid}`);
      const savedAuto = localStorage.getItem(`asterix_autopilot_${uid}`);
      const savedJobs = localStorage.getItem(`asterix_jobs_${uid}`);

      if (savedResumeName) setResumeName(savedResumeName);

      const auto = savedAuto === 'true';
      setIsAutoPilotOn(auto);
      autoPilotRef.current = auto;

      const jobDataMap = savedJobs ? JSON.parse(savedJobs) : {};

      const unsub = subscribeToActiveJobs(
        (liveJobs) => {
          const merged: Job[] = liveJobs.map(liveJob => {
            const saved = Array.isArray(jobDataMap)
              ? jobDataMap.find((j: any) => j.id === liveJob.id)
              : jobDataMap[liveJob.id];
            return {
              ...liveJob,
              matchScore: saved?.matchScore ?? 0,
              applied: saved?.applied ?? false,
              analyzing: false,
              matchHighlights: saved?.matchHighlights ?? [],
              breakdown: saved?.breakdown ?? null,
            };
          });
          jobsRef.current = merged;
          setDynamicJobs(merged);
          setIsLoadingJobs(false);
        },
        (err) => {
          console.error('[CandidateDashboard] Jobs subscription error:', err);
          setIsLoadingJobs(false);
        }
      );

      return unsub;
    };

    const unsubPromise = init();
    return () => { unsubPromise?.then(unsub => unsub?.()); };
  }, []);

  /* ── Persist jobs to localStorage ── */
  useEffect(() => {
    if (!userId) return;
    jobsRef.current = dynamicJobs;
    localStorage.setItem(`asterix_jobs_${userId}`, JSON.stringify(dynamicJobs));
  }, [dynamicJobs, userId]);

  /* ── Persist auto-pilot flag ── */
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`asterix_autopilot_${userId}`, String(isAutoPilotOn));
    autoPilotRef.current = isAutoPilotOn;
  }, [isAutoPilotOn, userId]);

  /* ── Persist resume name ── */
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`asterix_resume_name_${userId}`, resumeName);
  }, [resumeName, userId]);

  /* ── Safety timeout: clear stuck "analyzing" states ── */
  useEffect(() => {
    const t = setTimeout(() => {
      setDynamicJobs(prev => prev.map(j => j.analyzing ? { ...j, analyzing: false } : j));
    }, 30_000);
    return () => clearTimeout(t);
  }, [isVectorizing]);

  /* ── Restore persistent extracted resume content ── */
  useEffect(() => {
    if (!userId) return;
    const restored = localStorage.getItem(`asterix_resume_content_${userId}`);
    if (restored && restored.length > 100) {
      console.log("[Asterix] Restored resume text from persistent storage");
      // We don't need a state for this if we just use localStorage directly in performSemanticSync,
      // but let's ensure we have it for the auto-pilot checks.
    }
  }, [userId]);

  /* ── Auto-recovery: If resumeUrl exists but content doesn't, extract it ── */
  useEffect(() => {
    const recoverResume = async () => {
      if (!userId || !resumeUrl || resumeUrl.length < 1000) return;
      const key = `asterix_resume_content_${userId}`;
      const existing = localStorage.getItem(key);
      if (existing && existing.length > 100) return;

      try {
        console.log("[Asterix] Auto-recovering resume text from vault...");
        const text = await extractResumeText(resumeUrl);
        localStorage.setItem(key, text);
        addNotification('System', 'Recovered identity from vault', 'success');
      } catch (err) {
        console.error("[Asterix] Auto-recovery failed:", err);
      }
    };
    recoverResume();
  }, [resumeUrl, userId]);

  /* ── Hybrid Offline: Catch-up on missed jobs when tab becomes visible ── */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAutoPilotOn) {
        console.log("[Asterix] Welcome back! Checking for missed opportunities...");
        triggerAutoSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAutoPilotOn]);

  /* ════════════════════════════════════════════════════════
     NOTIFICATIONS
  ════════════════════════════════════════════════════════ */
  const addNotification = (title: string, msg: string, type: Notification['type'] = 'info') => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, title, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  /* ════════════════════════════════════════════════════════
     PROFILE — fetch from Firestore
  ════════════════════════════════════════════════════════ */
  const fetchProfilePayload = async (uid: string): Promise<ProfilePayload> => {
    const empty: ProfilePayload = { profileText: '', candidateSkills: [] };
    try {
      const snap = await getDoc(doc(db, 'profiles', uid));
      if (!snap.exists()) return empty;

      const data = snap.data() as any;
      const candidateSkills = (data.skills ?? [])
        .map((s: any) => ({ skill: (s.s ?? '').toLowerCase().trim(), weight: Number(s.l ?? 0) }))
        .filter((s: any) => s.skill.length > 0);

      setProfileData({
        name: data.profile?.name,
        title: data.profile?.title,
        manifesto: data.profile?.manifesto,
        skills: candidateSkills,
        deployments: data.deployments ?? [],
        education: data.education,
      });

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
      return empty;
    }
  };

  /* ════════════════════════════════════════════════════════
     RESUME VIEWER  (Hybrid: Local Ref + Base64 Vault)
  ════════════════════════════════════════════════════════ */
  const openResumeViewer = () => {
    // Priority 1: Current session file (fast/blob)
    if (resumeFileRef.current) {
      setResumePreviewUrl(URL.createObjectURL(resumeFileRef.current));
      setIsResumeViewOpen(true);
      return;
    }

    // Priority 2: Persistent Vault (Firestore Base64)
    if (resumeUrl && resumeUrl.startsWith('data:')) {
      setResumePreviewUrl(resumeUrl);
      setIsResumeViewOpen(true);
      return;
    }

    addNotification('Resume Missing', 'Please upload your resume to sync your identity.', 'alert');
  };

  const closeResumeViewer = () => {
    setIsResumeViewOpen(false);
    if (resumePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(resumePreviewUrl);
    setResumePreviewUrl(null);
  };

  /* ════════════════════════════════════════════════════════
     SEMANTIC SYNC  — scores every job against resume
  ════════════════════════════════════════════════════════ */
  const performSemanticSync = async () => {
    // Priority: Local File Ref > Persisted Text > Restore from Vault
    const uid = mountedUidRef.current;
    const persistentKey = uid ? `asterix_resume_content_${uid}` : null;
    let extractedText = persistentKey ? (localStorage.getItem(persistentKey) || "") : "";

    if (vectorizingRef.current) return;

    // If no file and no extracted text, we can't sync
    if (!resumeFileRef.current && !extractedText) {
      // Last try: if we have resumeUrl (base64) but no extracted text, extract it now
      if (resumeUrl && resumeUrl.length > 1000) {
        addNotification('Neural Link', 'Restoring resume from vault...', 'info');
        try {
          extractedText = await extractResumeText(resumeUrl);
          if (persistentKey) localStorage.setItem(persistentKey, extractedText);
        } catch (err) {
          addNotification('Sync Error', 'Could not restore resume. Please re-upload.', 'alert');
          return;
        }
      } else {
        return; // Truly nothing to match
      }
    }

    vectorizingRef.current = true;
    setIsVectorizing(true);
    addNotification('System Sync', 'Initializing high-fidelity neural scan...', 'info');

    let autoAppliedCount = 0;
    // uid is already defined above
    const { profileText, candidateSkills } = uid
      ? await fetchProfilePayload(uid)
      : { profileText: '', candidateSkills: [] };

    // If we have a NEW file upload, re-extract even if we had persistent text
    if (resumeFileRef.current) {
      try {
        extractedText = await extractResumeText(resumeFileRef.current);
        if (uid) {
          localStorage.setItem(`asterix_resume_content_${uid}`, extractedText);
        }
        addNotification('Neural Link', 'Identity re-mapped from local file', 'success');
      } catch (err) {
        console.warn('[Asterix] Ref-extraction failed, using existing text if available:', err);
      }
    }

    try {
      for (let index = 0; index < jobsRef.current.length; index++) {
        const job = jobsRef.current[index];

        setDynamicJobs(prev => {
          const updated = [...prev];
          if (!updated[index].analyzing) {
            updated[index] = { ...updated[index], analyzing: true };
          }
          return updated;
        });

        try {
          const audit = await calculateSemanticFidelityBackend(
            extractedText ? null : resumeFileRef.current,
            job,
            profileText,
            candidateSkills,
            extractedText || undefined
          );

          if (typeof audit?.fidelityScore !== 'number') throw new Error('Invalid AI response');

          const score = audit.fidelityScore;
          let shouldAutoApply = false;

          if (autoPilotRef.current) {
            const threshold = job.matchThreshold ?? 65;

            if (score >= threshold && uid) {
              const alreadyApplied = await hasApplied(uid, job.id);

              if (!alreadyApplied) {
                const payload = buildApplicationPayload(uid, job, score, true, resumeUrl || undefined);
                await saveApplication(payload);
                autoAppliedCount++;
                addNotification('Auto-Applied', `${job.title} (${score}%)`, 'success');
              }

              // 🔥 CRITICAL: always mark applied in UI
              shouldAutoApply = true;
            }
          }

          setDynamicJobs(prev => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              matchScore: score,
              matchHighlights: audit.matchHighlights,
              breakdown: audit.breakdown,
              applied: shouldAutoApply ? true : updated[index].applied,
              analyzing: false,
            };
            return updated;
          });

        } catch (err) {
          console.error('[Asterix] AI scoring failed for job:', job.id, err);
          setDynamicJobs(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], analyzing: false };
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('[Asterix] Global sync failure:', err);
    } finally {
      vectorizingRef.current = false;
      setIsVectorizing(false);
      // Wait a moment before clearing analyzing states to prevent flicker
      setTimeout(() => {
        setDynamicJobs(prev => prev.map(j => ({ ...j, analyzing: false })));
      }, 500);
      addNotification(
        'Neural Sync Complete',
        autoAppliedCount ? `${autoAppliedCount} mandates executed` : 'No new compatible mandates',
        autoAppliedCount ? 'success' : 'info'
      );
    }
  };

  /* ── Throttled auto-sync (min 5 min between syncs) ── */
  const triggerAutoSync = async () => {
    console.log("[Asterix] triggerAutoSync event received. AutoSync state:", { isAutoPilotOn: autoPilotRef.current, isVectorizing: vectorizingRef.current });
    if (!autoPilotRef.current || vectorizingRef.current) return;

    const uid = mountedUidRef.current;
    const hasResume = resumeFileRef.current || (uid && localStorage.getItem(`asterix_resume_content_${uid}`)) || (resumeUrl && resumeUrl.length > 1000);

    if (!hasResume) {
      console.warn("[Asterix] AutoSync aborted: No resume source found (file, localCache, or vault)");
      return;
    }

    const now = Date.now();
    if (lastSyncRef.current && now - lastSyncRef.current < 5 * 60_000) {
      console.log("[Asterix] AutoSync throttled. Last sync was less than 5 mins ago.");
      return;
    }

    console.log("[Asterix] AutoSync conditions met. Executing performSemanticSync...");
    lastSyncRef.current = now;
    await performSemanticSync();
  };

  /* ── Auto-pilot interval: every 15 min while tab is visible ── */
  useEffect(() => {
    if (!isAutoPilotOn) return;
    console.log("[Asterix] Auto-Pilot loop engaged (15m interval)");
    const interval = setInterval(() => {
      console.log("[Asterix] Heartbeat check...");
      if (
        document.visibilityState !== 'visible' ||
        !autoPilotRef.current ||
        vectorizingRef.current
      ) {
        console.log("[Asterix] Heartbeat skipped: conditions not met (visibility, autopilot state, or busy)");
        return;
      }
      triggerAutoSync();
    }, 15 * 60_000); // 15m for production
    return () => clearInterval(interval);
  }, [isAutoPilotOn]);

  /* ════════════════════════════════════════════════════════
     AUTO-PILOT TOGGLE
  ════════════════════════════════════════════════════════ */
  const toggleAutoPilot = () => {
    const next = !isAutoPilotOn;
    setIsAutoPilotOn(next);
    autoPilotRef.current = next;
    addNotification(
      next ? 'Auto-Pilot Active' : 'Auto-Pilot Disabled',
      next ? 'Autonomous sync every 15 minutes engaged' : 'Autonomous agents standing down',
      next ? 'alert' : 'info'
    );
    if (next) triggerAutoSync();
  };

  /* ════════════════════════════════════════════════════════
     FILE UPLOAD  — Base64 Identity Vault (ISP Proof)
  ════════════════════════════════════════════════════════ */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files > 1MB to avoid Firestore document limits
    if (file.size > 1024 * 1024) {
      addNotification('File Too Large', 'Resume must be under 1MB for the secure vault.', 'alert');
      return;
    }

    resumeFileRef.current = file;
    setResumeName(file.name);
    setIsUploading(true);

    // Immediate visual feedback: mark all cards as analyzing
    setDynamicJobs(prev => prev.map(j => ({ ...j, analyzing: true })));

    const uid = readSessionUid();
    addNotification('Vault Sync', `Archiving ${file.name} to secure vault...`, 'info');

    // Helper: File to Base64
    const toBase64 = (f: File): Promise<string> => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => res(reader.result as string);
      reader.onerror = e => rej(e);
    });

    // Proceed with Base64 encoding and Firestore update
    const syncToVault = async () => {
      try {
        if (!uid) {
          addNotification('Ready', `${file.name} synced for this session`, 'success');
          return;
        }

        const base64 = await toBase64(file);

        await setDoc(doc(db, 'profiles', uid), {
          resumeUrl: base64, // Keep key 'resumeUrl' for compatibility
          resumeName: file.name
        }, { merge: true });

        setResumeUrl(base64);
        addNotification('Identity Vaulted', 'Resume securely stored in your profile', 'success');
      } catch (err: any) {
        console.error('[Vault Sync] Failed:', err);
        addNotification('Vault Error', 'Internal storage error. Matches will still work.', 'alert');
      } finally {
        setIsUploading(false);
      }
    };

    // Trigger storage in background
    syncToVault();

    // Start matching immediately using the local file memory (Zero Lag)
    performSemanticSync();
  };

  /* ════════════════════════════════════════════════════════
     MANUAL INITIALIZE  — premium only
  ════════════════════════════════════════════════════════ */
  const handleInitialize = (job: Job) => {
    if (!canManualApply) {
      setShowUpgradeModal(true);
      return;
    }
    navigate(`/job/${job.id}`, { state: { job } });
  };

  /* ── Sorted jobs by match score ── */
  const sortedJobs = [...dynamicJobs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  const canViewResume = !!resumeFileRef.current;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden font-display">
      <Sidebar role="candidate" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 flex flex-col custom-scrollbar">

        {/* ── NOTIFICATIONS ── */}
        <div className="fixed top-6 right-4 md:right-6 z-[500] flex flex-col gap-4 pointer-events-none w-[calc(100vw-2rem)] max-w-[320px] md:max-w-[400px]">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`pointer-events-auto border-l-4 p-5 md:p-6 shadow-[0_30px_60px_rgba(0,0,0,0.25)] animate-in slide-in-from-right-full duration-500 flex flex-col gap-3
                ${n.type === 'success' ? 'bg-emerald-500 text-white border-white' :
                  n.type === 'alert' ? 'bg-black text-white border-emerald-500 dark:bg-white dark:text-black' :
                    'bg-white text-black border-black dark:bg-zinc-900 dark:text-white dark:border-white'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h5 className="text-[8px] font-black uppercase tracking-[0.3em] opacity-80">{n.title}</h5>
                  <p className="text-xs font-black uppercase tracking-tight leading-tight">{n.msg}</p>
                </div>
                <span className={`material-symbols-outlined text-lg shrink-0 ${n.type === 'success' ? 'animate-bounce' : ''}`}>
                  {n.type === 'success' ? 'verified' : 'notifications_active'}
                </span>
              </div>
              <div className="h-0.5 w-full bg-current opacity-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-current animate-marquee" style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── HEADER ── */}
        <header className="px-6 md:px-12 py-8 md:py-12 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 sticky top-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl z-[100]">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 -ml-2">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.5em] opacity-40 mb-1">Neural Control Center</div>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">My Dashboard</h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">

            {/* Plan badge */}
            {!isPlanLoading && (
              canManualApply ? (
                <div className="flex items-center gap-2 px-4 py-2 border-2 border-emerald-500/40 bg-emerald-500/5">
                  <span className="material-symbols-outlined text-sm text-emerald-500">verified</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Student Plan</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-black/10 dark:border-white/10 hover:border-emerald-500 transition-all group"
                >
                  <span className="material-symbols-outlined text-sm opacity-30 group-hover:text-emerald-500 group-hover:opacity-100 transition-all">lock</span>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-30 group-hover:opacity-100 group-hover:text-emerald-500 transition-all">Free Plan</span>
                </button>
              )
            )}

            {/* Auto-pilot toggle */}
            <div className={`flex items-center gap-4 px-4 md:px-6 py-3 md:py-4 border-2 transition-all
              ${isAutoPilotOn
                ? 'bg-emerald-500/5 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'}`}
            >
              <div className="flex flex-col text-right">
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Autonomous Agent</span>
                <span className={`text-[9px] font-black uppercase ${isAutoPilotOn ? 'text-emerald-500' : 'opacity-40'}`}>
                  {isAutoPilotOn ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              <button
                onClick={toggleAutoPilot}
                className={`size-10 md:size-12 flex items-center justify-center border-2 transition-all
                  ${isAutoPilotOn
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.4)]'
                    : 'border-black dark:border-white'}`}
              >
                <span className={`material-symbols-outlined text-xl ${isAutoPilotOn ? 'animate-spin-slow' : ''}`}>
                  {isAutoPilotOn ? 'auto_awesome' : 'power_settings_new'}
                </span>
              </button>
            </div>

            <button onClick={onToggleTheme} className="p-3 md:p-4 border border-black dark:border-white hover:invert transition-all">
              <span className="material-symbols-outlined text-lg">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isVectorizing}
              className={`flex-grow md:flex-grow-0 bg-black dark:bg-white text-white dark:text-black px-6 md:px-10 py-3 md:py-4 text-[10px] font-black uppercase tracking-widest hover:invert transition-all flex items-center justify-center gap-3
                ${(isUploading || isVectorizing) ? 'opacity-80 cursor-wait' : ''}`}
            >
              {(isUploading || isVectorizing) && (
                <span className="material-symbols-outlined text-sm animate-circular-spin">progress_activity</span>
              )}
              {isUploading ? 'ARCHIVING...' : isVectorizing ? 'SCANNING...' : 'Sync Identity'}
            </button>

            {canViewResume && (
              <button
                onClick={openResumeViewer}
                className="px-4 md:px-6 py-3 md:py-4 border-2 border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">description</span>
                  <span className="hidden sm:inline">Resume</span>
                </span>
              </button>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              accept=".txt,.pdf,.doc,.docx"
            />
          </div>
        </header>

        <div className="p-6 md:p-12 space-y-8 md:space-y-12 pb-64">

          {/* Vectorizing progress bar */}
          {isVectorizing && (
            <div className="w-full h-1 bg-black/5 dark:bg-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-emerald-500 animate-marquee" style={{ width: '20%' }} />
            </div>
          )}

          {/* ── STATS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-black dark:border-white/20">
            {[
              { label: 'Network Mandates', val: isLoadingJobs ? '...' : dynamicJobs.length },
              { label: 'Applied Protocols', val: dynamicJobs.filter(j => j.applied).length },
              { label: 'Neural Accuracy', val: '98.2%' },
              { label: 'Agent Logic', val: isAutoPilotOn ? 'READY' : 'IDLE' },
            ].map((s, i) => (
              <div
                key={i}
                className="p-4 md:p-8 border-r last:border-0 border-b lg:border-b-0 border-black/5 dark:border-white/5 group hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
              >
                <p className="text-[8px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60">{s.label}</p>
                <p className="text-2xl md:text-4xl font-black uppercase tracking-tighter mt-1">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">

            {/* ── JOB FEED ── */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Live Compatibility Feed</h3>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-30">Sort by Fidelity</span>
              </div>

              {isLoadingJobs ? (
                <div className="flex items-center justify-center gap-3 py-20 opacity-30">
                  <span className="material-symbols-outlined animate-spin">autorenew</span>
                  <span className="text-sm font-black uppercase tracking-widest">Loading live jobs...</span>
                </div>
              ) : sortedJobs.length === 0 ? (
                <div className="flex items-center justify-center gap-3 py-20 opacity-20">
                  <span className="material-symbols-outlined text-4xl">work_off</span>
                  <span className="text-sm font-black uppercase tracking-widest">No jobs available yet</span>
                </div>
              ) : (
                <div className="grid gap-4">
                  {sortedJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`group border-2 border-black dark:border-white/10 p-6 md:p-8 transition-all duration-500 relative overflow-hidden bg-white dark:bg-background-dark hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black
                        ${job.applied && job.matchScore >= (job.matchThreshold ?? 65) ? 'border-l-[8px] border-l-emerald-500 shadow-lg' : ''}`}
                    >
                      {/* Analyzing overlay */}
                      {job.analyzing && (
                        <div className="absolute inset-0 z-20 bg-black/40 dark:bg-white/40 backdrop-blur-sm flex items-center justify-center">
                          <div className="flex flex-col items-center gap-4">
                            <span className="material-symbols-outlined animate-circular-spin text-5xl text-white dark:text-black">neurology</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white dark:text-black animate-pulse">Analyzing Nodes...</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col lg:flex-row gap-6 md:gap-10">
                        <div className="size-20 md:size-24 bg-black dark:bg-white flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-4xl text-white dark:text-black group-hover:text-black dark:group-hover:text-white">corporate_fare</span>
                        </div>

                        <div className="flex-grow space-y-4 min-w-0">
                          <div className="flex justify-between gap-4">
                            <div className="min-w-0">
                              <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter break-words">{job.title}</h2>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">
                                {(typeof job.company === 'string' ? job.company : job.company?.name) || 'Unknown'} •{' '}
                                {(typeof job.location === 'string' ? job.location : job.location?.city) || 'Remote'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-4xl md:text-6xl font-black text-emerald-500">{job.matchScore ?? 0}%</div>
                              <div className="text-[8px] font-black uppercase tracking-[0.3em] opacity-30">FIDELITY</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(job.requiredSkills ?? []).slice(0, 4).map(skill => (
                              <span key={skill} className="px-3 py-1.5 border-2 border-black/10 dark:border-white/10 text-[9px] font-black uppercase tracking-widest opacity-60">
                                {skill}
                              </span>
                            ))}
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t-2 border-black/5 dark:border-white/5">
                            <div className="flex gap-6 text-xs font-black uppercase">
                              <span>{job.salaryRange ? `${job.salaryRange.currency} ${job.salaryRange.min}–${job.salaryRange.max}` : 'Salary NA'}</span>
                              <span>{job.employmentType}</span>
                            </div>

                            {job.applied ? (
                              <div className="px-6 py-3 text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                PROTOCOL SYNCED
                              </div>
                            ) : (
                              <button
                                onClick={() => handleInitialize(job)}
                                className={`relative px-8 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                                  ${canManualApply
                                    ? 'bg-black dark:bg-white text-white dark:text-black hover:invert'
                                    : 'bg-black/5 dark:bg-white/5 text-black/30 dark:text-white/30 border-2 border-black/10 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400'
                                  }`}
                              >
                                {!canManualApply && <span className="material-symbols-outlined text-sm">lock</span>}
                                Initialize
                                {!canManualApply && (
                                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[6px] font-black px-1.5 py-0.5">PRO</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div className="lg:col-span-4 space-y-6 md:space-y-8">

              {/* Auto-pilot info card */}
              <div className="border border-black dark:border-white/20 p-6 md:p-8 space-y-6 bg-black/5 dark:bg-white/5">
                <div className="flex justify-between items-start">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Auto-Pilot Status</h4>
                  <span className={`material-symbols-outlined text-sm ${isAutoPilotOn ? 'text-emerald-500 animate-pulse' : 'opacity-20'}`}>
                    offline_bolt
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Application Rules</p>
                    <p className="text-xs font-black uppercase text-emerald-500">Recruiter-defined threshold</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Sync Interval</p>
                    <p className="text-xs font-black uppercase">Every 15 Minutes</p>
                  </div>
                  <div className="p-3 border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-emerald-500">info</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Available on all plans</span>
                    </div>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40 leading-relaxed">
                      Auto-Pilot applies for you automatically using recruiter thresholds. Manual Initialize requires Student Plan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Plan card */}
              {!isPlanLoading && (
                <div
                  onClick={() => !canManualApply && setShowUpgradeModal(true)}
                  className={`border-2 p-6 space-y-4 transition-all
                    ${canManualApply
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-black/10 dark:border-white/10 cursor-pointer hover:border-emerald-500 group'}`}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Access Tier</h4>
                    <span className={`material-symbols-outlined text-sm transition-all
                      ${canManualApply ? 'text-emerald-500' : 'opacity-20 group-hover:text-emerald-500 group-hover:opacity-100'}`}>
                      {canManualApply ? 'verified' : 'lock'}
                    </span>
                  </div>
                  <div>
                    <p className={`text-xl font-black uppercase tracking-tight ${canManualApply ? 'text-emerald-500' : ''}`}>
                      {canManualApply ? 'Student Plan' : 'Free Plan'}
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1 leading-relaxed">
                      {canManualApply
                        ? 'Full manual application access enabled'
                        : 'Tap to unlock manual initialize'}
                    </p>
                  </div>
                  {!canManualApply && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 group-hover:underline">
                        Upgrade to Student Plan →
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Identity source */}
              <div className="bg-black text-white dark:bg-white dark:text-black p-6 md:p-8 space-y-6 shadow-2xl">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Identity Source</h4>
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Current Root Node</p>
                  <p className="text-xs font-black uppercase truncate">{resumeName}</p>
                  <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border inline-block border-emerald-500 text-emerald-500">
                    IDENTITY_SYNCED
                  </span>
                  <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border inline-block border-white/20 text-white/40 dark:border-black/20 dark:text-black/40 ml-2">
                    SESSION_ONLY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── RESUME VIEWER MODAL ── */}
      {isResumeViewOpen && resumePreviewUrl && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm lg:bg-transparent lg:inset-auto lg:right-0 lg:top-0 lg:h-screen lg:w-0">
          {/* Mobile */}
          <div className="lg:hidden w-full h-full flex flex-col bg-white dark:bg-background-dark">
            <div className="flex items-center justify-between p-4 border-b border-black/5 sticky top-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl z-10">
              <h3 className="text-lg font-black uppercase tracking-tight">Your Resume</h3>
              <button onClick={closeResumeViewer} className="p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe src={`${resumePreviewUrl}#toolbar=0`} className="w-full h-full border-0" title="Resume Preview" />
            </div>
          </div>

          {/* Desktop slide-in panel */}
          <div className="hidden lg:flex lg:absolute lg:right-0 lg:top-0 lg:h-screen lg:w-[600px] xl:w-[700px] lg:flex-col lg:bg-white dark:lg:bg-background-dark lg:shadow-2xl">
            <div className="flex items-center justify-between p-8 border-b border-black/5 sticky top-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-xl z-10 shrink-0">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Your Resume</h3>
                <p className="text-xs opacity-40 uppercase tracking-widest mt-1">{resumeName}</p>
              </div>
              <button onClick={closeResumeViewer} className="p-3 border border-black/10 dark:border-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={`${resumePreviewUrl}#toolbar=0`} className="w-full h-full border-0" title="Resume Preview" />
            </div>
          </div>
        </div>
      )}

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        @keyframes circular-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .animate-circular-spin { animation: circular-spin 1.5s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }
        .animate-marquee { animation: marquee 3s linear infinite; }
      `}</style>
    </div>
  );
}