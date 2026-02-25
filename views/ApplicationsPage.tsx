import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { authService } from "../authService";
import { readSessionUid } from "../authService";
import Sidebar from "../components/Sidebar";
import '../App.css';

/* ================= TYPES ================= */

// Pipeline stages written by TalentPipelinePage (via pipelineStage field)
// plus the legacy stage field ApplicationsPage used to write.
// We unify them here so any change in either page is reflected correctly.
type ApplicationStage =
  | "submitted"
  | "reviewing"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

interface Application {
  id: string;
  role: string;
  company: string;
  status: string;
  progress: number;
  aiApplied: boolean;
  mailNotified?: boolean;
  date?: string;
  stage?: ApplicationStage;
  // pipelineStage is written by TalentPipelinePage — highest priority source of truth
  pipelineStage?: string;
  recruiterName?: string;
  recruiterTitle?: string;
  location?: string;
  salaryRange?: string;
  employmentType?: string;
  lastActivity?: string;
  notes?: string;
}

/* ================= STAGE CONFIG ================= */

const STAGES: {
  key: ApplicationStage;
  label: string;
  icon: string;
  activeColor: string;
  accentText: string;
}[] = [
  { key: "submitted", label: "Submitted",   icon: "send",          activeColor: "bg-sky-500",     accentText: "text-sky-400"     },
  { key: "reviewing", label: "Shortlisted", icon: "manage_search", activeColor: "bg-amber-400",   accentText: "text-amber-400"   },
  { key: "interview", label: "Interview",   icon: "groups",        activeColor: "bg-violet-500",  accentText: "text-violet-400"  },
  { key: "offer",     label: "Offer",       icon: "verified",      activeColor: "bg-emerald-500", accentText: "text-emerald-400" },
  { key: "hired",     label: "Hired",       icon: "emoji_events",  activeColor: "bg-emerald-600", accentText: "text-emerald-300" },
  { key: "rejected",  label: "Declined",    icon: "cancel",        activeColor: "bg-red-500",     accentText: "text-red-400"     },
];

// The linear progression (excluding rejected which is a branch-off)
const STAGE_ORDER: ApplicationStage[] = ["submitted", "reviewing", "interview", "offer", "hired"];

/* ================= RESOLVE STAGE ================= */
// Priority: pipelineStage (written by recruiter in TalentPipeline) > stage > status string

function pipelineStageToAppStage(ps: string): ApplicationStage {
  switch (ps) {
    case "shortlisted": return "reviewing";
    case "interview":   return "interview";
    case "offer":       return "offer";
    case "hired":       return "hired";
    default:            return "submitted";
  }
}

function deriveStageFromStatus(status: string): ApplicationStage {
  const s = (status || "").toLowerCase();
  if (s === "hired")                                   return "hired";
  if (s.includes("offer"))                             return "offer";
  if (s.includes("interview"))                         return "interview";
  if (s.includes("shortlist") || s.includes("reviewing") || s.includes("screen")) return "reviewing";
  if (s.includes("reject") || s.includes("declined") || s.includes("closed"))    return "rejected";
  return "submitted";
}

function resolveStage(raw: any): ApplicationStage {
  // 1. pipelineStage is the authoritative signal from TalentPipelinePage
  if (raw.pipelineStage && raw.pipelineStage !== "shortlisted") {
    // shortlisted is the entry point — once moved further in pipeline, use it
    return pipelineStageToAppStage(raw.pipelineStage);
  }
  if (raw.pipelineStage === "shortlisted") return "reviewing";

  // 2. stage field (written by either page)
  if (raw.stage && STAGES.some(s => s.key === raw.stage)) return raw.stage as ApplicationStage;

  // 3. Fall back to deriving from status string
  return deriveStageFromStatus(raw.status ?? "");
}

/* ================= PIPELINE BAR ================= */

