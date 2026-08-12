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
4. Then the [Reference](/reference/frontend) page for whichever part you actually have to touch.
5. **[Gotchas that cost days](/platform/gotchas)** — read it before you need it, not after.

## Three things that are true across everything

**There is no server-side authorization boundary.** Every role check (`candidate` / `recruiter` / `admin`) is a client-side route guard in `App.tsx`. Firestore access control is whatever `firestore.rules` says, independent of what the UI shows. Never assume a hidden route is actually inaccessible — see [Auth & access control](/platform/auth).

**Firebase config is hardcoded, not env-driven.** Unlike the AI engine and the job aggregator, `firebase.ts` has the Firebase project config written directly into the file — there are no `VITE_FIREBASE_*` variables to set. If you're spinning up a second environment, this is the file you edit, not `.env.local`.

**One committed file is a live credential.** `ai-engine/service-account.json` is a Firebase Admin service account — checked into git, not gitignored. This is the single highest-priority item in this handbook. See the callout in [Gotchas](/platform/gotchas#committed-service-account-credential).

::: danger This handbook is not customer-facing
It documents internal deploy mechanics, collection names, and where secrets live (not secret *values*). It's served at `/docs` with `noindex`, but that's obscurity, not access control — anyone with the URL can read it. Don't put actual key/token values on any page here.
:::
