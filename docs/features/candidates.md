# For candidates

## Onboarding

New candidates go through a 5-step wizard before reaching the dashboard: **About You → Skills → Experience → Preferences → Review**. Name and phone are mandatory on step 1 (phone is explicitly required for payment processing later, not just contact). Skills can be picked from ~20 preset chips or typed freely. Finishing writes a profile document and flags the account as onboarded — skip it and you're routed straight back.

First-time dashboard visitors also get a 3-step spotlight tutorial (`OnboardingTutorial`): upload your resume → hit Recalibrate → go check Jobs.

## Uploading a resume

On the dashboard, "Embed Resume" accepts a file up to 1MB (larger files are rejected outright). The resume is stored and its text extracted client-side, and that immediately kicks off scoring against every live job. A **Recalibrate** button lets you re-run scoring later without re-uploading — useful after editing your profile.

## AI Match Score

Every job you can see gets a **Match %** (0–100), shown as a colored badge/progress bar on the job card — purple at 70%+, amber at 40%+, gray below that. It's not just a number: the backend also returns `matchHighlights` and a score breakdown, which is what powers the "Technical Mastery Audit" (per-skill match bars) and the AI Audit chat on a job's detail page. The dashboard also shows a stats bar with Open Jobs, Jobs Applied, and Auto-Pilot status.

## Auto-Pilot (auto-apply)

This is the headline feature, and it's **genuinely automatic**, not a "review and click" queue. When the toggle is on:

- A background loop checks every 15 minutes while the tab is open, plus catches up whenever you switch back to the tab.
- It scores any not-yet-scored job.
- For any job scoring at or above the threshold (recruiters set this per-job, default 65%), it **silently submits the application and sends a confirmation email** — no click from you.
- You get a toast: "Auto-Applied — {job title} ({score}%)."

Auto-Pilot is available on **every plan, free included** — it's not a paid feature. What *is* paid is manual apply (see below).

## Manual apply ("Manual Initialize")

Applying to a specific job yourself, on demand, requires the paid **Student Plan**. Free-tier users see a locked "Apply" pill with a PRO badge; tapping it opens the upgrade modal. Even on the paid plan, if your score is more than 5 points below the job's threshold you get a "Low Match" warning instead of an apply button — the plan removes the *lock*, not the *scoring gate*.

## Ace Interview

Once a job has been scored, an "Ace Interview" button appears (on the dashboard, the Jobs board, and the job detail page). It opens a modal that sends your resume text plus that job's title/description to an AI model and returns three short, categorized lists:

- **Strengths** — what to lead with in the interview.
- **Gap Areas** — what to shore up beforehand.
- **Power Tips** — tactical moves for that specific interview.

It's a one-shot generated prep brief, not a live mock-interview simulator.

## AI Audit chat (per-job)

The "AI Audit" button on a job card opens a chat drawer scoped to *that one job* — it has your resume and your match score for that role loaded as context. Suggested prompts include "Why did I score less?", "What do I need to score more?", and "What should I learn if I get shortlisted?" This is the substantive AI conversation feature in the product.

::: tip Two different chat surfaces exist — don't confuse them
There's also a small chat bubble present on every page, all the time (see [Site-wide features](/features/platform-wide#ai-chat-bubble)). That one is a scripted FAQ bot with canned answers about pricing and how the product works — it does **not** see your resume or a specific job. The AI Audit drawer described above is the one doing real per-job, per-resume reasoning.
:::

## Job Details page

Beyond the match score, a job's detail page shows a **Technical Mastery Audit** (per-skill match-rate bars) and an "Audit Intelligence" box with AI-generated interview-prep bullets. There's also a manual checklist ("Review Case Study," "Validate Tech Stack," "Company Research") — checking these boxes is just local UI state for your own tracking; it isn't saved anywhere or seen by anyone else.

Some jobs show colored source buttons (LinkedIn, Indeed, or generic "External") instead of an in-app apply flow — these are jobs pulled in by the [job aggregator](/reference/job-aggregation) rather than posted directly by a recruiter, and they route you out to the original listing.

## The Jobs board vs. the Dashboard feed

These are two different lists, not the same jobs shown twice: the dedicated **Jobs page** shows admin/aggregator-sourced listings with a search box, job-type filters, and a minimum-match-score slider (0–95%). The **Dashboard** feed shows recruiter-posted jobs. If you're looking for a specific listing and don't see it on one, check the other.

## Applications tracker

The Applications page is split into **Auto Applied** vs **Manual Applied**, filterable by stage: Submitted → Shortlisted → Interview → Offer → Hired (or Declined). Each card expands into a visual pipeline bar and shows if a recruiter has actually reviewed/moved you — an "In Pipeline" badge, the reviewer's name, and a "Notified" badge if a status-change email went out. This updates live as recruiters move you through their [Talent Pipeline](/features/recruiters#talent-pipeline).

## Profile

A resume-like editable profile: work experience entries, skills with percentage sliders, education, contact details, and preferences (minimum salary, remote preference). This is separate from the uploaded resume file — editing your profile here doesn't rewrite your resume, and vice versa; Recalibrate is what syncs scoring to whichever one changed.

## Settings

Tabs: Account, Billing, Neural (AI toggles — Visible Profile, Auto-Pilot on/off, Alert Pings), Security, Alerts. The Security tab's "Active Sessions" and "2FA" buttons are currently stubs (they just show an alert, they don't do anything yet). Billing shows a plan comparison table and the upgrade CTA.

## Browsing without an account

Guests can browse jobs without signing in. Any interactive action — applying, opening AI Audit, saving — pops a sign-up prompt ("Join 2,400+ members...") rather than silently failing.
