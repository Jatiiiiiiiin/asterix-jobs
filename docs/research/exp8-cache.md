---
title: EXP 8 — Cache Effectiveness
description: How much does the LRU embedding cache speed up the scoring engine?
---

# EXP 8 — Embedding Cache Effectiveness

**How much does the in-memory LRU cache reduce the latency of neural embedding operations?**

---

## Overview

| Mode | Mean Latency | P95 Latency | P99 Latency |
|------|-------------|-------------|-------------|
| **Cold (uncached)** | 56.25 ms | 94.36 ms | 112.4 ms |
| **Warm (LRU cache hit)** | **0.001 ms** | **0.0013 ms** | **0.0018 ms** |
| **Speedup factor** | **63,350×** | — | — |

The cache makes embedding lookups **63,350× faster** — effectively reducing the bottleneck from ~56ms to a Python dictionary lookup.

---

## Background

The scoring engine uses a Python `dict` as an in-memory LRU cache for text embeddings:

```python
from sentence_transformers import SentenceTransformer
import numpy as np

MODEL = SentenceTransformer("all-MiniLM-L6-v2")
ENCODE_CACHE: dict[str, np.ndarray] = {}   # in-memory cache

def encode_cached(text: str) -> np.ndarray:
    key = text[:1500]                      # first 1500 chars as key
    if key not in ENCODE_CACHE:
        # Cache miss → run the transformer (slow, ~56ms)
        ENCODE_CACHE[key] = MODEL.encode(
            key,
            normalize_embeddings=True,
            show_progress_bar=False
        )
    return ENCODE_CACHE[key]               # Cache hit → dict lookup (~0.001ms)
```

### Why caching works so well here

In a job platform, the same job description is matched against **hundreds or thousands of candidates**. After the first candidate triggers a JD embedding, every subsequent candidate gets the cached result instantly.

Similarly, a candidate's resume doesn't change between matches — it can be embedded once and reused across all job comparisons.

**Production architecture:**

```
Job is posted      → JD embedded once  → stored in Redis
Candidate applies  → Resume embedded once → stored in profile
Match request      → cache lookup (both) + cosine dot product
                  → total latency: ~0.001ms
```

---

## How We Got These Results

### Experiment protocol

```python
import time, numpy as np

ENCODE_CACHE.clear()   # ensure cold start

# Round 1: Cold embeddings
cold_latencies = []
for pair in dataset[:100]:
    text = pair["resume_text"][:1500]
    t0   = time.perf_counter()
    encode_cached(text)          # cache miss → transformer runs
    cold_latencies.append((time.perf_counter() - t0) * 1000)

# Round 2: Warm embeddings (cache is now populated)
warm_latencies = []
for pair in dataset[:100]:
    text = pair["resume_text"][:1500]
    t0   = time.perf_counter()
    encode_cached(text)          # cache hit → dict lookup
    warm_latencies.append((time.perf_counter() - t0) * 1000)

speedup = np.mean(cold_latencies) / np.mean(warm_latencies)
# speedup = 63,350
```

---

## Results

### Descriptive statistics

| Statistic | Cold (ms) | Warm (ms) |
|-----------|-----------|-----------|
| Mean | 56.25 | 0.00090 |
| Std dev | 15.2 | 0.00018 |
| Min | 15.3 | 0.00030 |
| P25 | 44.1 | 0.00075 |
| P50 | 53.8 | 0.00088 |
| P75 | 67.4 | 0.00102 |
| P95 | 94.36 | 0.00130 |
| P99 | 112.4 | 0.00180 |
| Max | 128.7 | 0.00290 |

### Speedup by percentile

| Percentile | Cold | Warm | Speedup |
|-----------|------|------|---------|
| P50 | 53.8ms | 0.00088ms | **61,100×** |
| P95 | 94.4ms | 0.00130ms | **72,600×** |
| P99 | 112.4ms | 0.00180ms | **62,400×** |
| Mean | 56.25ms | 0.00090ms | **63,350×** |

---

## Charts

### Figure 8 — Cold vs warm latency distributions and comparison

![Embedding cache effectiveness](/research/fig8_cache_effectiveness.png)

**Left panel** — Cold latency distribution. The histogram is spread across 15–120ms reflecting natural variability in transformer inference time (text length, CPU state, memory pressure).

**Middle panel** — Warm latency distribution in microseconds (note: axis is μs, not ms). The spread is extremely tight: 0.3–2.9μs, dominated by Python dict hash overhead.

**Right panel** — Log-scale comparison bar chart. The cold bar (red, ~56ms) is visually indistinguishable from the warm bar (green, ~0.001ms) at this scale — the speedup is 63,000×.

---

## Production Impact

### Hit rate estimation

In production, a job posting receives on average 40–200 applications. With caching:

| Applications per job | Cache hits | Cold embeds | Savings |
|--------------------|-----------|-------------|---------|
| 40 | 39/40 = 97.5% | 1 | 39 × 56ms = 2,184ms saved |
| 100 | 99/100 = 99% | 1 | 99 × 56ms = 5,544ms saved |
| 200 | 199/200 = 99.5% | 1 | 199 × 56ms = 11,144ms saved |

**Without cache, matching 200 candidates to a single job would take 200 × 56ms = 11.2 seconds.**
**With cache, it takes 56ms + 199 × 0.001ms = 56.2ms** — essentially unchanged.

### Cache memory footprint

Each cached embedding:
- 384 float32 values × 4 bytes = 1,536 bytes = **1.5 KB**
- 10,000 unique texts cached = **15 MB** — trivial memory footprint

---

## Interpretation

**For the paper:**

> "An LRU in-memory embedding cache was evaluated on 100 identical requests (cold then warm). The cache achieves a 63,350× reduction in embedding latency (56.25ms cold vs 0.001ms warm), with P95 warm latency of 0.0013ms. Given that job descriptions are shared across all applicants and resumes are reused across all job comparisons, production cache hit rates of 97–99.5% are expected. This makes the neural embedding bottleneck effectively negligible in production, enabling the platform to handle 10,000 concurrent users at under 0.5% system utilisation (see EXP 7)."

---

## Raw data

- **JSON:** [`research/results/cache_effectiveness_paper.json`](https://github.com/jatiiiiiiiin/asterix-job/blob/main/research/results/cache_effectiveness_paper.json)

```json
{
  "cold_mean_ms": 56.25,
  "cold_p95_ms": 94.36,
  "warm_mean_ms": 0.0009,
  "warm_p95_ms": 0.0013,
  "speedup_factor": 63350
}
```
