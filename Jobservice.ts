/**
 * jobService.ts
 *
 * Single source of truth for reading jobs from Firestore.
 * Replaces all MOCK_JOBS usage on the candidate side.
 *
 * Jobs are posted by recruiters via PostJobPage and stored in the
 * Firestore `jobs` collection with status: 'active' | 'draft' | 'closed'.
 * Candidates only ever see status === 'active' jobs.
 */

import {
  collection,
  query,
  where,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface LiveJob {
  id: string;
  title: string;
  department?: string;
  employmentType?: string;
  experienceRequired?: string;
  openings?: number;
  jobSummary?: string;
  responsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  techStack?: string[];
  benefits?: string[];
  hiringProcess?: string[];
  applicationDeadline?: string | null;
  matchThreshold?: number;
  recruiterId?: string;
  status: 'active' | 'draft' | 'closed';
  postedDate?: string;

  // Nested objects — always use resolvers before rendering in JSX
  company: { name: string; industry?: string; size?: string; founded?: string; headquarters?: string };
  location: { city: string; type: string; remoteAllowed: boolean };
  salaryRange: { min: number | null; max: number | null; currency: string };

  // Candidate-side computed fields (not from Firestore)
  matchScore?: number;
  applied?: boolean;
  analyzing?: boolean;
  matchHighlights?: string[];
  breakdown?: any;

  isAdminPosted?: boolean;
  externalUrl?: string;
}

/* ── Resolvers (safe JSX rendering) ─────────────────────────────────────── */

export function resolveLocation(
  location?: { city?: string; type?: string; remoteAllowed?: boolean } | string
): string {
  if (!location) return '—';
  if (typeof location === 'string') return location;
  return [location.city, location.type].filter(Boolean).join(' · ') || '—';
}

export function resolveCity(
  location?: { city?: string; type?: string } | string
): string {
  if (!location) return '—';
  if (typeof location === 'string') return location;
  return location.city ?? '—';
}

export function resolveCompany(
  company?: { name?: string } | string
): string {
  if (!company) return '—';
  if (typeof company === 'string') return company;
  return company.name ?? '—';
}

export function resolveSalary(job: Partial<LiveJob>): string {
  const r = job.salaryRange;
  if (r && (r.min || r.max)) {
    const cur = r.currency ?? '';
    const lo = r.min != null ? Number(r.min).toLocaleString() : '?';
    const hi = r.max != null ? Number(r.max).toLocaleString() : '?';
    return cur ? `${cur} ${lo} – ${cur} ${hi}` : `${lo} – ${hi}`;
  }
  return '';
}

export function resolveSalaryCompact(job: Partial<LiveJob>): string {
  const fmt = (n: number, cur: string) => {
    if (cur === 'INR') {
      if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
      if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    }
    if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${cur} ${Math.round(n / 1_000)}k`;
    return `${cur} ${n}`;
  };
  const r = job.salaryRange;
  const cur = r?.currency ?? 'USD';
  if (r && (r.min || r.max)) {
    const lo = r.min != null ? fmt(Number(r.min), cur) : '?';
    const hi = r.max != null ? fmt(Number(r.max), cur) : '?';
    return `${lo} – ${hi}`;
  }
  return '';
}

/* ── Real-time listener ──────────────────────────────────────────────────── */

/**
 * Subscribe to all active jobs in Firestore.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 * Usage:
 *   useEffect(() => {
 *     const unsub = subscribeToActiveJobs((jobs) => setJobs(jobs));
 *     return () => unsub();
 *   }, []);
 */
export function subscribeToActiveJobs(
  onJobs: (jobs: LiveJob[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'jobs'),
    where('status', '==', 'active')
  );

  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const jobs: LiveJob[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LiveJob, 'id'>),
        // Ensure candidate-side fields default to falsy
        matchScore: undefined,
        applied: false,
        analyzing: false,
        matchHighlights: [],
        breakdown: null,
      }));

      // Sort by postedDate descending (newest first)
      jobs.sort((a, b) => {
        const ta = a.postedDate ?? '';
        const tb = b.postedDate ?? '';
        return tb.localeCompare(ta);
      });

      onJobs(jobs);
    },
    (err) => {
      console.error('[jobService] subscribeToActiveJobs error:', err.message);
      onError?.(err);
    }
  );
}