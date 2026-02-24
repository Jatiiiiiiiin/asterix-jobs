import React, { useState, useEffect, useCallback } from 'react';
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
  setDoc,
  Timestamp,
} from 'firebase/firestore';

/* ================= TYPES ================= */

interface PipelineCandidate {
  applicationId: string;
  jobId:         string;
  jobTitle:      string;
  candidateUid:  string;
  matchScore:    number;
  autoApplied:   boolean;
  appliedAt:     Timestamp | null;
  shortlistedAt: Timestamp | null;
  pipelineStage: PipelineStage;
  // hydrated from profile
  name:          string;
  title:         string;
  email:         string;
  phone?:        string;
  skills:        string[];
  manifesto:     string;
  education:     string;
  experience:    Array<{ role: string; co: string; desc: string; date?: string }>;
  resumeUrl?:    string;
}

type PipelineStage = 'shortlisted' | 'interview' | 'offer' | 'hired';

/* ================= STAGE CONFIG ================= */

const STAGES: { id: PipelineStage; label: string; sublabel: string; color: string; accent: string }[] = [
  { id: 'shortlisted', label: 'Shortlisted',  sublabel: 'New candidates',     color: 'border-blue-500/40',    accent: 'text-blue-400'    },
  { id: 'interview',   label: 'Interviewing', sublabel: 'Active discussions',  color: 'border-amber-500/40',   accent: 'text-amber-400'   },
  { id: 'offer',       label: 'Offer Stage',  sublabel: 'Pending decisions',   color: 'border-violet-500/40',  accent: 'text-violet-400'  },
  { id: 'hired',       label: 'Hired',        sublabel: 'Confirmed hires',     color: 'border-emerald-500/40', accent: 'text-emerald-400' },
];

const STAGE_DOT: Record<PipelineStage, string> = {
  shortlisted: 'bg-blue-400',
  interview:   'bg-amber-400',
  offer:       'bg-violet-400',
  hired:       'bg-emerald-400',
};

/* ================= HELPERS ================= */

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function whatsappUrl(phone: string, name: string, jobTitle: string): string {
  const msg = encodeURIComponent(
    `Hi ${name}, this is regarding your application for the ${jobTitle} role. We'd love to connect — are you available for a quick call?`
  );
  const cleaned = phone.replace(/\D/g, '');
  return `https://wa.me/${cleaned}?text=${msg}`;
}

/* ================= COMPONENT ================= */

