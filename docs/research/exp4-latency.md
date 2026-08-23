---
title: EXP 4 — Component Latency
description: Where does the time go? A step-by-step breakdown of the AI scoring pipeline latency.
---

# EXP 4 — Per-Component Latency Breakdown

**Where does the time go? Which step in the scoring pipeline is the bottleneck?**

---

## Overview

| Component | Cold Latency | Warm (Cached) | % of Total (Cold) |
|-----------|-------------|--------------|------------------|
| Tokenisation | 0.24 ms | 0.24 ms | 0.2% |
| **Neural Embedding (MiniLM)** | **99.3 ms** | **0.001 ms** | **99.1%** |
| Cosine Similarity | 0.09 ms | 0.09 ms | 0.1% |
| Skill Match | 0.61 ms | 0.61 ms | 0.6% |
| **Total** | **~100.3 ms** | **~0.94 ms** | — |

**The embedding step is 99.1% of cold-path latency.** When cached, total scoring latency drops to under 1 ms.

---

## How We Got These Results

### Methodology

We measured each component in isolation using `time.perf_counter()` (microsecond resolution) on 200 randomly sampled pairs from the dataset.

```python
import time

for pair in dataset[:200]:
    resume = pair["resume_text"][:2000]
    jd     = pair["job_description"][:2000]

    # Component 1: Tokenisation
    t0 = time.perf_counter()
    tokenize(resume)
    tokenize(jd)
    tok_ms = (time.perf_counter() - t0) * 1000

    # Component 2: Neural embedding (MiniLM-L6-v2)
    t0 = time.perf_counter()
    rv = encode_cached(resume)   # encode_cached = MODEL.encode + LRU cache
    jv = encode_cached(jd)
    emb_ms = (time.perf_counter() - t0) * 1000

    # Component 3: Cosine similarity
    t0 = time.perf_counter()
    cosine_sim(rv, jv)
    cos_ms = (time.perf_counter() - t0) * 1000

    # Component 4: Skill match
    skills = [{"skill": s, "weight": 30} for s in ["python","java","sql","aws","docker"]]
    t0 = time.perf_counter()
    compute_skill_match(skills, jd)
    skl_ms = (time.perf_counter() - t0) * 1000
```

### Two modes

1. **Cold** — embedding cache is empty (first-ever request for that text)
2. **Warm** — embedding already in `ENCODE_CACHE` dict (production mode after warmup)

---

## Component Descriptions

### 1. Tokenisation (`tokenize`)

```python
def tokenize(text: str) -> Set[str]:
    words = re.findall(r"\b[a-z][a-z0-9+#.\-]{1,}\b", text.lower())
    return {w for w in words if len(w) >= 2 and w not in STOPWORDS}
```

Regex-based word extraction + stopword removal. **Very fast** at ~0.24ms because it's pure Python string ops, no model inference.

### 2. Neural Embedding (MiniLM-L6-v2)

```python
from sentence_transformers import SentenceTransformer
MODEL = SentenceTransformer("all-MiniLM-L6-v2")

def encode_cached(text: str) -> np.ndarray:
    key = text[:1500]
    if key not in ENCODE_CACHE:
        ENCODE_CACHE[key] = MODEL.encode(key, normalize_embeddings=True)
    return ENCODE_CACHE[key]
```

This is the **bottleneck**. The model runs a 6-layer transformer on the input, producing a 384-dimensional vector. On CPU without acceleration, this takes ~56–99ms depending on text length.

**In production:** Job description embeddings are computed once when a job is posted and stored. Resume embeddings are computed once on upload. Every match request then just does a cache lookup (0.001ms).

### 3. Cosine Similarity

```python
def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
```

Pure numpy dot product on 384-dim vectors. Extremely fast at ~0.09ms.

### 4. Skill Match Algorithm

```python
def compute_skill_match(skills: List[dict], job_text: str) -> float:
    job_tokens = tokenize(job_text)
    matched_weight = 0
    TARGET = 40  # target cumulative weight for full score
    for skill in skills:
        skill_name = skill.get("skill", "").strip().lower()
        weight     = max(int(skill.get("weight") or 5), 5)
        if tokenize(skill_name) & job_tokens:
            matched_weight += weight
    coverage = min(matched_weight / TARGET, 1.0)
    # Penalty for missing critical cloud/devops skills
    REQUIRED = ["azure","aws","gcp","docker","kubernetes","terraform"]
    missing = [k for k in REQUIRED if k in job_text.lower()
               and not any(k in s.get("skill","").lower() for s in skills)]
    return coverage * (0.8 ** min(len(missing), 4))
```

Token-based matching with weight accumulation. Runs in ~0.61ms on typical skill lists.

---

## Results

### Descriptive statistics

| Component | Mean (ms) | Std (ms) | Min (ms) | Max (ms) |
|-----------|-----------|----------|----------|----------|
| Tokenisation | 0.235 | 0.040 | 0.15 | 0.41 |
| Neural Embedding (cold) | 99.344 | 39.384 | 22.1 | 187.3 |
| Neural Embedding (warm) | 0.001 | 0.001 | 0.0003 | 0.008 |
| Cosine Similarity | 0.092 | 0.012 | 0.07 | 0.14 |
| Skill Match | 0.614 | 0.117 | 0.38 | 1.02 |
| **Total (cold)** | **100.284** | 39.417 | 22.8 | 189.0 |
| **Total (warm)** | **0.942** | 0.156 | 0.61 | 1.52 |

### Warm latency distribution summary

| Percentile | Total Warm Latency |
|-----------|-------------------|
| P50 | 0.91 ms |
| P75 | 1.04 ms |
| P95 | 1.24 ms |
| P99 | 1.48 ms |

---

## Charts

### Figure 4 — Latency breakdown: cold vs warm, pie chart, and distribution

![Component latency breakdown](/research/fig4_component_latency.png)

**Left panel** — Side-by-side bar chart comparing cold (solid) vs warm (transparent) latency per component. The embedding bar dwarfs everything else in cold mode; in warm mode, all bars are essentially zero.

**Middle panel** — Pie chart of cold-path latency composition. The embedding slice is 99.1% of the total — making it the single most important component to optimise (via caching).

**Right panel** — Distribution of total warm-path latency across 200 pairs. Tight around 0.94ms with P99 < 1.5ms.

---

## Interpretation

### Architectural implication

The embedding bottleneck is **by design a solved problem** via the caching architecture:

```
Job posted → compute JD embedding once → store in Redis/memory
Candidate applies → compute resume embedding once → store in profile
Match request → cache lookup for both → cosine similarity (0.09ms)
Total effective latency: ~1ms
```

This is why the platform can handle 10,000 concurrent users at 1.5% utilisation (see [EXP 7](/research/exp7-capacity)).

**For the paper:**

> "Profiling the AI scoring pipeline across 200 resume–JD pairs revealed that 99.1% of cold-path latency (mean 100.3ms) is attributable to the neural text embedding step (MiniLM-L6-v2, 384 dimensions). With the in-memory LRU cache warm, total scoring latency drops to 0.94ms (P99 < 1.5ms), enabling the system to handle thousands of match requests per second."

---

## Raw data

- **CSV:** [`research/results/component_latency.csv`](https://github.com/jatiiiiiiiin/asterix-job/blob/main/research/results/component_latency.csv) — 200 rows, columns: `tokenize_ms`, `embed_ms`, `cosine_ms`, `skill_ms`, `total_ms`
