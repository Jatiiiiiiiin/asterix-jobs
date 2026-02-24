# ================= IMPORTS =================

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pdfplumber
import numpy as np
import json
import math
import re
import os
import hmac
import hashlib
import razorpay
from dotenv import load_dotenv

from sentence_transformers import SentenceTransformer
from optimum.onnxruntime import ORTModelForSeq2SeqLM
from transformers import AutoTokenizer, pipeline


# ================= APP =================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= GLOBAL MODELS =================

embedder: SentenceTransformer | None = None
_generator = None


# ================= STARTUP =================

@app.on_event("startup")
def load_models():
    global embedder

    if embedder is None:
        embedder = SentenceTransformer(
            "sentence-transformers/paraphrase-MiniLM-L3-v2",
            backend="onnx",
            model_kwargs={"file_name": "model_quantized.onnx"}
        )


def get_generator():
    """Lazy load generator only when needed"""
    global _generator
    if _generator is None:
        tokenizer = AutoTokenizer.from_pretrained("optimum/flan-t5-small")
        ort_model = ORTModelForSeq2SeqLM.from_pretrained(
            "optimum/flan-t5-small",
            provider="CPUExecutionProvider"
        )
        _generator = pipeline(
            "text2text-generation",
            model=ort_model,
            tokenizer=tokenizer
        )
    return _generator


# ================= HELPERS =================

def extract_pdf_text(file: UploadFile) -> str:
    file.file.seek(0)
    text = ""
    with pdfplumber.open(file.file) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text.strip()


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def build_job_text(title: str, description: str) -> str:
    return f"Role: {title}\n\nJob Description:\n{description}".strip()


def tokenize(text: str) -> set:
    STOPWORDS = {
        "the", "and", "for", "with", "this", "that", "are",
        "you", "will", "have", "from", "your", "not", "can",
        "work", "role", "team", "job"
    }
    words = re.findall(r"[a-z][a-z0-9+#.]*", text.lower())
    return {w for w in words if len(w) >= 3 and w not in STOPWORDS}


def semantic_delta(text: str, job_vec: np.ndarray) -> float:
    BASELINE = 0.18
    if not text.strip():
        return 0.0

    vec = embedder.encode(text, normalize_embeddings=True)
    raw = cosine_sim(vec, job_vec)

    return max(0.0, (raw - BASELINE) / (1.0 - BASELINE))


def explicit_skill_overlap(skills: list, job_text: str) -> float:
    if not skills:
        return 0.0

    job_tokens = tokenize(job_text)
    hits = 0
    total = 0

    for s in skills:
        name = (s.get("skill") or "").lower().strip()
        weight = max(int(s.get("weight") or 1), 1)
        total += weight

        if not name:
            continue

        if tokenize(name) & job_tokens:
            hits += weight

    return hits / total if total else 0.0


def profile_completeness(profile_text: str, skills: list) -> float:
    score = 0.0

    meaningful = [w for w in profile_text.split() if len(w) > 3]
    score += min(len(meaningful) / 40, 1.0) * 0.4

    score += min(len(skills) / 4, 1.0) * 0.4

    has_exp = " at " in profile_text.lower()
    score += 0.2 if has_exp else 0.0

    return max(0.4, min(1.0, score))


def compute_skill_mastery(skill, resume_vec, job_vec, profile_vec) -> int:
    skill_vec = embedder.encode(skill.lower(), normalize_embeddings=True)

    raw = (
        0.6 * np.dot(skill_vec, resume_vec) +
        0.2 * np.dot(skill_vec, job_vec) +
        0.2 * np.dot(skill_vec, profile_vec)
    )

    mastery = 1 - math.exp(-3 * raw)
    return round(max(0.0, min(1.0, mastery)) * 100)


# ================= HEALTH =================

@app.get("/")
def health():
    return {"status": "ok"}


# ================= MATCH =================

