# Site-wide features

Things every user touches regardless of role.

## Landing page

Advertises "Smart Matching" (40+ factors, per the copy), "Reads Between" (context-aware title matching, not just keyword matching), and "Applies for You" (Auto-Pilot). Shows a stats section with live counts pulled from Firestore (members/companies) alongside two hardcoded figures — "98.2% Accuracy" and "1s Speed" — plus a 3-step "How It Works" (Upload Resume → AI Analysis → Get Matches) and the full pricing section duplicated from [Plans & pricing](/features/plans-pricing).

## Sign up

Email/password, or Google/LinkedIn OAuth. New email signups choose a role — Candidate or Employer — except when arriving via a "buy a plan" link, which forces Candidate role automatically (you can't accidentally sign up as a recruiter mid-checkout). Email verification is required before onboarding starts.

## AI chat bubble

A small chat bubble present on **every page, for every role**, always available. It's a scripted FAQ bot with a fixed set of canned answers — what Find Jobs does, what AI Audit does, what Recalibrate does, how Auto-Pilot works, and pricing. It auto-pops a nudge every 2 minutes of idle time to invite you to ask something.

::: tip Not the same thing as the per-job AI chat
This bubble doesn't see your resume or any specific job — it's general product Q&A. The chat that actually reasons over your resume and a specific job's requirements is the **AI Audit** drawer, opened from a job card — see [For candidates](/features/candidates#ai-audit-chat-per-job).
:::

## Navigation (sidebar)

The sidebar's contents change by role: Candidates see Dashboard, Jobs, Campus Connect, Profile, My Applications, Settings. Recruiters see Dashboard, Active Sourcing, Talent Pipeline, Intelligence (Reports), Settings. Admins see Admin Portal, Universe Feed, Logout. It also shows your current plan badge with an inline upgrade prompt if you're on a free tier. Logging out plays a short "de-authorizing" animation before redirecting — cosmetic, but noticeable enough that a user pausing mid-animation isn't a bug.

## Contact

A simple form (name, email, subject dropdown, message) that emails the relevant team — general, candidate support, or partnerships, each with its own listed address — with a stated 24-hour response commitment.

## Jobs sourced from outside the platform

Not every listing was posted by a recruiter in-app — some are pulled in automatically from job boards on a schedule (see [Job aggregation pipeline](/reference/job-aggregation)). The only visible sign of this to a user is the colored source button (LinkedIn / Indeed / generic "External") on the job card instead of an in-app apply flow; there's no explicit "this job was auto-imported" label beyond that.
