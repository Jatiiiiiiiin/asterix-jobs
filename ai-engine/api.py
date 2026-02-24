# ================= IMPORTS =================

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Set
import pdfplumber
import numpy as np
import json
import math
import re
import os
import hmac
import hashlib
from functools import lru_cache
from io import BytesIO

from dotenv import load_dotenv
load_dotenv()

# ================= APP =================

app = FastAPI()

# ================= CORS CONFIGURATION =================
# Allow both localhost (dev) and production domains

FRONTEND_URL = os.getenv("FRONTEND_URL")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://asterix-jobs.vercel.app",
    "https://www.asterix-jobs.vercel.app",
]

if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# filter empty values BEFORE adding middleware
ALLOWED_ORIGINS = [o for o in ALLOWED_ORIGINS if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= LIGHTWEIGHT EMBEDDER =================

class FastEmbedder:
    """Memory-efficient hash-based embedder"""
    
    def __init__(self, dim: int = 96):
        self.dim = dim
        
    @lru_cache(maxsize=1024)
    def encode(self, text: str, normalize: bool = True) -> np.ndarray:
        """Generate lightweight embeddings"""
        tokens = self._extract_tokens(text)
        
        vec = np.zeros(self.dim, dtype=np.float32)
        for token in tokens:
            idx = hash(token) % self.dim
            vec[idx] += 1.0
        
        if normalize and np.linalg.norm(vec) > 0:
            vec = vec / np.linalg.norm(vec)
            
        return vec
    
    def _extract_tokens(self, text: str) -> Set[str]:
        """Extract meaningful tokens"""
        STOPWORDS = {
            "the", "and", "for", "with", "this", "that", "are", "was",
            "you", "will", "have", "from", "your", "not", "can", "but",
            "work", "role", "team", "job", "been", "what", "which", "also"
        }
        
        words = re.findall(r'\b[a-z][a-z0-9+#.\-]{1,}\b', text.lower())
        return {w for w in words if len(w) >= 2 and w not in STOPWORDS}


# ================= GLOBALS =================

embedder: FastEmbedder | None = None


# ================= STARTUP =================

@app.on_event("startup")
def initialize():
    global embedder
    embedder = FastEmbedder(dim=96)
    print("[Startup] Lightweight embedder initialized")
    print(f"[Startup] CORS Allowed Origins: {ALLOWED_ORIGINS}")


# ================= PDF EXTRACTION =================

def extract_text_from_pdf(file: UploadFile) -> str:
    """Robust PDF text extraction with fallbacks"""
    try:
        file.file.seek(0)
        content = file.file.read()
        
        print(f"[PDF] File: {file.filename}, Size: {len(content)} bytes")
        
        with pdfplumber.open(BytesIO(content)) as pdf:
            total_pages = len(pdf.pages)
            print(f"[PDF] Pages: {total_pages}")
            
            text_parts = []
            
            for i, page in enumerate(pdf.pages[:3]):  # Max 3 pages
                # Try text extraction
                page_text = page.extract_text()
                
                if not page_text or len(page_text.strip()) < 50:
                    # Fallback: extract from tables
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            if row:
                                text_parts.append(" ".join([str(cell) for cell in row if cell]))
                else:
                    text_parts.append(page_text)
                
                print(f"[PDF] Page {i+1}: {len(page_text or '')} chars extracted")
                
                # Stop if we have enough content
                combined = " ".join(text_parts)
                if len(combined) > 2500:
                    break
            
            final_text = " ".join(text_parts).strip()
            final_text = re.sub(r'\s+', ' ', final_text)  # Normalize whitespace
            final_text = final_text[:3000]  # Hard limit
            
            print(f"[PDF] Final length: {len(final_text)} chars")
            print(f"[PDF] Preview: {final_text[:150]}...")
            
            return final_text
            
    except Exception as e:
        print(f"[PDF ERROR] {type(e).__name__}: {str(e)}")
        return ""


# ================= TEXT PROCESSING =================

def tokenize(text: str) -> Set[str]:
    """Extract meaningful tokens from text"""
    STOPWORDS = {
        "the", "and", "for", "with", "this", "that", "are", "was",
        "you", "will", "have", "from", "your", "not", "can", "but",
        "work", "role", "team", "job", "been", "what", "which", "also",
        "more", "their", "into", "through", "about", "other"
    }
    
    # Extract alphanumeric words, keeping special chars like C++, .NET
    words = re.findall(r'\b[a-z][a-z0-9+#.\-]{1,}\b', text.lower())
    tokens = {w for w in words if len(w) >= 2 and w not in STOPWORDS}
    
    return tokens


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Calculate cosine similarity between vectors"""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return float(np.dot(a, b) / (norm_a * norm_b))


# ================= SCORING FUNCTIONS =================

def compute_semantic_score(text: str, job_text: str) -> float:
    """Compute semantic similarity between text and job"""
    
    if not text or len(text) < 30:
        print(f"[Score] Text too short: {len(text)} chars")
        return 0.0
    
    # Step 1: Token overlap (fast initial filter)
    text_tokens = tokenize(text)
    job_tokens = tokenize(job_text)
    
    overlap_count = len(text_tokens & job_tokens)
    job_token_count = len(job_tokens)
    
    if job_token_count == 0:
        return 0.0
    
    keyword_ratio = overlap_count / job_token_count
    
    print(f"[Score] Tokens: {len(text_tokens)} text, {job_token_count} job")
    print(f"[Score] Overlap: {overlap_count} tokens ({keyword_ratio:.1%})")
    
    # If very low overlap, skip expensive embedding computation
    if keyword_ratio < 0.03:
        print(f"[Score] Keyword ratio too low, returning 0")
        return 0.0
    
    # Step 2: Embedding similarity
    try:
        text_vec = embedder.encode(text[:1000], normalize=True)
        job_vec = embedder.encode(job_text[:1000], normalize=True)
        
        cosine = cosine_similarity(text_vec, job_vec)
        print(f"[Score] Cosine similarity: {cosine:.3f}")
        
        # Normalize: typical range is 0.1-0.5 for real matches
        BASELINE = 0.12
        CEILING = 0.55
        
        if cosine < BASELINE:
            return 0.0
        
        normalized = (cosine - BASELINE) / (CEILING - BASELINE)
        final_score = min(1.0, max(0.0, normalized))
        
        print(f"[Score] Normalized score: {final_score:.3f}")
        return final_score
        
    except Exception as e:
        print(f"[Score ERROR] {e}")
        return keyword_ratio * 0.5  # Fallback to keyword score


def compute_skill_match(skills: List[dict], job_text: str) -> float:
    """Calculate weighted skill overlap"""
    if not skills:
        print("[Skills] No skills provided")
        return 0.0
    
    job_tokens = tokenize(job_text)
    
    total_weight = 0
    matched_weight = 0
    matched_skills = []
    
    for skill_obj in skills:
        skill_name = (skill_obj.get("skill") or "").strip().lower()
        weight = max(int(skill_obj.get("weight") or 1), 1)
        
        if not skill_name:
            continue
        
        total_weight += weight
        skill_tokens = tokenize(skill_name)
        
        if skill_tokens & job_tokens:
            matched_weight += weight
            matched_skills.append(skill_name)
    
    if total_weight == 0:
        return 0.0
    
    match_ratio = matched_weight / total_weight
    
    print(f"[Skills] Matched: {matched_skills[:5]}")
    print(f"[Skills] Score: {matched_weight}/{total_weight} ({match_ratio:.1%})")
    
    return match_ratio


def compute_profile_quality(profile_text: str, skills: List[dict]) -> float:
    """Assess profile completeness"""
    score = 0.0
    
    # Content length check (40%)
    meaningful_words = [w for w in profile_text.split() if len(w) > 3]
    word_score = min(len(meaningful_words) / 40.0, 1.0)
    score += word_score * 0.4
    
    # Skill count check (40%)
    skill_score = min(len(skills) / 5.0, 1.0)
    score += skill_score * 0.4
    
    # Experience indicators (20%)
    exp_markers = [" at ", " in ", "years", "experience", "worked"]
    has_exp = any(marker in profile_text.lower() for marker in exp_markers)
    score += 0.2 if has_exp else 0.0
    
    print(f"[Profile] Quality: {score:.1%} (words={word_score:.1%}, skills={skill_score:.1%}, exp={has_exp})")
    
    return max(0.3, min(1.0, score))


def compute_skill_mastery(
    skill: str,
    resume_tokens: Set[str],
    job_tokens: Set[str],
    profile_tokens: Set[str]
) -> int:
    """Score individual skill mastery"""
    skill_tokens = tokenize(skill)
    
    if not skill_tokens:
        return 25
    
    # Calculate overlap ratios
    resume_match = len(skill_tokens & resume_tokens) / len(skill_tokens)
    job_match = len(skill_tokens & job_tokens) / len(skill_tokens)
    profile_match = len(skill_tokens & profile_tokens) / len(skill_tokens)
    
    # Weighted combination
    base_score = (
        0.50 * resume_match +
        0.30 * job_match +
        0.20 * profile_match
    )
    
    # Add deterministic variance for realism
    variance = ((hash(skill) % 30) - 15) / 100.0
    final = base_score + variance
    
    return max(10, min(100, round(final * 100)))


def generate_highlights(
    resume_tokens: Set[str],
    job_tokens: Set[str],
    skills: List[dict],
    profile_text: str,
    score: int
) -> List[str]:
    """Generate contextual match insights"""
    highlights = []
    
    # Find matched skills
    matched_skills = []
    for skill_obj in skills[:8]:
        skill_name = (skill_obj.get("skill") or "").strip().lower()
        if skill_name and tokenize(skill_name) & job_tokens:
            matched_skills.append(skill_name.title())
    
    if matched_skills:
        highlights.append(f"Matched skills: {', '.join(matched_skills[:4])}")
    
    # Experience check
    has_exp = any(m in profile_text.lower() for m in [" at ", "years", "experience"])
    if has_exp:
        highlights.append("Relevant experience found in profile")
    
    # Score-based insight
    if score >= 75:
        highlights.append("Excellent alignment with role requirements")
    elif score >= 60:
        highlights.append("Strong match for this position")
    elif score >= 40:
        highlights.append("Moderate fit with development areas")
    else:
        highlights.append("Skills gap identified - focus on key requirements")
    
    # Token overlap insight
    overlap = len(resume_tokens & job_tokens)
    if overlap > 20:
        highlights.append("High technical vocabulary match")
    elif overlap > 10:
        highlights.append("Good keyword alignment")
    
    return highlights[:3]


# ================= HEALTH =================

@app.get("/")
def health():
    return {
        "status": "operational",
        "mode": "lightweight",
        "version": "2.0",
        "environment": "render"
    }


# ================= MATCH ENDPOINT =================

@app.post("/match")
async def match_resume(
    resume: UploadFile = File(...),
    jobTitle: str = Form(...),
    jobDescription: str = Form(...),
    candidateSkills: str = Form(...),
    profileText: str = Form(""),
    auditSkills: str = Form(None)
):
    print(f"\n{'='*70}")
    print(f"[REQUEST] Job: {jobTitle}")
    print(f"[REQUEST] Resume: {resume.filename}")
    print(f"{'='*70}")
    
    # Extract resume text
    resume_text = extract_text_from_pdf(resume)
    
    if len(resume_text) < 100:
        print(f"[ERROR] Resume text too short: {len(resume_text)} chars")
        return {
            "fidelityScore": 0,
            "skillAudit": [],
            "matchHighlights": ["PDF extraction failed - check file format"],
            "breakdown": {"resume": 0, "profile": 0, "completeness": 0, "skills": 0}
        }
    
    # Prepare inputs
    job_text = f"Role: {jobTitle}\n\n{jobDescription[:700]}".strip()
    profile_text = profileText[:800]
    
    print(f"\n[INPUT] Resume: {len(resume_text)} chars")
    print(f"[INPUT] Job: {len(job_text)} chars")
    print(f"[INPUT] Profile: {len(profile_text)} chars")
    
    # Parse skills
    skills = json.loads(candidateSkills)
    audit_skills = json.loads(auditSkills) if auditSkills else []
    
    print(f"[INPUT] Skills: {len(skills)}, Audit: {len(audit_skills)}")
    
    # Tokenize once
    resume_tokens = tokenize(resume_text)
    job_tokens = tokenize(job_text)
    profile_tokens = tokenize(profile_text)
    
    # Compute scores
    print(f"\n[SCORING] Computing resume match...")
    resume_score = compute_semantic_score(resume_text, job_text)
    
    print(f"\n[SCORING] Computing profile match...")
    profile_score = compute_semantic_score(profile_text, job_text)
    
    print(f"\n[SCORING] Computing skill overlap...")
    skill_score = compute_skill_match(skills, job_text)
    
    print(f"\n[SCORING] Computing profile quality...")
    quality_score = compute_profile_quality(profile_text, skills)
    
    # Final weighted score
    raw_score = (
        0.45 * resume_score +
        0.30 * profile_score * quality_score +
        0.25 * skill_score
    )
    
    # Apply exponential scaling for better distribution
    final_score = 1.0 - math.exp(-3.5 * raw_score)
    final_score_pct = round(final_score * 100)
    
    print(f"\n[RESULT] Raw: {raw_score:.3f} → Final: {final_score_pct}%")
    print(f"[BREAKDOWN] Resume: {resume_score:.2%}, Profile: {profile_score:.2%}, Skills: {skill_score:.2%}, Quality: {quality_score:.2%}")
    
    # Skill audit
    skill_audit = [
        {
            "skill": s.upper(),
            "score": compute_skill_mastery(s, resume_tokens, job_tokens, profile_tokens)
        }
        for s in audit_skills[:12]
    ]
    
    # Generate insights
    highlights = generate_highlights(
        resume_tokens,
        job_tokens,
        skills,
        profile_text,
        final_score_pct
    )
    
    print(f"[HIGHLIGHTS] {highlights}\n")
    
    return {
        "fidelityScore": final_score_pct,
        "skillAudit": skill_audit,
        "matchHighlights": highlights,
        "breakdown": {
            "resume": round(resume_score * 100),
            "profile": round(profile_score * 100),
            "completeness": round(quality_score * 100),
            "skills": round(skill_score * 100)
        }
    }


# ================= INSIGHTS =================

@app.post("/insights")
async def insights(candidateName: str = Form(...), jobTitle: str = Form(...)):
    """Generate role-specific insights"""
    
    insights_list = [
        f"Technical competencies align with {jobTitle} requirements",
        "Profile demonstrates relevant domain experience",
        "Skills portfolio matches role expectations"
    ]
    
    return {"points": insights_list}


# ================= SUMMARY =================

@app.post("/summary")
async def summary(jobDescription: str = Form(...)):
    """Extract key requirements from job description"""
    
    tech_keywords = [
        "python", "javascript", "typescript", "java", "react", "angular", "vue",
        "node", "express", "django", "flask", "sql", "mongodb", "postgresql",
        "aws", "azure", "gcp", "docker", "kubernetes", "git", "ci", "cd",
        "api", "rest", "graphql", "frontend", "backend", "fullstack",
        "machine learning", "data", "ai", "cloud", "devops"
    ]
    
    desc_lower = jobDescription.lower()
    found = [kw.title() for kw in tech_keywords if kw in desc_lower]
    
    return {
        "requirements": found[:4] if found else ["Technical Skills", "Communication", "Problem Solving"]
    }


# ================= CHAT =================

class ChatRequest(BaseModel):
    jobTitle: str
    jobDescription: str
    question: str
    history: List[dict] = []


@app.post("/chat")
async def chat(req: ChatRequest):
    """Simple Q&A about job roles"""
    
    q = req.question.lower()
    
    if "salary" in q or "pay" in q or "compensation" in q:
        answer = "Compensation details are typically discussed during the interview process. Focus on demonstrating your value first."
    elif "skill" in q or "requirement" in q or "qualification" in q:
        answer = f"For the {req.jobTitle} role, review the job description carefully. Key qualifications are typically listed in the requirements section."
    elif "experience" in q or "year" in q:
        answer = "Experience requirements vary by role. Check the job posting for specific details about required years of experience."
    elif "culture" in q or "team" in q or "environment" in q:
        answer = "Company culture and team dynamics are best explored during interviews. Ask about day-to-day responsibilities and team structure."
    else:
        answer = "For specific details about this position, please refer to the complete job description or reach out to the hiring team."
    
    return {"answer": answer}


# ================= PAYMENTS =================

load_dotenv()



class CreateOrderRequest(BaseModel):
    amount: int


# ================= RUN =================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        workers=1,
        log_level="info"
    )