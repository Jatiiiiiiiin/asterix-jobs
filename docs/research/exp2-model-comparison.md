---
title: EXP 2 — Model Comparison
description: How does the Asterix AI engine compare to a simple TF-IDF keyword-matching baseline?
---

# EXP 2 — Asterix AI vs TF-IDF Baseline

**How much better is the neural approach compared to classic keyword frequency matching?**

---

## Overview

| Model | Pearson r | MAE (%) | RMSE (%) |
|-------|-----------|---------|----------|
| **Asterix AI Engine** (MiniLM + Skill Match) | **0.843** | **8.31** | **10.47** |
| TF-IDF Baseline (keyword frequency only) | 0.612 | 12.53 | 15.89 |
| **Improvement** | **+37.7%** | **−33.7%** | **−34.1%** |

---

## What is TF-IDF?

**TF-IDF** (Term Frequency–Inverse Document Frequency) is a classical information retrieval algorithm that measures how important a word is to a document relative to a corpus. It:

- Counts how often each word appears in the resume
- Down-weights words that appear in many documents (common words)
- Computes cosine similarity between the TF-IDF vectors of resume and JD

It has **no semantic understanding** — "software developer" and "software engineer" are completely different to TF-IDF, even though they mean the same thing to a recruiter.

### TF-IDF implementation used

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

vectorizer = TfidfVectorizer(max_features=5000, stop_words="english")
tfidf_matrix = vectorizer.fit_transform([resume_text[:3000], job_description[:3000]])
cosine_score = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]
tfidf_pct    = round(cosine_score * 100, 2)
```

This is the same implementation used in many entry-level ATS (Applicant Tracking Systems).

---

## How We Got These Results

### Step 1 — Run both models on all 300 pairs

For each pair in `datasets/semantic_matching.json`:

1. **Asterix AI:** `score_pair(resume_text, job_title, job_desc)` — full neural pipeline
2. **TF-IDF:** `TfidfVectorizer` + cosine similarity (above snippet)

Both produce a 0–100 score for each pair.

### Step 2 — Compare against gold standard

```python
from scipy import stats
import numpy as np

# Asterix AI
r_ai,  _ = stats.pearsonr(gold, ai_scores)
mae_ai    = np.mean(np.abs(gold - ai_scores))
rmse_ai   = np.sqrt(np.mean((gold - ai_scores)**2))

# TF-IDF
r_tf,  _ = stats.pearsonr(gold, tfidf_scores)
mae_tf    = np.mean(np.abs(gold - tfidf_scores))
rmse_tf   = np.sqrt(np.mean((gold - tfidf_scores)**2))
```

---

## Results

### Performance comparison table

| Metric | Asterix AI | TF-IDF | Δ (improvement) |
|--------|-----------|--------|----------------|
| **Pearson r** | **0.843** | 0.612 | **+37.7%** |
| **MAE (%)** | **8.31** | 12.53 | **−33.7%** |
| **RMSE (%)** | **10.47** | 15.89 | **−34.1%** |

### Why TF-IDF fails

TF-IDF cannot handle:

| Scenario | TF-IDF | Asterix AI |
|----------|--------|-----------|
| "Python developer" vs "Python engineer" | 0% match (different word) | ~90% match (same embedding space) |
| "Led a team of 5" vs "team leadership" | 0% match | ~75% match |
| Skills listed in a table vs prose | Partial match | Full match via tokenisation |
| Abbreviations ("ML" vs "machine learning") | 0% match | ~95% match |

---

## Charts

### Figure 2 — Side-by-side model comparison

![Model comparison: TF-IDF vs Asterix AI — scatter plots and metric bar chart](/research/fig2_model_comparison.png)

**Left panel** — TF-IDF scores vs gold standard. Scattered points, low correlation — TF-IDF often gives 0% on genuinely matching pairs because exact words aren't shared.

**Middle panel** — Asterix AI scores vs gold standard. Much tighter clustering along the diagonal, showing the neural model better tracks human judgment.

**Right panel** — Direct metric comparison: Asterix AI wins on all three metrics (higher r, lower MAE, lower RMSE).

---

## Interpretation

The neural model provides **+37.7% better correlation** and **−33.7% lower error** than the best classical approach. This confirms the motivation for using a transformer-based semantic embedding model rather than simple keyword matching.

**For the paper:**

> "Compared to a TF-IDF cosine-similarity baseline (a common approach in existing ATS platforms), the Asterix AI engine achieves a 37.7% improvement in Pearson correlation (0.843 vs 0.612) and a 33.7% reduction in mean absolute error (8.31% vs 12.53%), demonstrating the value of semantic understanding over keyword frequency statistics."

---

## Raw data

- **CSV:** [`research/results/model_comparison_paper.csv`](https://github.com/jatiiiiiiiin/asterix-job/blob/main/research/results/model_comparison_paper.csv)
- **Chart:** [`docs/public/research/fig2_model_comparison.png`](https://github.com/jatiiiiiiiin/asterix-job/blob/main/docs/public/research/fig2_model_comparison.png)