@app.post("/match")
async def match_resume(
    resume: UploadFile = File(...),
    jobTitle: str = Form(...),
    jobDescription: str = Form(...),
    candidateSkills: str = Form(...),
    profileText: str = Form(""),
    auditSkills: str = Form(None)
):
    resume_text = extract_pdf_text(resume)[:1200]
    if len(resume_text) < 50:
        return {"fidelityScore": 0, "skillAudit": [], "breakdown": {}}

    job_text = build_job_text(jobTitle, jobDescription[:1000])
    profile_text = profileText[:800]

    skills = json.loads(candidateSkills)
    audit = json.loads(auditSkills) if auditSkills else []

    resume_vec = embedder.encode(resume_text, normalize_embeddings=True)
    job_vec = embedder.encode(job_text, normalize_embeddings=True)

    resume_score = semantic_delta(resume_text, job_vec)
    profile_score = semantic_delta(profile_text, job_vec)
    completeness = profile_completeness(profile_text, skills)
    skill_overlap = explicit_skill_overlap(skills, job_text)

    raw_score = (
        0.40 * resume_score +
        0.35 * profile_score * completeness +
        0.25 * skill_overlap
    )

    final_score = 1 - math.exp(-4 * raw_score)

    profile_vec = embedder.encode(profile_text or " ", normalize_embeddings=True)

    skill_audit = [
        {
            "skill": s.upper(),
            "score": compute_skill_mastery(s, resume_vec, job_vec, profile_vec)
        }
        for s in audit
    ]

    return {
        "fidelityScore": round(final_score * 100),
        "skillAudit": skill_audit,
        "breakdown": {
            "resume": round(resume_score * 100),
            "profile": round(profile_score * 100),
            "completeness": round(completeness * 100),
            "skills": round(skill_overlap * 100)
        }
    }


# ================= INSIGHTS =================

@app.post("/insights")
async def insights(candidateName: str = Form(...), jobTitle: str = Form(...)):
    gen = get_generator()
    prompt = f"""
Give 3 bullet points explaining why {candidateName}
is a good fit for {jobTitle}.
Each bullet under 12 words.
"""
    result = gen(prompt, max_length=96)[0]["generated_text"]

    bullets = [
        l.strip("-• ").strip()
        for l in result.split("\n")
        if len(l.strip()) > 8
    ]

    return {"points": bullets[:3]}


# ================= SUMMARY =================

@app.post("/summary")
async def summary(jobDescription: str = Form(...)):
    gen = get_generator()
    prompt = f"""
Extract top 3 technical skills.
Return comma separated list only.

{jobDescription[:800]}
"""
    result = gen(prompt, max_length=64)[0]["generated_text"]
    skills = [s.strip() for s in result.split(",") if len(s.strip()) > 2]

    return {"requirements": skills[:3]}


# ================= CHAT =================

class ChatRequest(BaseModel):
    jobTitle: str
    jobDescription: str
    question: str
    history: List[dict] = []


@app.post("/chat")
async def chat(req: ChatRequest):
    gen = get_generator()
    prompt = f"""
You are a professional job assistant.
Use ONLY the info below.
Answer in bullet points.

Job: {req.jobTitle}

Description:
{req.jobDescription[:800]}

Question:
{req.question}
"""
    result = gen(prompt, max_length=256)[0]["generated_text"]
    return {"answer": result.strip()}


# ================= PAYMENTS =================

load_dotenv()

razorpay_client = razorpay.Client(
    auth=(
        os.getenv("RAZORPAY_KEY_ID"),
        os.getenv("RAZORPAY_KEY_SECRET")
    )
)


class CreateOrderRequest(BaseModel):
    amount: int


@app.post("/payments/create-order")
async def create_order(data: CreateOrderRequest):
    return razorpay_client.order.create({
        "amount": data.amount * 100,
        "currency": "INR",
        "receipt": f"asterix_{os.urandom(4).hex()}"
    })


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@app.post("/payments/verify")
async def verify_payment(data: VerifyPaymentRequest):
    body = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"

    expected = hmac.new(
        os.getenv("RAZORPAY_KEY_SECRET").encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()

    return {"success": expected == data.razorpay_signature}


# ================= RUN =================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000))
    )