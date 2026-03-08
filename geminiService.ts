import { Job } from "./types";
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

/**
 * Asterix Neural Protocol: Backend-Accelerated Version
 * All similarity scoring routes to the Python backend (Groq + HF Inference API).
 * No in-browser ML models — fast on any device including mobile.
 */

/* ================= CACHING UTILITIES ================= */

function getCacheKey(prefix: string, payload: any): string {
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return `asterix_ai_cache_${prefix}_${Math.abs(hash)}`;
}

function getFromCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const { data, timestamp } = JSON.parse(item);
    // Cache expiry: 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setInCache(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // If quota exceeded, clear old cache items
    console.warn("[Cache] Quota exceeded, clearing AI cache");
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('asterix_ai_cache_')) localStorage.removeItem(k);
    });
  }
}

/* ================= CONFIG ================= */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// In-browser ML pipeline removed — all scoring routes to backend

/* ================= PDF EXTRACTION (CLIENT) ================= */

export async function extractTextFromPDFClient(file: File | Blob): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";
    const numPages = Math.min(pdf.numPages, 3);

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + " ";

      if (fullText.length > 3000) break;
    }

    return preprocess(fullText).slice(0, 3000);
  } catch (err) {
    console.error("[PDF Client] Extraction failed:", err);
    throw err;
  }
}

/* ================= UTILITIES ================= */

function preprocess(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 3000);
}

function stableScore(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  const norm = Math.abs(hash) / 0xffffffff;
  return Math.floor(min + norm * (max - min));
}

/* ================= SKILL AUDIT ================= */

export async function getDetailedSkillAudit(
  resumeText: string,
  tags: string[]
) {
  const rText = (resumeText || "").toLowerCase();

  return tags.map((tag) => {
    const isVerified = rText.includes(tag.toLowerCase());

    // FIX 1 APPLIED: Use stableScore instead of Math.random()
    // Verified skills score 82–97, unverified 12–31 — consistent across renders
    const score = isVerified
      ? stableScore(tag + resumeText.slice(0, 50), 82, 97)
      : stableScore(tag + resumeText.slice(0, 50), 12, 31);

    return { tag, score };
  });
}

/* ================= BACKEND MATCH ================= */

export async function extractResumeText(resumeSource: File | string): Promise<string> {
  if (resumeSource instanceof File && resumeSource.type === 'application/pdf') {
    try {
      console.log("[Asterix] Attempting client-side PDF extraction...");
      return await extractTextFromPDFClient(resumeSource);
    } catch (e) {
      console.warn("[Asterix] Client-side extraction failed, falling back to backend:", e);
    }
  }

  const formData = new FormData();

  if (typeof resumeSource === 'string') {
    try {
      const arr = resumeSource.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) throw new Error("Invalid base64 format");
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });
      formData.append("resume", blob, "resume.pdf");
    } catch (e) {
      console.error("[Asterix] Failed to parse base64 resume:", e);
      throw new Error("Invalid resume data");
    }
  } else {
    formData.append("resume", resumeSource);
  }

  try {
    const res = await fetch(`${API_BASE}/extract`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Extraction service failed");
    const data = await res.json();

    if (data.status === "error") throw new Error(data.message || "Extraction failed");
    return data.text || "";
  } catch (err: any) {
    console.error("[Asterix] Resume extraction failed:", err);
    throw err;
  }
}

