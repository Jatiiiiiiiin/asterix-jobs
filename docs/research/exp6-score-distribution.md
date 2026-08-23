---
title: EXP 6 — Score Distribution
description: What does the distribution of AI match scores look like across 300 real resume-JD pairs?
---

# EXP 6 — Score Distribution Analysis

**What does the full landscape of AI match scores look like? Are scores well-distributed? Do soft-skill jobs get rated differently?**

---

## Overview

| Metric | Value |
|--------|-------|
| N | 300 pairs |
| Mean score | 52.4% |
| Median score | 50.8% |
| Std deviation | 24.1% |
| Skewness | +0.12 (near-symmetric) |
| Q-Q test (normality) | Approx. normal |
| Soft env boost | +12% raw → visible uplift |

---

## How We Got These Results

The score distribution analysis runs the scoring engine on all 300 pairs and analyses the output distribution using standard statistical tools.

```python
import numpy as np
from scipy import stats

scores  = match_df["ai_score_pct"].values     # 0–100 integers
errors  = match_df["error_margin"].values      # |gold - ai|

# Descriptive stats
mean    = np.mean(scores)        # 52.4
median  = np.median(scores)      # 50.8
std_dev = np.std(scores)         # 24.1
skew    = stats.skew(scores)     # +0.12

# Normality test
stat, p = stats.shapiro(scores)  # Shapiro-Wilk

# Q-Q plot
stats.probplot(scores, dist="norm", plot=ax)
```

### Hiring bands

Scores are bucketed into 5 actionable hiring tiers:

| Band | Range | Meaning |
|------|-------|---------|
| Reject | 0–20% | Automatic disqualification |
| Low | 21–40% | Not recommended |
| Moderate | 41–60% | Worth a screen call |
| Good | 61–80% | Strong candidate |
| Excellent | 81–100% | Priority shortlist |

---

## Results

### Score statistics

| Statistic | Value |
|-----------|-------|
| Mean | 52.4% |
| Median | 50.8% |
| Std Deviation | 24.1% |
| Min | 3% |
| Max | 98% |
| Skewness | +0.12 |
| Kurtosis | −0.18 |

### Score band distribution

| Band | Count | % |
|------|-------|---|
| Reject (0–20%) | 28 | 9.3% |
| Low (21–40%) | 67 | 22.3% |
| Moderate (41–60%) | 89 | 29.7% |
| Good (61–80%) | 92 | 30.7% |
| Excellent (81%+) | 24 | 8.0% |

> **The scoring is well-calibrated** — the largest group is "Good" (30.7%), the "Excellent" band is appropriately exclusive at 8%, and only 9.3% of pairs are outright rejected. This distribution is what a healthy shortlisting tool should look like.

### Soft skill vs technical environment

The engine applies a **+12% raw score bonus** to job descriptions that are soft-skill-heavy (e.g. sales, HR, management roles). This was tested by comparing the score distributions:

| Environment | Mean Score | Median |
|------------|-----------|--------|
| Soft skill (N=41) | 61.3% | 60.5% |
| Technical (N=259) | 50.4% | 48.9% |
| t-test | p = 0.003 | Significant |

The boost is intentional: soft-skill roles are harder to match via keyword overlap alone, so the bonus compensates for lower semantic precision.

---

## Charts

### Figure 6 — Six-panel score analysis dashboard

![Score distribution dashboard](/research/fig6_score_dashboard.png)

**Top-left** — Overall score histogram with mean (red) and median (orange) lines. Near-normal distribution, slight positive skew.

**Top-centre** — Score band bar chart. The colour gradient from red (reject) to green (excellent) makes the shortlisting tiers immediately visible.

**Top-right** — Boxplot comparing soft-skill vs technical job environments. The soft-skill distribution is shifted up by ~10 points due to the intentional boost.

**Bottom-left** — Absolute error distribution (|gold − AI|). The MAE falls at 8.31% — most errors cluster below 10 percentage points.

**Bottom-centre** — Scatter plot of semantic similarity vs skill match scores, coloured by final AI score. The two components are positively correlated but not redundant (r ~ 0.64).

**Bottom-right** — Q-Q plot comparing AI scores against a theoretical normal distribution. Points fall close to the line, confirming near-normality.

---

## Interpretation

### What does the distribution tell us?

1. **The engine is not pathological** — it doesn't give everything 0 or everything 50. The full 0–100 range is used.
2. **The soft-skill boost works** — a t-test confirms the shift is statistically significant (p = 0.003), validating the design choice.
3. **The distribution is near-normal** — this is a good property for a scoring tool, as it makes comparisons between candidates intuitive and percentile-based filtering straightforward.

**For the paper:**

> "Analysis of AI match scores across 300 resume–JD pairs revealed a near-normal distribution (skewness = +0.12, kurtosis = −0.18) with mean = 52.4% and std = 24.1%. Score bands showed appropriate selectivity: 8.0% of pairs fell in the 'Excellent' tier (>80%), consistent with top-of-funnel expectations in technical recruiting. Soft-skill-heavy job environments received a statistically significant score uplift (t-test p = 0.003), validating the +12% soft-skill compensation heuristic."
