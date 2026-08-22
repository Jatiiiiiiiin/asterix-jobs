---
title: Read this first
---

# Read this first

This is the engineering handbook for **Asterix Jobs** (`asterix-find` in `package.json`) — an AI-assisted job matching platform for candidates and recruiters, with a campus assessment product ("Campus Connect") bolted on.

Code tells you *what* happens. This tells you *why it's shaped this way* and *what will cost you an afternoon if nobody warns you first*.

## What this covers

Two things that ship independently:

| Part | One line |
|---|---|
| [Frontend app](/reference/frontend) | Vite + React 19 + TypeScript SPA. Candidate/recruiter/admin dashboards, job board, onboarding, payments UI |
| [AI engine](/reference/ai-engine) | Standalone FastAPI service on Render. Resume parsing, resume↔job matching, chat, insights, JD parsing, Cashfree payment orchestration, transactional email |

Plus two background systems that aren't part of the request/response path at all:

- [Job aggregation pipeline](/reference/job-aggregation) — a GitHub Action that pulls fresher-job listings from JSearch (via RapidAPI) into Firestore every 12 hours.
- A separate, unrelated **AI documentation automation** workflow (`.github/workflows/ai-docs.yml`) that posts changed files to an external n8n webhook for auto-generated docs elsewhere. It has nothing to do with this handbook — this handbook is hand-written and lives in `docs/`.

## How to read it

If you're picking this up cold, in order:

1. **[How it all fits together](/platform/overview)** — the shape of the whole system in one pass. Ten minutes, and the rest stops being confusing.
2. **[Deploy matrix](/platform/deploy-matrix)** — what ships where, on what trigger. Getting this wrong is the most common wasted afternoon.
3. **[Data model](/platform/data-model)** — the Firestore collections everything reads and writes, since there's no schema to grep for.
4. **[Auth & access control](/platform/auth)** — the security model: what's enforced where and why.
5. Then the [Reference](/reference/frontend) page for whichever part you actually have to touch.
6. **[Gotchas that cost days](/platform/gotchas)** — read it before you need it, not after.

## Three things that are true across everything

**Client-side route guards are UI, not security.** Every role check (`candidate` / `recruiter` / `admin`) in `App.tsx` is a navigation convenience — it redirects the browser, it doesn't lock data. The real enforcement layer is two-part: **Firestore rules** (for direct DB reads/writes) and **Firebase JWT verification on the AI engine** (for all LLM, payment, and email endpoints). See [Auth & access control](/platform/auth) for why this split was chosen.

**Firebase config is now env-driven.** `firebase.ts` reads from `VITE_FIREBASE_*` environment variables — set in `.env.local` for local dev and in the Vercel dashboard for production. This replaces the previous hardcoded config and means you can rotate keys or point at a different project without touching source code.

**The service account is no longer in git.** `ai-engine/service-account.json` is now gitignored and untracked. The AI engine loads its Firebase Admin credentials from a `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable (the full JSON as a single-line string) set as a secret on Render. See [Gotchas](/platform/gotchas#service-account-credential) for the full history and what you still need to do about git history.

::: danger This handbook is not customer-facing
It documents internal deploy mechanics, collection names, and where secrets live (not secret *values*). It's served at `/docs` with `noindex`, but that's obscurity, not access control — anyone with the URL can read it. Don't put actual key/token values on any page here.
:::
