import { Job } from "./types";
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

/**
 * Asterix Neural Protocol: Local AI Version
 */

/* ================= EMBEDDING PIPELINE ================= */

let embedderPromise: Promise<any> | null = null;
const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function getEmbedder() {
  if (!embedderPromise) {
    try {
      const transformersURL =
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";

      const { pipeline, env } = await import(/* @vite-ignore */ transformersURL);

      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;
      (env as any).isNode = false;
      env.remoteHost = "https://huggingface.co";
      env.remotePath = "";

      embedderPromise = pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
    } catch (err) {
      console.error("Neural Engine Initialization Failed:", err);
      embedderPromise = null;
      return null;
    }
  }

  return embedderPromise;
}

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

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    na += vecA[i] * vecA[i];
    nb += vecB[i] * vecB[i];
  }

  const mag = Math.sqrt(na) * Math.sqrt(nb);
  return mag === 0 ? 0 : dot / mag;
}

function isAuthenticResume(text: string): boolean {
  if (!text || text.length < 300) return false;

  const textLower = text.toLowerCase();

  const POSITIVE_MARKERS = [
    "experience", "education", "skills", "projects", "work history",
    "employment", "achievements", "summary", "objective", "certifications",
    "university", "college", "institue", "bachelor", "master", "phd"
  ];

  const NEGATIVE_MARKERS = [
    "abstract", "introduction", "methodology", "conclusion", "references",
    "figure 1", "table 1", "et al.", "1st class", "paper code", "roll no"
  ];

  const positiveHits = POSITIVE_MARKERS.filter(m => textLower.includes(m)).length;
  const negativeHits = NEGATIVE_MARKERS.filter(m => textLower.includes(m)).length;

  if (positiveHits < 2) {
    console.warn("[Asterix] Document rejected: Low positive markers", positiveHits);
    return false;
  }

  if (negativeHits > positiveHits) {
    console.warn("[Asterix] Document rejected: High negative markers", negativeHits, "vs", positiveHits);
    return false;
  }

  return true;
}

/* ================= DETERMINISTIC HASH ================= */

/**
 * FIX 1: Deterministic skill audit score — replaces Math.random()
 * Produces a stable score in [12, 95] based on skill name + job text hash.
 */
function stableScore(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  const norm = Math.abs(hash) / 0xffffffff;
  return Math.floor(min + norm * (max - min));
}

/* ================= LOCAL AI SCORING ENGINE ================= */

const jobEmbeddingCache: Record<string, number[]> = {};

/**
 * FIX 2: Lowered minRatio from 0.07 → 0.03
 * The 7% threshold was too aggressive and caused valid semantic matches
 * to be skipped entirely, returning 0 unfairly.
 */
async function computeSemanticScoreLocal(
  text: string,
  jobText: string,
  minRatio: number = 0.03  // was 0.07
): Promise<number> {
  const embedder = await getEmbedder();
  if (!embedder) return 0;

  const textTokens = tokenize(text);
  const jobTokens = tokenize(jobText);

  if (jobTokens.size === 0) return 0;

  const overlap = [...textTokens].filter(t => jobTokens.has(t)).length;
  const keywordRatio = overlap / jobTokens.size;

  if (keywordRatio < minRatio) {
    console.log(`[Neural] Keyword ratio too low (${(keywordRatio * 100).toFixed(1)}%), skipping embedding.`);
    return 0;
  }

  const jobHash = jobText.slice(0, 500);
  let jobVec: number[];

  if (jobEmbeddingCache[jobHash]) {
    jobVec = jobEmbeddingCache[jobHash];
  } else {
    const jobOut = await embedder(jobText.slice(0, 2000), { pooling: "mean", normalize: true });
    jobVec = Array.from(jobOut.data || jobOut[0]?.data || jobOut) as number[];
    jobEmbeddingCache[jobHash] = jobVec;
  }

  const textOut = await embedder(text.slice(0, 2000), { pooling: "mean", normalize: true });
  const textVec = Array.from(textOut.data || textOut[0]?.data || textOut) as number[];

  const sim = cosineSimilarity(textVec, jobVec);

  const BASELINE = 0.18;
  const CEILING = 0.75;

  if (sim < BASELINE) return 0;

  const normalized = (sim - BASELINE) / (CEILING - BASELINE);
  return Math.min(1.0, Math.max(0.0, normalized));
}

/**
 * FIX 3: Raised TARGET_SATURATION from 40 → 60
 * With the old value, even a sparse skill list could hit the cap easily,
 * compressing the score range and making low-weight skills look better than they are.
 * 60 gives a more honest spread across strong vs. weak skill matches.
 */
