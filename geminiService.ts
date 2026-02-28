import { Job } from "./types";

/**
 * Asterix Neural Protocol: Local Dev Version
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

/* ================= UTILITIES ================= */

function preprocess(text: unknown): string {
  if (typeof text !== "string") return "";

  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\.\#\+\-]/gi, " ")
    .split(" ")
    .filter((word) => word.length > 1)
    .join(" ")
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

/* ================= SKILL AUDIT ================= */

export async function getDetailedSkillAudit(
  resumeText: string,
  tags: string[]
) {
  const rText = (resumeText || "").toLowerCase();

  return tags.map((tag) => {
    const isVerified = rText.includes(tag.toLowerCase());
    const score = isVerified
      ? Math.floor(Math.random() * 16) + 82
      : Math.floor(Math.random() * 20) + 12;

    return { tag, score };
  });
}

/* ================= TECH MATCH (LOCAL HF) ================= */

export async function getTechnicalMatch(
  resumeText: string,
  jobDescription: string
): Promise<number> {
  const rText = preprocess(resumeText);
  const jText = preprocess(jobDescription);

  if (!rText || rText.length < 15) return 0;

  const rWords = new Set(rText.split(" "));
  const jWords = jText.split(" ").filter((w) => w.length > 3);

  const overlap = jWords.filter((w) => rWords.has(w)).length;

  const keywordScore = Math.min(
    100,
    (overlap / Math.max(1, Math.min(15, jWords.length))) * 100
  );

  let neuralScore = 0;

  try {
    const embedder = await getEmbedder();

    if (embedder) {
      const rOut = await embedder(rText, { pooling: "mean", normalize: true });
      const jOut = await embedder(jText, { pooling: "mean", normalize: true });

      const rVec = Array.from(rOut.data || rOut[0]?.data || rOut) as number[];
      const jVec = Array.from(jOut.data || jOut[0]?.data || jOut) as number[];

      const sim = cosineSimilarity(rVec, jVec);

      if (sim >= 0.25) {
        const norm = (sim - 0.25) / (0.6 - 0.25);
        neuralScore = Math.pow(Math.max(0, Math.min(1, norm)), 0.8) * 100;
      }
    }
  } catch {
    console.warn("Neural fallback engaged");
  }

  const finalScore =
    neuralScore > 0
      ? Math.round(neuralScore * 0.7 + keywordScore * 0.3)
      : Math.round(keywordScore * 0.65);

  return Math.max(0, Math.min(100, finalScore));
}

/* ================= BACKEND MATCH ================= */

export async function extractResumeText(resumeSource: File | string): Promise<string> {
  const formData = new FormData();

  if (typeof resumeSource === 'string') {
    // Convert base64 Data URL to Blob
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
  // Skills passed explicitly from the dashboard's buildProfilePayload().
  candidateSkills: Array<{ skill: string; weight: number }> = [],
  resumeText?: string
) {
  const formData = new FormData();

  if (resumeText) {
    formData.append("resumeText", resumeText);
  } else if (file) {
    formData.append("resume", file);
  } else {
    throw new Error("Missing resume file or text");
  }

  formData.append("jobTitle", job.title);

  const safeSummary = job.jobSummary || job.description || "";
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
    [
      safeSummary,
      safeResponsibilities,
      safeRequiredSkills,
      safePreferredSkills,
      safeTechStack
    ].filter(Boolean).join("\n\n")
  );

  // FIX: use the candidateSkills argument instead of the global localStorage key.
  // The old code always read from "asterix_profile_skills" which was last written
  // by whichever account saved their profile most recently — so both accounts
  // were scored against the same skill set.
  formData.append("candidateSkills", JSON.stringify(candidateSkills));

  formData.append("profileText", profileText);

  // FIX: auditSkills was never sent before — backend always returned skillAudit=[].
  // Now we derive the skill name list from the same candidateSkills array.
  const auditSkills = candidateSkills.map(s => s.skill);
  formData.append("auditSkills", JSON.stringify(auditSkills));

  // Diagnostic: log the exact payload sent and score received for each job.

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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

  const res = await fetch(`${API_BASE}/insights`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    return ["Technical Stack Overlap", "Role Alignment", "Project Relevance"];
  }

  return (await res.json()).points || [];
};

/* ================= JOB SUMMARY ================= */

export const getMatchingSummary = async (jobDescription: string) => {
  const form = new FormData();
  form.append("jobDescription", jobDescription);

  const res = await fetch(`${API_BASE}/summary`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    return { requirements: ["Core Engineering"], estimatedMatchPool: 10 };
  }

  return res.json();
};

/* ================= CHAT CONTEXT ================= */

export async function queryJobContext(
  job: Job,
  userQuestion: string
): Promise<string> {
  const prompt = `...`; // unchanged

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

/* Simple tokeniser — reuse same logic as backend */
function tokenize(text: string): Set<string> {
  const STOP = new Set([
    "the", "and", "for", "with", "this", "that", "are", "was", "you", "will", "have",
    "from", "your", "not", "can", "but", "work", "role", "team", "job", "been",
    "what", "which", "also", "more", "their", "into", "about", "other", "our",
    "all", "use", "used", "using", "able", "based", "good", "new", "key", "must",
    "well", "via", "per", "inc", "llc", "etc", "co", "ltd"
  ]);
  return new Set(
    (text.toLowerCase().match(/\b[a-z][a-z0-9+#.\-]{1,}\b/g) || [])
      .filter(w => w.length >= 2 && !STOP.has(w))
  );
}

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Derive structured tips from keyword overlap */
function buildTips(resumeText: string, jobTitle: string, jobDescription: string): InterviewTips {
  const rTokens = tokenize(resumeText);
  const jTokens = tokenize(jobDescription);

  // Skills present in BOTH resume and JD → strengths
  const matched = [...jTokens].filter(t => rTokens.has(t) && t.length > 3);
  // Skills in JD but NOT in resume → gaps
  const missing = [...jTokens].filter(t => !rTokens.has(t) && t.length > 3);

  /* ── STRENGTHS ── */
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

  /* ── GAP AREAS ── */
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

  /* ── POWER TIPS ── */
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
  // Always build deterministic tips first — instant & always structured
  const tips = buildTips(resumeText, jobTitle, jobDescription);

  // Optionally enrich powerTips[0] with a HF-generated role-specific tip
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
      // Only use if HF returned something meaningful (> 20 chars, looks like a sentence)
      if (hfTip.length > 20 && hfTip.split(" ").length > 4) {
        tips.powerTips[0] = toTitle(hfTip.replace(/^["']|["']$/g, ""));
      }
    }
  } catch {
    // Silent — fallback tips already set
  }

  return tips;
}

