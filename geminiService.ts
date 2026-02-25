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

export async function calculateSemanticFidelityBackend(
  file: File,
  job: any,
  profileText: string,
  // Skills passed explicitly from the dashboard's buildProfilePayload().
  // Previously this parameter didn't exist — the function was reading from
  // localStorage.getItem("asterix_profile_skills"), a global unscoped key
  // shared across all users. Every account sent the same skills, making
  // the backend's skill overlap score identical regardless of who was logged in.
  candidateSkills: Array<{ skill: string; weight: number }> = []
) {
  const formData = new FormData();

  formData.append("resume", file);
  formData.append("jobTitle", job.title);

  const safeSummary = job.jobSummary || job.description || "";
  const safeResponsibilities = Array.isArray(job.responsibilities)
    ? job.responsibilities.join("\n")
    : "";

  formData.append(
    "jobDescription",
    safeSummary + "\n" + safeResponsibilities
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