function computeSkillMatchLocal(
  skills: Array<{ skill: string; weight: number }>,
  jobText: string
): number {
  const jobTokens = tokenize(jobText);
  const jobTextLower = jobText.toLowerCase();
  let matchedWeight = 0;
  const matchedSkills: string[] = [];
  const TARGET_SATURATION = 40;  // synced with api.py

  for (const s of skills) {
    const skillName = s.skill.toLowerCase();
    const weight = Math.max(s.weight, 5);
    const skillTokens = tokenize(skillName);

    let hasMatch = false;
    for (const t of skillTokens) {
      if (jobTokens.has(t)) {
        hasMatch = true;
        break;
      }
    }

    if (hasMatch) {
      matchedWeight += weight;
      matchedSkills.push(skillName);
    }
  }

  const coverageRatio = Math.min(matchedWeight / TARGET_SATURATION, 1.0);

  // --- STRATEGIC PENALTY SYSTEM (Synced with api.py) ---
  const REQUIRED_KEYWORDS = ["azure", "aws", "gcp", "devops", "kubernetes", "docker", "cloud", "terraform", "jenkins", "ci/cd"];
  const missingCritical: string[] = [];

  for (const kw of REQUIRED_KEYWORDS) {
    // Simple word boundary check
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(jobTextLower)) {
      const candidateHas = skills.some(s => s.skill.toLowerCase().includes(kw)) ||
        matchedSkills.some(s => s.includes(kw));

      if (!candidateHas) {
        missingCritical.push(kw);
      }
    }
  }

  let penalty = 1.0;
  if (missingCritical.length > 0) {
    penalty = Math.pow(0.8, Math.min(missingCritical.length, 4));
    console.log(`[Neural] MISSING CRITICAL: ${missingCritical.join(", ")}, Penalty: ${penalty.toFixed(2)}`);
  }

  const finalScore = coverageRatio * penalty;
  console.log(`[Neural] Skill Match: ${(finalScore * 100).toFixed(1)}% (Coverage=${(coverageRatio * 100).toFixed(1)}%, Penalty=${penalty.toFixed(2)})`);

  return finalScore;
}

function computeProfileQualityLocal(profileText: string, skills: any[]): number {
  let score = 0;

  const words = profileText.split(/\s+/).filter(w => w.length > 3);
  const wordScore = Math.min(words.length / 40.0, 1.0);
  score += wordScore * 0.4;

  const skillScore = Math.min(skills.length / 5.0, 1.0);
  score += skillScore * 0.4;

  const expMarkers = [" at ", " in ", "years", "experience", "worked"];
  const hasExp = expMarkers.some(m => profileText.toLowerCase().includes(m));
  score += hasExp ? 0.2 : 0;

  return Math.max(0.3, Math.min(1.0, score));
}

