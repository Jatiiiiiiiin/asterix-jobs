import {
  updateDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  collection,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

/* ================= TYPES ================= */

export type ApplicationStage =
  | "submitted"
  | "reviewing"
  | "interview"
  | "offer"
  | "rejected";

export interface ApplicationPayload {
  userId: string;
  candidateUid: string;

  jobId?: string;

  role: string;
  company: string;

  recruiterId?: string;

  stage: ApplicationStage;
  status: string;
  progress: number;

  aiApplied: boolean;
  mailNotified: boolean;

  date: string;

  recruiterName?: string;
  recruiterTitle?: string;
  location?: string;
  salaryRange?: string;
  employmentType?: string;
  lastActivity?: string;
  notes?: string;
  resumeUrl?: string;
}

/* ================= HELPERS ================= */

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * FIX: Firestore rejects documents containing `undefined` values.
 * Strip all undefined keys before writing so no field is silently dropped
 * and the document shape is always complete.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/**
 * FIX: Accept company as either { name: string } OR a plain string.
 * JobDetailsPage can receive jobs from MOCK_JOBS (company = { name }) or
 * from older localStorage entries (company = "Acme Corp"). Both shapes
 * must produce a valid company name string.
 */
function resolveCompanyName(
  company: { name?: string } | string | undefined
): string {
  if (!company) return "Unknown Company";
  if (typeof company === "string") return company;
  return company.name ?? "Unknown Company";
}

function formatSalary(
  min?: number,
  max?: number,
  currency = "INR"
): string | undefined {
  if (!min && !max) return undefined;
  const fmt = (n: number) => {
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
    return String(n);
  };
  const prefix = currency ? `${currency} ` : "";
  if (min && max) return `${prefix}${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${prefix}${fmt(min)}`;
  if (max) return `Up to ${prefix}${fmt(max)}`;
}

/* ================= STAGE ↔ STATUS ================= */

export function stageToStatus(stage: ApplicationStage): string {
  const map: Record<ApplicationStage, string> = {
    submitted: "Submitted",
    reviewing: "Under Review",
    interview: "Interview Scheduled",
    offer: "Offer Extended",
    rejected: "Application Closed",
  };
  return map[stage];
}

/* ================= WRITE ================= */

/**
 * Save an application with a deterministic ID: `${candidateUid}_${jobId}`.
 *
 * FIX: Payload is sanitized (undefined fields stripped) before writing so
 * Firestore never silently drops fields or rejects the write.
 *
 * FIX: Errors are re-thrown so callers (JobDetailsPage.handleApply) know
 * whether the write actually succeeded — previously the catch block set
 * appliedLocally=true even on failure.
 */
export async function saveApplication(
  payload: ApplicationPayload
): Promise<string> {
  const uid = payload.candidateUid || payload.userId;
  if (!uid) throw new Error("[saveApplication] No uid — user not logged in.");

  const jobId = payload.jobId ?? "unknown";
  const docId = `${uid}_${jobId}`;

  const appRef = doc(db, "applications", docId);
  const countRef = doc(db, "jobApplicationCounts", jobId);

  // Sanitize: strip undefined so Firestore doesn't reject the write
  const clean = stripUndefined({
    ...payload,
    userId: uid,
    candidateUid: uid,
  } as Record<string, unknown>);


  await runTransaction(db, async (tx) => {
    const existing = await tx.get(appRef);
    if (existing.exists()) {
      return;
    }

    tx.set(appRef, {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(countRef, { count: increment(1) }, { merge: true });

    // Increment public global counter (readable without auth by landing page)
    const statsRef = doc(db, "stats", "global");
    tx.set(statsRef, { applicationCount: increment(1) }, { merge: true });
  });

  return docId;
}

/* ================= UPDATE ================= */

export async function updateApplicationStage(
  applicationId: string,
  stage: ApplicationStage,
  extra?: {
    recruiterName?: string;
    recruiterTitle?: string;
    lastActivity?: string;
    notes?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, "applications", applicationId), {
    stage,
    status: stageToStatus(stage),
    ...stripUndefined((extra ?? {}) as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  });
}

/* ================= DEDUP ================= */

export async function hasApplied(
  userId: string,
  jobId: string
): Promise<boolean> {
  const snap = await getDoc(
    doc(db, "applications", `${userId}_${jobId}`)
  );
  return snap.exists();
}

/* ================= FACTORY ================= */

/**
 * FIX: `job.company` is typed as `{ name: string } | string` so both
 * MOCK_JOBS (objects) and legacy localStorage entries (strings) work.
 */
export function buildApplicationPayload(
  userId: string,
  job: {
    id: string | number;
    title: string;
    company: { name?: string } | string;
    location?: { city?: string } | string;
    salaryRange?: { min?: number; max?: number; currency?: string };
    employmentType?: string;
    recruiterId?: string;
  },
  matchScore: number,
  aiApplied: boolean,
  resumeUrl?: string
): ApplicationPayload {
  // Resolve company name regardless of shape
  const companyName = resolveCompanyName(job.company as any);

  // Resolve location regardless of shape
  const locationCity =
    typeof job.location === "string"
      ? job.location
      : job.location?.city;

  return {
    userId,
    candidateUid: userId,

    jobId: String(job.id),
    recruiterId: job.recruiterId,

    role: job.title,
    company: companyName,

    stage: "submitted",
    status: stageToStatus("submitted"),

    progress: matchScore,
    aiApplied,
    mailNotified: false,

    date: todayISO(),

    location: locationCity,
    salaryRange: formatSalary(
      job.salaryRange?.min,
      job.salaryRange?.max,
      job.salaryRange?.currency
    ),
    employmentType: job.employmentType,

    lastActivity: `Applied on ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`,
    resumeUrl: resumeUrl,
  };
}

/* ================= READ ================= */

export async function getApplicationsForJob(
  jobId: string
): Promise<(ApplicationPayload & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db, "applications"), where("jobId", "==", jobId))
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as ApplicationPayload),
  }));
}