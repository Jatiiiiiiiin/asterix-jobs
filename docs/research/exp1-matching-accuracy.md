---
title: EXP 1 — Matching Accuracy
description: How well does the Asterix AI engine score resumes against job descriptions, compared to human recruiter judgements?
---

# EXP 1 — AI Score vs Gold Standard

**How well does the Asterix AI engine score resumes against job descriptions compared to human recruiter judgements?**

---

## Overview

| | |
|--|--|
| **N** | 300 resume–job-description pairs |
| **Ground truth** | Human recruiter panel scores (0–100) |
| **Model** | `sentence-transformers/all-MiniLM-L6-v2` + Skill Match |
| **Correlation (Pearson r)** | **0.843** (p < 0.001) |
| **MAE** | **8.31%** |
| **RMSE** | **10.47%** |

---

## How We Got These Results

### Step 1 — Data preparation

We used the `datasets/semantic_matching.json` dataset, containing 300 real-world pairs. Each pair has:

- `resume_text` — candidate's full resume as plain text
- `job_description` — job posting text
- `gold_standard_score` — recruiter panel consensus score (0–100)

```json
{
  "job_title": "Backend Software Engineer",
  "resume_text": "John Doe, 3 years Python, Django, PostgreSQL...",
  "job_description": "We need a backend engineer with Python and REST API experience...",
  "gold_standard_score": 78
}
```

### Step 2 — Engine scoring

For each pair, we ran the production scoring function (no modifications):

```python
result = score_pair(
    resume_text   = pair["resume_text"],
    job_title     = pair["job_title"],
    job_desc      = pair["job_description"],
    skills        = [],          # no skill list in this experiment
    profile_text  = ""
)
ai_score = result["score_pct"]  # 0–100 integer
```

The function applies the **three-component formula**:

```
Final = 0.30 × Semantic  +  0.50 × Skill  +  0.20 × (Profile×0.7 + Quality×0.3)
```

followed by a `x^1.25` power scaling to push good matches higher.

### Step 3 — Metric computation

```python
from scipy import stats
import numpy as np

gold  = match_df["gold_standard_pct"].values
preds = match_df["ai_score_pct"].values
error = np.abs(gold - preds)

MAE        = np.mean(error)                    # 8.31
RMSE       = np.sqrt(np.mean(error**2))        # 10.47
Pearson_r  = np.corrcoef(gold, preds)[0,1]     # 0.843
Spearman_r = stats.spearmanr(gold, preds).statistic
```

---

## Results

### Primary metrics

| Metric | Value | Interpretation |
|--------|-------|---------------|
| **Pearson r** | **0.843** (p < 0.001) | Strong positive linear correlation |
| **Spearman ρ** | **0.817** (p < 0.001) | Robust to outliers |
| **MAE** | **8.31%** | Average error magnitude |
| **RMSE** | **10.47%** | Penalises large errors more |
| **Mean latency** | 47.6 ms | Includes first-time embedding cost |
| **Median latency** | 1.02 ms | Cached-path latency (production mode) |
| **P95 latency** | 175 ms | 95th percentile cold-start |
| **P99 latency** | 228 ms | Worst-case cold-start |

### Latency breakdown

| Percentile | Latency |
|-----------|---------|
| P50 (median) | 1.02 ms |
| P75 | 3.4 ms |
| P95 | 175 ms |
| P99 | 228 ms |
| Mean | 47.6 ms |

> The bimodal distribution (1ms median vs 47ms mean) shows the cache effect in action: 80%+ of requests in production hit the embedding cache and return in ~1ms; the long tail represents first-time embeds.

---

## Charts

### Figure 1 — Score correlation and error distribution

![AI Score vs Gold Standard — scatter plot and error histogram](/research/fig1_matching_accuracy.png)

**Left panel** — Each point is one resume–JD pair. The dashed line is perfect agreement (y = x). The solid blue line is the fitted regression (slope = 0.88, intercept = 6). The colour encodes absolute error: green = low error, red = high error.

**Right panel** — Distribution of absolute errors. The MAE (red dashed) at 8.31% and RMSE (orange dashed) at 10.47% both confirm the engine stays within ~10 percentage points of human judgement on average.

---

## Interpretation

**What a Pearson r of 0.843 means:** For every 10-point increase in the human score, the AI predicts approximately an 8.8-point increase. This is a strong result — human recruiters themselves disagree by 10–15% on average on the same resume, so the AI is within inter-annotator variance.

**What MAE = 8.31% means in practice:**
- If a recruiter gives a candidate 75%, Asterix AI will on average score that candidate between **66.7% and 83.3%**.
- This is well within acceptable precision for a shortlisting tool.

**Why not 100% correlation?** The engine uses pure text semantics + a skill-weight table. Human recruiters also factor in soft cues (formatting, word choice, confidence signals) that are harder to capture in a scoring formula.

---

## Raw data

- **CSV:** [`research/results/real_matching_accuracy.csv`](https://github.com/jatiiiiiiiin/asterix-job/blob/main/research/results/real_matching_accuracy.csv) — 300 rows, columns: `job_title`, `gold_standard_pct`, `ai_score_pct`, `error_margin`, `elapsed_ms`, `embed_ms`
- **Stats JSON:** [`research/results/matching_stats_paper.json`](https://github.com/jatiiiiiiiin/asterix-job/blob/main/research/results/matching_stats_paper.json)

---

## Script

```bash
python research/scripts/real_research_pipeline.py
# Outputs: research/results/real_matching_accuracy.csv
#          research/results/matching_stats_paper.json
#          docs/public/research/fig1_matching_accuracy.png
```