export async function embedResumeBackend(resumeText: string) {
  const formData = new FormData();
  formData.append("resumeText", resumeText);

  try {
    const res = await fetch(`${API_BASE}/embed-resume`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Embedding service failed");
    return await res.json();
  } catch (err: any) {
    console.error("[Asterix] Resume embedding failed:", err);
    throw err;
  }
}

export async function calculateSemanticFidelityBackend(
  file: File | null,
  job: any,
  profileText: string,
  candidateSkills: Array<{ skill: string; weight: number }> = [],
  resumeText?: string
) {
  const finalResumeText = resumeText || (file ? await extractResumeText(file) : "");

  // Always route to backend — no in-browser ML model
  console.log(`[Asterix] Backend match for: ${job.title}`);
  const formData = new FormData();

  if (resumeText) {
    formData.append("resumeText", resumeText);
  } else if (file) {
    formData.append("resume", file);
  } else {
    throw new Error("Missing resume file or text");
  }

  formData.append("jobTitle", job.title);

  const safeSummary = job.jobSummary || "";
  const safeResponsibilities = Array.isArray(job.responsibilities)
    ? job.responsibilities.join("\n")
    : "";
  const safeRequiredSkills = Array.isArray(job.requiredSkills)
    ? "Required Skills: " + job.requiredSkills.join(", ")
    : "";
  const safePreferredSkills = Array.isArray(job.preferredSkills)
    ? "Preferred Skills: " + job.preferredSkills.join(", ")
    : "";
  const safeTechStack = Array.isArray(job.techStack)
    ? "Tech Stack: " + job.techStack.join(", ")
    : "";

  formData.append(
    "jobDescription",
    [safeSummary, safeResponsibilities, safeRequiredSkills, safePreferredSkills, safeTechStack]
      .filter(Boolean).join("\n\n")
  );

  formData.append("candidateSkills", JSON.stringify(candidateSkills));
  formData.append("profileText", profileText);

  const auditSkills = candidateSkills.map(s => s.skill);
  formData.append("auditSkills", JSON.stringify(auditSkills));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${API_BASE}/match`, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    try {
      const result = JSON.parse(text);
      return result;
    } catch {
      throw new Error("Backend returned non-JSON response");
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Neural sync timed out - check backend connectivity");
    }
    throw err;
  }
}

export async function sendAutoApplyEmail(payload: {
  to_email: string;
  job_title: string;
  company_name: string;
  location: string;
}) {
  try {
    const res = await fetch(`${API_BASE}/send-auto-apply-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Email service failed");
    return await res.json();
  } catch (err) {
    console.error("[Asterix] Failed to send auto-apply email:", err);
    return { status: "error", message: "Network error" };
  }
}

/* ================= AI INSIGHTS ================= */

export const getAIInsights = async (
  candidateName: string,
  jobTitle: string,
  jobDescription: string = "",
  resumeText: string = "",
  forceRefresh: boolean = false
) => {
  const cacheKey = getCacheKey('insights', { candidateName, jobTitle, jobDescription, resumeText });
  if (!forceRefresh) {
    const cached = getFromCache<string[]>(cacheKey);
    if (cached) return cached;
  }

  const form = new FormData();
  form.append("candidateName", candidateName);
  form.append("jobTitle", jobTitle);
  form.append("jobDescription", jobDescription);
  form.append("resumeText", resumeText);

  try {
    const res = await fetch(`${API_BASE}/insights`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      return ["Technical Stack Overlap", "Role Alignment", "Project Relevance"];
    }

    const data = await res.json();
    const points = data.points || [];
    if (points.length > 0) setInCache(cacheKey, points);
    return points;
  } catch {
    return ["Technical Stack Overlap", "Role Alignment", "Project Relevance"];
  }
};

/* ================= JOB SUMMARY ================= */

export const getMatchingSummary = async (jobDescription: string) => {
  const cacheKey = getCacheKey('summary', { jobDescription });
  const cached = getFromCache<any>(cacheKey);
  if (cached) return cached;

  const form = new FormData();
  form.append("jobDescription", jobDescription);

  try {
    const res = await fetch(`${API_BASE}/summary`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      return { requirements: ["Core Engineering"], estimatedMatchPool: 10 };
    }

    const data = await res.json();
    setInCache(cacheKey, data);
    return data;
  } catch {
    return { requirements: ["Core Engineering"], estimatedMatchPool: 10 };
  }
};

/* ================= CHAT CONTEXT ================= */

export async function queryJobContext(
  job: Job,
  userQuestion: string,
  history: any[] = [],
  resumeText: string = "",
  matchScore: number = 0
): Promise<string> {
  const payload = {
    jobTitle: job.title,
    jobDescription: job.jobSummary || "",
    question: userQuestion,
    history: history,
    resumeText: resumeText,
    matchScore: matchScore
  };

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Chat service failed");
    const data = await res.json();
    return data.answer || "No response generated.";
  } catch (err) {
    console.error("[Asterix] Chat failed:", err);
    return "AI service temporarily unavailable.";
  }
}

/* ================= INTERVIEW TIPS ================= */

export interface InterviewTips {
  strengths: string[];
  gapAreas: string[];
  powerTips: string[];
}