const TalentPipelinePage: React.FC<{ onToggleTheme: () => void; isDarkMode: boolean }> = ({
  onToggleTheme,
  isDarkMode,
}) => {
  const [isMenuOpen, setIsMenuOpen]           = useState(false);
  const [candidates, setCandidates]           = useState<PipelineCandidate[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(null);
  const [movingId, setMovingId]               = useState<string | null>(null);
  const [recruiterId, setRecruiterId]         = useState<string | null>(null);
  const [dragOver, setDragOver]               = useState<PipelineStage | null>(null);
  const [dragging, setDragging]               = useState<string | null>(null);

  /* ── Auth ──────────────────────────────────── */
  useEffect(() => { setRecruiterId(readSessionUid()); }, []);

  /* ── Load shortlisted applications ─────────── */
  useEffect(() => {
    if (!recruiterId) { setLoading(false); return; }

    // Listen to all applications for this recruiter's jobs that are shortlisted, in-interview, offer, or hired
    const q = query(
      collection(db, 'applications'),
      where('recruiterId', '==', recruiterId)
    );

    // Fallback: also try fetching by status across all applications and filter by recruiter's jobs
    const qByStatus = query(
      collection(db, 'applications'),
      where('status', 'in', ['shortlisted', 'interview', 'offer', 'hired'])
    );

    const unsub = onSnapshot(qByStatus, async (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Hydrate each application with profile + job data
      const hydrated: PipelineCandidate[] = [];

      await Promise.all(raw.map(async (app) => {
        try {
          // Get job to verify it belongs to this recruiter
          const jobSnap = await getDoc(doc(db, 'jobs', app.jobId));
          if (!jobSnap.exists()) return;
          const jobData = jobSnap.data() as any;
          if (jobData.recruiterId !== recruiterId) return; // not this recruiter's job

          // Get candidate profile
          const pSnap = await getDoc(doc(db, 'profiles', app.candidateUid));
          const p     = pSnap.exists() ? (pSnap.data() as any) : {};

          const name  = p.profile?.name?.trim() || app.candidateName || `Candidate (${(app.candidateUid ?? '').slice(0, 6)})`;
          const phone = p.contact?.phone || app.candidatePhone || '';

          hydrated.push({
            applicationId: app.id,
            jobId:         app.jobId,
            jobTitle:      jobData.title ?? 'Unknown Role',
            candidateUid:  app.candidateUid,
            matchScore:    typeof app.matchScore === 'number' ? app.matchScore : 0,
            autoApplied:   app.autoApplied ?? false,
            appliedAt:     app.appliedAt   ?? null,
            shortlistedAt: app.shortlistedAt ?? null,
            pipelineStage: (app.pipelineStage as PipelineStage) || mapStatusToStage(app.status),
            name,
            title:      p.profile?.title     ?? app.candidateTitle ?? '',
            email:      p.contact?.email     ?? app.candidateEmail ?? '',
            phone,
            skills:     (p.skills ?? []).map((s: any) => s.s ?? s.skill ?? '').filter(Boolean),
            manifesto:  p.profile?.manifesto ?? '',
            education:  p.education          ?? '',
            experience: p.deployments        ?? [],
            resumeUrl:  p.resumeUrl          ?? app.resumeUrl,
          });
        } catch (err) {
          console.error('[Pipeline] Hydration failed for app', app.id, err);
        }
      }));

      // Sort by matchScore desc within each stage
      hydrated.sort((a, b) => b.matchScore - a.matchScore);
      setCandidates(hydrated);
      setLoading(false);
    }, (err) => {
      console.error('[Pipeline] Snapshot error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [recruiterId]);

  /* ── Stage mapping helper ───────────────────── */
  function mapStatusToStage(status: string): PipelineStage {
    if (status === 'hired')       return 'hired';
    if (status === 'offer')       return 'offer';
    if (status === 'interview')   return 'interview';
    return 'shortlisted';
  }

  /* ── Move candidate to new stage ───────────── */
  const moveToStage = useCallback(async (appId: string, stage: PipelineStage) => {
    setMovingId(appId);
    try {
      // Map pipeline stage to the fields ApplicationsPage reads (stage + status)
      const stageFieldMap: Record<PipelineStage, { stage: string; status: string }> = {
        shortlisted: { stage: 'reviewing',  status: 'shortlisted' },
        interview:   { stage: 'interview',  status: 'interview'   },
        offer:       { stage: 'offer',      status: 'offer'       },
        hired:       { stage: 'offer',      status: 'hired'       },
      };
      const appFields = stageFieldMap[stage] ?? { stage: 'submitted', status: 'applied' };
      await setDoc(doc(db, 'applications', appId), {
        pipelineStage: stage,           // read by TalentPipelinePage
        stage:         appFields.stage, // read by ApplicationsPage
        status:        appFields.status, // read by both
      }, { merge: true });
      setCandidates(prev =>
        prev.map(c => c.applicationId === appId ? { ...c, pipelineStage: stage } : c)
      );
      if (selectedCandidate?.applicationId === appId) {
        setSelectedCandidate(prev => prev ? { ...prev, pipelineStage: stage } : null);
      }
    } catch (err) {
      console.error('[Pipeline] Move failed:', err);
    } finally {
      setMovingId(null);
    }
  }, [selectedCandidate]);

  /* ── Drag and drop ──────────────────────────── */
  const handleDragStart = (appId: string) => setDragging(appId);
  const handleDragEnd   = () => { setDragging(null); setDragOver(null); };

  const handleDrop = async (stage: PipelineStage) => {
    if (dragging) await moveToStage(dragging, stage);
    setDragging(null);
    setDragOver(null);
  };

  /* ── Derived ────────────────────────────────── */
  const byStage = (stage: PipelineStage) => candidates.filter(c => c.pipelineStage === stage);

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : score > 0 ? 'text-red-400' : 'text-white/20';

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <div className="flex h-screen overflow-hidden bg-[#080808] text-white">
      <Sidebar role="recruiter" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 flex flex-col overflow-hidden border-l border-white/5">

        {/* ── TOP BAR ─────────────────────────────────────── */}
        <header className="shrink-0 flex items-center justify-between px-6 md:px-10 py-4 md:py-5 border-b border-white/5 bg-[#080808]/90 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-white/40 hover:text-white">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.5em] text-white/30">Recruiter Command</p>
              <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none">Talent Pipeline</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Summary chips */}
            <div className="hidden md:flex items-center gap-2">
              {STAGES.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/5 bg-white/[0.02]">
                  <span className={`size-1.5 rounded-full ${STAGE_DOT[s.id]}`} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{byStage(s.id).length}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onToggleTheme}
              className="p-2 md:p-2.5 border border-white/10 hover:border-white/30 transition-colors text-white/50 hover:text-white"
            >
              <span className="material-symbols-outlined text-base">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </header>

        {/* ── BOARD ───────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

          {loading ? (
            <div className="flex-1 flex items-center justify-center gap-3 text-white/30">
              <span className="material-symbols-outlined animate-spin">autorenew</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Loading pipeline…</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
              <span className="material-symbols-outlined text-5xl text-white/10">schema</span>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Pipeline is empty</p>
                <p className="text-[8px] font-medium text-white/20 uppercase tracking-widest max-w-xs">
                  Shortlist candidates from your job applications to populate the pipeline
                </p>
              </div>
            </div>
          ) : (
            /* Kanban columns */
            <div className="flex-1 flex flex-col md:flex-row overflow-x-auto overflow-y-hidden">
              {STAGES.map((stage, stageIdx) => {
                const stageCandidates = byStage(stage.id);
                const isDropTarget    = dragOver === stage.id;

                return (
                  <div
                    key={stage.id}
                    className={`
                      flex flex-col border-r border-white/5 last:border-r-0
                      min-w-[280px] md:min-w-0 md:flex-1
                      transition-colors duration-200
                      ${isDropTarget ? 'bg-white/[0.03]' : ''}
                    `}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => handleDrop(stage.id)}
                  >
                    {/* Column header */}
                    <div className={`shrink-0 px-4 md:px-6 py-4 border-b-2 ${stage.color} border-t-0 border-l-0 border-r-0 bg-white/[0.01]`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${STAGE_DOT[stage.id]}`} />
                          <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white">{stage.label}</h3>
                        </div>
                        <span className={`text-lg md:text-2xl font-black tabular-nums ${stage.accent}`}>
                          {stageCandidates.length}
                        </span>
                      </div>
                      <p className="text-[7px] font-black uppercase tracking-widest text-white/20 mt-1 ml-4">
                        {stage.sublabel}
                      </p>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
                      {stageCandidates.length === 0 && (
                        <div className={`border-2 border-dashed rounded-none py-8 text-center transition-colors ${
                          isDropTarget ? 'border-white/20 bg-white/[0.02]' : 'border-white/5'
                        }`}>
                          <span className="material-symbols-outlined text-2xl text-white/10">person_add</span>
                          <p className="text-[7px] font-black uppercase tracking-widest text-white/15 mt-2">
                            Drop here
                          </p>
                        </div>
                      )}

                      {stageCandidates.map((c) => (
                        <div
                          key={c.applicationId}
                          draggable
                          onDragStart={() => handleDragStart(c.applicationId)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedCandidate(c)}
                          className={`
                            group relative border border-white/5 bg-white/[0.02] p-4 md:p-5
                            hover:border-white/15 hover:bg-white/[0.04]
                            transition-all duration-200 cursor-pointer
                            ${dragging === c.applicationId ? 'opacity-40 scale-95' : ''}
                            ${movingId === c.applicationId ? 'animate-pulse' : ''}
                          `}
                        >
                          {/* Colored left accent bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${STAGE_DOT[c.pipelineStage]}`} />

                          {/* Top row: avatar + name + score */}
                          <div className="flex items-start gap-3">
                            <div className={`size-9 shrink-0 flex items-center justify-center text-[11px] font-black border ${
                              c.matchScore >= (60)
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-white/5 border-white/10 text-white/40'
                            }`}>
                              {(c.name?.trim() || '?')[0].toUpperCase()}
                            </div>

                            <div className="flex-grow min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-tight truncate text-white">
                                {c.name}
                              </p>
                              <p className="text-[8px] font-medium uppercase tracking-widest text-white/30 truncate">
                                {c.title || '—'}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={`text-base font-black tabular-nums ${scoreColor(c.matchScore)}`}>
                                {c.matchScore > 0 ? `${c.matchScore}%` : '—'}
                              </p>
                            </div>
                          </div>

                          {/* Job tag */}
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-[7px] font-black uppercase tracking-widest text-white/25 border border-white/5 px-2 py-1 truncate max-w-[160px]">
                              {c.jobTitle}
                            </span>
                            {c.autoApplied && (
                              <span className="text-[6px] font-black uppercase tracking-widest text-emerald-400/70 border border-emerald-500/20 px-1.5 py-0.5">
                                Auto
                              </span>
                            )}
                          </div>

                          {/* Skills preview */}
                          {c.skills.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {c.skills.slice(0, 3).map(s => (
                                <span key={s} className="text-[6px] font-black uppercase tracking-widest text-white/30 bg-white/5 px-2 py-0.5">
                                  {s}
                                </span>
                              ))}
                              {c.skills.length > 3 && (
                                <span className="text-[6px] font-black uppercase tracking-widest text-white/20 px-2 py-0.5">
                                  +{c.skills.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[7px] font-black uppercase tracking-widest text-white/20">
                              {c.shortlistedAt ? `Shortlisted ${formatDate(c.shortlistedAt)}` : c.appliedAt ? `Applied ${formatDate(c.appliedAt)}` : ''}
                            </span>
                            {/* WhatsApp button */}
                            {c.phone ? (
                              <a
                                href={whatsappUrl(c.phone, c.name, c.jobTitle)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 px-2 py-1 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-[7px] font-black uppercase tracking-widest hover:bg-[#25D366] hover:text-black transition-colors"
                                title={`WhatsApp ${c.name}`}
                              >
                                <svg viewBox="0 0 24 24" className="size-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                <span className="hidden sm:inline">Message</span>
                              </a>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedCandidate(c); }}
                                className="flex items-center gap-1 px-2 py-1 border border-white/10 text-white/30 text-[7px] font-black uppercase tracking-widest hover:border-white/30 hover:text-white transition-colors"
                                title="Add phone in profile"
                              >
                                <span className="material-symbols-outlined text-[10px]">mail</span>
                                <span className="hidden sm:inline">Message</span>
                              </button>
                            )}
                          </div>

                          {/* Drag handle indicator */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[10px] text-white/20">drag_indicator</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── CANDIDATE DETAIL DRAWER ──────────────────────── */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-[1000] flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedCandidate(null)}
          />

          {/* Panel */}
          <div className="w-full max-w-xl bg-[#0a0a0a] flex flex-col border-l border-white/10 shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="shrink-0 px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`size-14 flex items-center justify-center text-xl font-black border-2 ${
                    selectedCandidate.matchScore >= 65
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/30'
                  }`}>
                    {(selectedCandidate.name?.trim() || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">
                      {selectedCandidate.name}
                    </h2>
                    <p className="text-xs font-black uppercase tracking-widest text-white/40 mt-1">
                      {selectedCandidate.title}
                    </p>
                    {selectedCandidate.email && (
                      <p className="text-[9px] text-white/30 mt-0.5">{selectedCandidate.email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="p-2 hover:bg-white/10 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Score + stage */}
              <div className="flex items-center gap-4 mt-5">
                <div className={`text-4xl font-black tabular-nums ${scoreColor(selectedCandidate.matchScore)}`}>
                  {selectedCandidate.matchScore > 0 ? `${selectedCandidate.matchScore}%` : '—'}
                </div>
                <div>
                  <p className="text-[7px] font-black uppercase tracking-widest text-white/30">Fidelity Score</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/50">{selectedCandidate.jobTitle}</p>
                </div>
                <div className="ml-auto">
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${STAGE_DOT[selectedCandidate.pipelineStage]}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/50">
                      {STAGES.find(s => s.id === selectedCandidate.pipelineStage)?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-5 flex-wrap">
                {/* WhatsApp */}
                {selectedCandidate.phone ? (
                  <a
                    href={whatsappUrl(selectedCandidate.phone, selectedCandidate.name, selectedCandidate.jobTitle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/10 border border-[#25D366]/40 text-[#25D366] text-[8px] font-black uppercase tracking-widest hover:bg-[#25D366] hover:text-black transition-all"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-white/10 text-white/25 text-[8px] font-black uppercase tracking-widest" title="No phone number on profile">
                    <svg viewBox="0 0 24 24" className="size-3.5 fill-current opacity-30" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    No phone
                  </div>
                )}

                {/* View resume */}
                {selectedCandidate.resumeUrl && (
                  <a
                    href={selectedCandidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 border border-white/10 text-white/60 text-[8px] font-black uppercase tracking-widest hover:border-white/30 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">description</span>
                    Resume
                  </a>
                )}
              </div>
            </div>

            {/* Stage mover */}
            <div className="shrink-0 px-6 md:px-8 py-4 border-b border-white/5 bg-white/[0.01]">
              <p className="text-[7px] font-black uppercase tracking-widest text-white/30 mb-3">Move to stage</p>
              <div className="flex gap-2 flex-wrap">
                {STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => moveToStage(selectedCandidate.applicationId, s.id)}
                    disabled={selectedCandidate.pipelineStage === s.id || movingId === selectedCandidate.applicationId}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[7px] font-black uppercase tracking-widest transition-all border ${
                      selectedCandidate.pipelineStage === s.id
                        ? `${s.color} ${s.accent} bg-white/[0.03] cursor-default`
                        : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white'
                    } disabled:opacity-50`}
                  >
                    <span className={`size-1.5 rounded-full ${STAGE_DOT[s.id]}`} />
                    {s.label}
                    {selectedCandidate.pipelineStage === s.id && (
                      <span className="material-symbols-outlined text-[10px]">check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-8">

              {selectedCandidate.manifesto && (
                <section className="space-y-3">
                  <h4 className="text-[7px] font-black uppercase tracking-[0.5em] text-white/30 flex items-center gap-3">
                    <span className="flex-1 h-px bg-white/5" />About<span className="flex-1 h-px bg-white/5" />
                  </h4>
                  <p className="text-sm font-medium text-white/60 leading-relaxed">{selectedCandidate.manifesto}</p>
                </section>
              )}

              {selectedCandidate.skills.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-[7px] font-black uppercase tracking-[0.5em] text-white/30 flex items-center gap-3">
                    <span className="flex-1 h-px bg-white/5" />Skills<span className="flex-1 h-px bg-white/5" />
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills.map(s => (
                      <span key={s} className="text-[8px] font-black uppercase tracking-widest px-3 py-1.5 border border-white/10 text-white/50 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
                        {s}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {selectedCandidate.experience.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-[7px] font-black uppercase tracking-[0.5em] text-white/30 flex items-center gap-3">
                    <span className="flex-1 h-px bg-white/5" />Experience<span className="flex-1 h-px bg-white/5" />
                  </h4>
                  <div className="space-y-5">
                    {selectedCandidate.experience.map((exp, i) => (
                      <div key={i} className="border-l-2 border-white/10 pl-4 space-y-1 hover:border-emerald-500/40 transition-colors">
                        {exp.date && <p className="text-[7px] font-black uppercase tracking-widest text-white/25">{exp.date}</p>}
                        <p className="text-sm font-black uppercase tracking-tight">
                          {exp.role}<span className="text-white/30 font-medium mx-2">@</span>{exp.co}
                        </p>
                        {exp.desc && <p className="text-xs font-medium text-white/40 leading-relaxed">{exp.desc}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {selectedCandidate.education && (
                <section className="space-y-3">
                  <h4 className="text-[7px] font-black uppercase tracking-[0.5em] text-white/30 flex items-center gap-3">
                    <span className="flex-1 h-px bg-white/5" />Education<span className="flex-1 h-px bg-white/5" />
                  </h4>
                  <p className="text-sm font-medium text-white/50 leading-relaxed">{selectedCandidate.education}</p>
                </section>
              )}

              <div className="h-10" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TalentPipelinePage;