const PipelineBar = ({
  stage,
  recruiterName,
}: {
  stage: ApplicationStage;
  recruiterName?: string;
}) => {
  const isRejected = stage === "rejected";
  const activeIdx  = isRejected ? -1 : STAGE_ORDER.indexOf(stage);

  return (
    <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10">
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-0 w-full">
        {STAGE_ORDER.map((s, i) => {
          const cfg      = STAGES.find((x) => x.key === s)!;
          const isDone   = !isRejected && i <= activeIdx;
          const isActive = !isRejected && i === activeIdx;
          const isLast   = i === STAGE_ORDER.length - 1;

          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={`
                    size-9 flex items-center justify-center border-2 transition-all
                    ${isDone
                      ? `${cfg.activeColor} border-transparent text-white`
                      : "border-black/20 dark:border-white/20 text-black/20 dark:text-white/20"
                    }
                    ${isActive ? "ring-4 ring-offset-2 ring-black/10 dark:ring-white/10 scale-110" : ""}
                  `}
                >
                  <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${isDone ? "opacity-80" : "opacity-20"}`}>
                  {cfg.label}
                </span>
                {isActive && recruiterName && s === "reviewing" && (
                  <span className="text-[7px] font-black uppercase tracking-wider text-amber-500 whitespace-nowrap">
                    {recruiterName}
                  </span>
                )}
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-1 transition-all ${!isRejected && i < activeIdx ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/10"}`} />
              )}
            </React.Fragment>
          );
        })}

        {isRejected && (
          <>
            <div className="flex-1 h-0.5 mx-1 bg-black/10 dark:bg-white/10" />
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="size-9 flex items-center justify-center border-2 bg-red-500 border-transparent text-white">
                <span className="material-symbols-outlined text-sm">cancel</span>
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Declined</span>
            </div>
          </>
        )}
      </div>

      {/* Mobile chips */}
      <div className="sm:hidden flex gap-2 flex-wrap">
        {(isRejected ? [...STAGE_ORDER, "rejected" as ApplicationStage] : STAGE_ORDER).map((s, i) => {
          const cfg      = STAGES.find((x) => x.key === s)!;
          const isDone   = s === "rejected" ? isRejected : !isRejected && i <= activeIdx;
          const isActive = s === "rejected" ? isRejected : !isRejected && i === activeIdx;
          return (
            <div
              key={s}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-[8px] font-black uppercase tracking-widest transition-all
                ${isDone ? `${cfg.activeColor} border-transparent text-white` : "border-black/20 dark:border-white/20 text-black/20 dark:text-white/20"}
                ${isActive ? "ring-2 ring-offset-1 ring-black/20 dark:ring-white/20" : ""}
              `}
            >
              <span className="material-symbols-outlined text-xs">{cfg.icon}</span>
              {cfg.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ================= CARD ================= */

const ApplicationCard = ({ app }: { app: Application }) => {
  const [expanded, setExpanded] = useState(false);

  const stage       = resolveStage(app);
  const stageConfig = STAGES.find((s) => s.key === stage) ?? STAGES[0];
  const isRejected  = stage === "rejected";
  const isOffer     = stage === "offer";
  const isHired     = stage === "hired";

  return (
    <div
      className={`
        border bg-white dark:bg-background-dark transition-all duration-300 group
        ${isHired  ? "border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : "border-black dark:border-white/10"}
        ${isOffer  ? "border-l-8 border-l-emerald-500" : ""}
        ${isRejected ? "opacity-50" : ""}
      `}
    >
      {/* MAIN ROW */}
      <div
        className="p-6 md:p-10 flex flex-col md:flex-row justify-between gap-8 cursor-pointer hover:bg-black hover:text-white transition-all"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* LEFT */}
        <div className="space-y-4 flex-grow">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:text-white/40">
              {app.date || "—"}
            </span>

            {/* Stage badge */}
            <span className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest text-white ${stageConfig.activeColor} flex items-center gap-1`}>
              <span className="material-symbols-outlined text-[10px] align-middle">{stageConfig.icon}</span>
              {stageConfig.label}
            </span>

            {app.aiApplied && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                AI Applied
              </span>
            )}

            {app.mailNotified && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-sky-500">
                <span className="material-symbols-outlined text-xs">mark_email_read</span>
                Notified
              </span>
            )}

            {/* Show if recruiter manually moved this */}
            {app.pipelineStage && app.pipelineStage !== 'shortlisted' && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-violet-400">
                <span className="material-symbols-outlined text-xs">schema</span>
                In Pipeline
              </span>
            )}
          </div>

          <div>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter group-hover:text-white">
              {app.role}
            </h3>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 group-hover:text-white/60">
              {app.company}
              {app.location ? ` · ${app.location}` : ""}
              {app.employmentType ? ` · ${app.employmentType}` : ""}
            </p>
            {app.salaryRange && (
              <p className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:text-white/40 mt-1">
                {app.salaryRange}
              </p>
            )}
          </div>

          {app.recruiterName && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm opacity-40 group-hover:text-white/40">person_search</span>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-50 group-hover:text-white/50">
                Reviewing: <span className="text-amber-500 opacity-100">{app.recruiterName}</span>
                {app.recruiterTitle ? ` · ${app.recruiterTitle}` : ""}
              </span>
            </div>
          )}

          {/* Hired celebration */}
          {isHired && (
            <div className="flex items-center gap-2 text-emerald-500">
              <span className="material-symbols-outlined text-lg animate-bounce">emoji_events</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Offer accepted — congratulations!</span>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-8 border-t md:border-t-0 pt-4 md:pt-0 border-black/10 group-hover:border-white/20">
          <div className="w-32">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest group-hover:text-white">
              <span>Confidence</span>
              <span>{app.progress ?? 0}%</span>
            </div>
            <div className="h-2 border border-black/10 dark:border-white/10 p-0.5 mt-1">
              <div
                className="h-full bg-black dark:bg-white transition-all duration-700"
                style={{ width: `${app.progress ?? 0}%` }}
              />
            </div>
          </div>

          <span className={`material-symbols-outlined text-xl opacity-30 group-hover:opacity-80 group-hover:text-white transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </div>
      </div>

      {/* EXPANDED — PIPELINE */}
      {expanded && (
        <div className="px-6 md:px-10 pb-8 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/10 dark:border-white/10">
          <PipelineBar stage={stage} recruiterName={app.recruiterName} />

          {/* Stage update message */}
          {app.pipelineStage && app.pipelineStage !== 'shortlisted' && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-violet-500/5 border border-violet-500/20">
              <span className="material-symbols-outlined text-sm text-violet-400">schema</span>
              <p className="text-[8px] font-black uppercase tracking-widest text-violet-400">
                Recruiter moved you to{" "}
                <span className="text-violet-300">
                  {STAGES.find(s => s.key === pipelineStageToAppStage(app.pipelineStage!))?.label ?? app.pipelineStage}
                </span>
                {" "}stage in their talent pipeline
              </p>
            </div>
          )}

          {(app.lastActivity || app.notes) && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {app.lastActivity && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-1">Last Activity</p>
                  <p className="text-xs font-black uppercase tracking-tight">{app.lastActivity}</p>
                </div>
              )}
              {app.notes && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-1">Notes</p>
                  <p className="text-xs font-bold uppercase tracking-wide opacity-60">{app.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ================= STATS BAR ================= */

const StatsBar = ({ apps }: { apps: Application[] }) => {
  const counts: Record<ApplicationStage, number> = {
    submitted: 0, reviewing: 0, interview: 0, offer: 0, hired: 0, rejected: 0,
  };
  apps.forEach((a) => {
    const s = resolveStage(a);
    counts[s] = (counts[s] || 0) + 1;
  });

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 border border-black dark:border-white/20 mb-12">
      {STAGES.map((s, i) => (
        <div
          key={s.key}
          className={`p-4 md:p-6 border-r last:border-r-0 border-black/10 dark:border-white/10 group hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[7px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60">{s.label}</p>
            <span className="material-symbols-outlined text-sm opacity-20 group-hover:opacity-60">{s.icon}</span>
          </div>
          <p className={`text-2xl md:text-4xl font-black uppercase tracking-tighter ${counts[s.key] > 0 ? s.accentText : ''} group-hover:text-inherit`}>
            {counts[s.key]}
          </p>
        </div>
      ))}
    </div>
  );
};