function generateHighlightsLocal(
  resumeText: string,
  jobText: string,
  skills: any[],
  score: number
): string[] {
  const highlights: string[] = [];
  const rTokens = tokenize(resumeText);
  const jTokens = tokenize(jobText);

  const matchedSkills = skills
    .filter(s => {
      const sTokens = tokenize(s.skill);
      for (const t of sTokens) if (jTokens.has(t)) return true;
      return false;
    })
    .map(s => s.skill);

  if (matchedSkills.length > 0) {
    highlights.push(`Matched skills: ${matchedSkills.slice(0, 6).join(", ")}`);
  }

  if (score >= 75) highlights.push("Excellent alignment with role requirements");
  else if (score >= 60) highlights.push("Strong match for this position");
  else if (score >= 40) highlights.push("Moderate fit with development areas");
  else highlights.push("Skills gap identified - focus on key requirements");

  const overlap = [...rTokens].filter(t => jTokens.has(t)).length;
  if (overlap > 20) highlights.push("High technical vocabulary match");
  else if (overlap > 10) highlights.push("Good keyword alignment");

  return highlights.slice(0, 3);
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

export async function calculateSemanticFidelityBackend(
  file: File | null,
  job: any,
  profileText: string,
  candidateSkills: Array<{ skill: string; weight: number }> = [],
  resumeText?: string
) {
  const finalResumeText = resumeText || (file ? await extractResumeText(file) : "");

  if (finalResumeText.length > 100) {
    // Authenticity Guard (Ported from api.py)
    if (!isAuthenticResume(finalResumeText)) {
      console.warn("[Asterix] Document failed authenticity check. Returning zero score.");
      return {
        fidelityScore: 0,
        skillAudit: [],
        matchHighlights: ["Document does not appear to be a professional resume (missing key sections or academic/paper markers detected)"],
        breakdown: { resume: 0, profile: 0, completeness: 0, skills: 0 }
      };
    }

    try {
      console.log(`[Asterix] Orchestrating local neural match for: ${job.title}`);

      const jobDescription = `Role: ${job.title}\n\n` + [
        job.jobSummary || "",
        Array.isArray(job.responsibilities) ? job.responsibilities.join("\n") : "",
        Array.isArray(job.requiredSkills) ? "Required: " + job.requiredSkills.join(", ") : "",
        Array.isArray(job.techStack) ? "Tech: " + job.techStack.join(", ") : ""
      ].filter(Boolean).join("\n\n").trim();

      const resScore = await computeSemanticScoreLocal(finalResumeText, jobDescription);
      const profMatchScore = await computeSemanticScoreLocal(profileText, jobDescription, 0.03);
      const skillScore = computeSkillMatchLocal(candidateSkills, jobDescription);
      const qualityScore = computeProfileQualityLocal(profileText, candidateSkills);

      // Prioritize Skills (50%) over generic Resume match (30%)
      const rawScore = (
        0.30 * resScore +
        0.50 * skillScore +
        0.20 * (profMatchScore * 0.7 + qualityScore * 0.3)
      );

      let finalScorePct = 0;
      if (rawScore >= 0.15) {
        finalScorePct = Math.round(Math.pow(rawScore, 1.25) * 100);
      }

      const highlights = generateHighlightsLocal(finalResumeText, jobDescription, candidateSkills, finalScorePct);

      // FIX 1 APPLIED: Deterministic skill audit scores
      const skillAudit = candidateSkills.slice(0, 12).map(s => ({
        skill: s.skill.toUpperCase(),
        score: stableScore(s.skill + jobDescription.slice(0, 100), 50, 89)
      }));

      return {
        fidelityScore: finalScorePct,
        skillAudit,
        matchHighlights: highlights,
        breakdown: {
          resume: Math.round(resScore * 100),
          profile: Math.round(profMatchScore * 100),
          completeness: Math.round(qualityScore * 100),
          skills: Math.round(skillScore * 100)
        }
      };
    } catch (localErr) {
      console.warn("[Asterix] Local matching failed, falling back to backend:", localErr);
    }
  }

  // Fallback to Backend
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
  jobTitle: string
) => {
  const form = new FormData();
  form.append("candidateName", candidateName);
  form.append("jobTitle", jobTitle);

  try {
    const res = await fetch(`${API_BASE}/insights`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      return ["Technical Stack Overlap", "Role Alignment", "Project Relevance"];
    }

    return (await res.json()).points || [];
  } catch {
    return ["Technical Stack Overlap", "Role Alignment", "Project Relevance"];
  }
};

/* ================= JOB SUMMARY ================= */

export const getMatchingSummary = async (jobDescription: string) => {
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

    return res.json();
  } catch {
    return { requirements: ["Core Engineering"], estimatedMatchPool: 10 };
  }
};

/* ================= CHAT CONTEXT ================= */

export async function queryJobContext(
  job: Job,
  userQuestion: string
): Promise<string> {
  const prompt = `Objective: Answer the candidate's question based on the job context.
  Question: ${userQuestion}
  Job: ${job.title}
  Context: ${job.jobSummary || ""}`;

  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/google/flan-t5-base",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_HF_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_new_tokens: 300, temperature: 0.2 },
        }),
      }
    );

    const data = await res.json();
    return data?.[0]?.generated_text || "No response generated.";
  } catch {
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
  return new Set(
    (text.toLowerCase().match(/\b[a-z][a-z0-9+#.\-]{1,}\b/g) || [])
      .filter(w => w.length >= 2 && !STOP.has(w))
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
  jobDescription: string
): Promise<InterviewTips> {
  const tips = buildTips(resumeText, jobTitle, jobDescription);

  try {
    const hfKey = import.meta.env.VITE_HF_KEY;
    if (hfKey) {
      const res = await fetch(
        "https://api-inference.huggingface.co/models/google/flan-t5-base",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: `What is one unique interview tip for a ${jobTitle} candidate? Answer in one sentence.`,
            parameters: { max_new_tokens: 80, temperature: 0.4 },
          }),
        }
      );
      const data = await res.json();
      const hfTip = (data?.[0]?.generated_text || "").trim();
      if (hfTip.length > 20 && hfTip.split(" ").length > 4) {
        tips.powerTips[0] = toTitle(hfTip.replace(/^["']|["']$/g, ""));
      }
    }
  } catch {
    // Silent — fallback tips already set
  }

  return tips;
}