function tokenize(text: string): Set<string> {
  const STOP = new Set([
    "the", "and", "for", "with", "this", "that", "are", "was",
    "you", "will", "have", "from", "your", "not", "can", "but",
    "work", "role", "team", "job", "been", "what", "which", "also",
    "more", "their", "into", "through", "about", "other"
  ]);
  const matches = text.toLowerCase().match(/\b[a-z][a-z0-9+#.\-]{1,}\b/g);
  const words = (matches || []) as string[];
  return new Set(
    words.filter(w => w.length >= 2 && !STOP.has(w))
  );
}

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildTips(resumeText: string, jobTitle: string, jobDescription: string): InterviewTips {
  const rTokens = tokenize(resumeText);
  const jTokens = tokenize(jobDescription);

  const matched = [...jTokens].filter(t => rTokens.has(t) && t.length > 3);
  const missing = [...jTokens].filter(t => !rTokens.has(t) && t.length > 3);

  const strengths: string[] = [];
  if (matched.length > 0) {
    strengths.push(`Showcase your hands-on experience with ${matched.slice(0, 3).map(toTitle).join(', ')} — these directly match the JD`);
  }
  if (matched.length > 3) {
    strengths.push(`Demonstrate depth in ${matched.slice(3, 5).map(toTitle).join(' and ')} through specific project examples`);
  } else {
    strengths.push(`Quantify past achievements with metrics (e.g. "reduced load time by 40%") to stand out`);
  }
  if (matched.length > 5) {
    strengths.push(`You share strong overlap in ${matched.slice(5, 7).map(toTitle).join(', ')} — lead with these in technical rounds`);
  } else {
    strengths.push(`Prepare a concise 2-minute narrative linking your background directly to the ${jobTitle} role`);
  }

  const gapAreas: string[] = [];
  if (missing.length > 0) {
    gapAreas.push(`Brush up on ${missing.slice(0, 2).map(toTitle).join(' and ')} — mentioned in the JD but not evident in your resume`);
  } else {
    gapAreas.push(`Research the company's tech stack and current product challenges before the interview`);
  }
  if (missing.length > 2) {
    gapAreas.push(`Prepare at least one example or talking point around ${missing.slice(2, 4).map(toTitle).join(', ')}`);
  } else {
    gapAreas.push(`Prepare examples of how you've quickly learned new technologies in past roles`);
  }
  gapAreas.push(`Study system design concepts relevant to the ${jobTitle} level — typically asked in technical rounds`);

  const powerTips: string[] = [
    `Use the STAR method (Situation → Task → Action → Result) for every behavioural question`,
    `Ask the interviewer: "What does success look like in the first 90 days?" — shows initiative`,
    `Research the company's recent product launches or engineering blog posts to ask informed questions`,
  ];

  return {
    strengths: strengths.slice(0, 3),
    gapAreas: gapAreas.slice(0, 3),
    powerTips: powerTips.slice(0, 3),
  };
}

export async function getInterviewTips(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  forceRefresh: boolean = false
): Promise<InterviewTips> {
  const cacheKey = getCacheKey('tips', { resumeText, jobTitle, jobDescription });
  if (!forceRefresh) {
    const cached = getFromCache<InterviewTips>(cacheKey);
    if (cached) return cached;
  }

  const tips = buildTips(resumeText, jobTitle, jobDescription);

  try {
    const form = new FormData();
    form.append("jobTitle", jobTitle);
    form.append("jobDescription", jobDescription);
    form.append("resumeText", resumeText);

    const res = await fetch(`${API_BASE}/tips`, {
      method: "POST",
      body: form,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.strengths) {
        setInCache(cacheKey, data);
        return data as InterviewTips;
      }
    }
  } catch (err) {
    console.error("[Asterix] Failed to fetch AI tips:", err);
  }

  return tips;
}

/* ================= ADMIN JD PARSING ================= */

export async function parseJobDescription(rawText: string) {
  try {
    const res = await fetch(`${API_BASE}/parse-jd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || "JD Parse failed with status " + res.status);
    }
    return await res.json();
  } catch (err: any) {
    console.error("[Asterix] Failed to parse JD:", err);
    return { status: "error", message: err.message || "Network request failed" };
  }
}

/* ================= CAMPUS CONNECT TEST ================= */

export async function generateTestQuestions(college: string) {
  try {
    const res = await fetch(`${API_BASE}/generate-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ college })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || "Test generation failed with status " + res.status);
    }
    return await res.json();
  } catch (err: any) {
    console.error("[Asterix] Failed to generate test:", err);
    return null;
  }
}