/* ================= PAGE ================= */

const ApplicationsPage: React.FC<{
  onToggleTheme: () => void;
  isDarkMode: boolean;
}> = ({ onToggleTheme, isDarkMode }) => {
  const [isMenuOpen, setIsMenuOpen]       = useState(false);
  const [applications, setApplications]   = useState<Application[]>([]);
  const [activeFilter, setActiveFilter]   = useState<ApplicationStage | "all" | "ai" | "manual">("all");

  /* ================= REALTIME FETCH ================= */

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      let uid = readSessionUid();
      if (!uid) {
        const user = await authService.getCurrentUser();
        uid = user?.uid ?? null;
      }
      if (!uid) return;

      // Query by candidateUid (written by saveApplication) AND userId as fallback
      const q = query(
        collection(db, "applications"),
        where("userId", "==", uid)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const data: Application[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          return {
            id:            docSnap.id,
            role:          raw.jobTitle      ?? raw.role      ?? "Unknown Role",
            company:       raw.companyName   ?? raw.company   ?? "Unknown Company",
            status:        raw.status        ?? "applied",
            progress:      typeof raw.matchScore === "number" ? raw.matchScore : (raw.progress ?? 0),
            aiApplied:     Boolean(raw.autoApplied ?? raw.aiApplied),
            mailNotified:  raw.mailNotified  ?? false,
            date:          raw.appliedAt?.toDate?.().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? raw.date,
            stage:         raw.stage         as ApplicationStage ?? undefined,
            pipelineStage: raw.pipelineStage ?? undefined,
            recruiterName: raw.recruiterName ?? undefined,
            recruiterTitle: raw.recruiterTitle ?? undefined,
            location:      raw.location      ?? undefined,
            salaryRange:   raw.salaryRange   ?? undefined,
            employmentType: raw.employmentType ?? undefined,
            lastActivity:  raw.lastActivity  ?? undefined,
            notes:         raw.notes         ?? undefined,
          };
        });

        // Sort: active stages first, then by date
        data.sort((a, b) => {
          const aStage = resolveStage(a);
          const bStage = resolveStage(b);
          const order = ['hired', 'offer', 'interview', 'reviewing', 'submitted', 'rejected'];
          const aIdx = order.indexOf(aStage);
          const bIdx = order.indexOf(bStage);
          if (aIdx !== bIdx) return aIdx - bIdx;
          return 0;
        });

        setApplications(data);
      });
    };

    init();
    return () => unsubscribe?.();
  }, []);

  /* ================= FILTER ================= */

  const filtered = applications.filter((a) => {
    if (activeFilter === "all")    return true;
    if (activeFilter === "ai")     return a.aiApplied;
    if (activeFilter === "manual") return !a.aiApplied;
    return resolveStage(a) === activeFilter;
  });

  const autoApplied   = filtered.filter((a) => a.aiApplied);
  const manualApplied = filtered.filter((a) => !a.aiApplied);

  const FILTER_TABS: { key: typeof activeFilter; label: string }[] = [
    { key: "all",       label: "All"        },
    { key: "ai",        label: "AI Applied" },
    { key: "manual",    label: "Manual"     },
    { key: "submitted", label: "Submitted"  },
    { key: "reviewing", label: "Shortlisted"},
    { key: "interview", label: "Interview"  },
    { key: "offer",     label: "Offer"      },
    { key: "hired",     label: "Hired"      },
    { key: "rejected",  label: "Declined"   },
  ];

  /* ================= UI ================= */

  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white overflow-hidden">
      <Sidebar role="candidate" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 p-6 md:p-12 lg:p-20 custom-scrollbar">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 -ml-2">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.5em] opacity-40 mb-1">Application Tracking</div>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">My Applications</h1>
            </div>
          </div>
          <button onClick={onToggleTheme} className="p-4 border border-black dark:border-white hover:invert transition-all">
            <span className="material-symbols-outlined">{isDarkMode ? "light_mode" : "dark_mode"}</span>
          </button>
        </header>

        {/* STATS */}
        {applications.length > 0 && <StatsBar apps={applications} />}

        {/* FILTER TABS */}
        {applications.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {FILTER_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveFilter(t.key)}
                className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest border transition-all
                  ${activeFilter === t.key
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                    : "border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white opacity-50 hover:opacity-100"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {applications.length === 0 && (
          <div className="border border-dashed border-black/20 dark:border-white/20 p-16 text-center">
            <span className="material-symbols-outlined text-4xl opacity-20 mb-4 block">inbox</span>
            <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-4">No applications yet</p>
            <p className="text-xs uppercase tracking-widest opacity-30 max-w-md mx-auto">
              Once you apply manually or via AI auto-apply, your applications will appear here with full mandate tracking.
            </p>
          </div>
        )}

        {/* APPLICATIONS LIST */}
        {applications.length > 0 && (
          <>
            <section className="mb-20">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest">Auto Applied</h2>
                <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/10">{autoApplied.length}</span>
              </div>
              <div className="space-y-4">
                {autoApplied.length === 0 && (
                  <p className="text-xs uppercase tracking-widest opacity-30 border border-dashed border-black/10 dark:border-white/10 p-6 text-center">
                    No auto-applied applications matching filter
                  </p>
                )}
                {autoApplied.map((app) => <ApplicationCard key={app.id} app={app} />)}
              </div>
            </section>

            <section className="mb-20">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest">Manual Applied</h2>
                <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/10">{manualApplied.length}</span>
              </div>
              <div className="space-y-4">
                {manualApplied.length === 0 && (
                  <p className="text-xs uppercase tracking-widest opacity-30 border border-dashed border-black/10 dark:border-white/10 p-6 text-center">
                    No manual applications matching filter
                  </p>
                )}
                {manualApplied.map((app) => <ApplicationCard key={app.id} app={app} />)}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default ApplicationsPage;