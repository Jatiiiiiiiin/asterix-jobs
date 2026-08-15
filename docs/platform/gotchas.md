# Gotchas that cost days

Read this before you need it.

## Service account credential — history and current state

::: warning `ai-engine/service-account.json` was committed to git until August 2026
The file was in the repo from the beginning (commit `d97af71`, "indeed connect") until it was removed in the security hardening pass. It is now gitignored and untracked from git.

**The file still exists on disk** (for local development) — it's just not tracked by git and won't be committed again. The AI engine now loads its Firebase Admin credentials from the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable instead.

**However, the private key is still in git history.** Anyone who cloned the repo before the fix still has it. The correct remediation is:

1. **Rotate/revoke the key** in the Firebase Console (Project Settings → Service Accounts → generate a new key, then delete the old one with `private_key_id: 6393ef79...`).
2. Remove it from git history using `git filter-repo` or BFG Repo Cleaner — just removing it in a new commit leaves it fully retrievable from `git log`.
3. Confirm the GitHub Actions aggregator workflow still works — it writes `service-account.json` at runtime from the `FIREBASE_SERVICE_ACCOUNT` secret, so it doesn't need a committed file.

**Why env var instead of the file?**
A JSON file committed to git is a credential that can never be rotated retroactively once it's in history. An environment variable set as a Render secret is scoped to the runtime environment, never appears in source control, and can be rotated by updating a single dashboard field. The `FIREBASE_SERVICE_ACCOUNT_JSON` variable holds the full service account JSON as a single-line string — `json.loads()` in `api.py` reconstructs it at startup.
:::

## Firebase config was hardcoded, now it's env-driven

`firebase.ts` previously had the Firebase project config (`apiKey`, `authDomain`, `projectId`, etc.) written directly into the source file. This was fine for a single-environment setup but meant that rotating the web API key or pointing at a different Firebase project required editing source code and redeploying.

`firebase.ts` now reads from `VITE_FIREBASE_*` environment variables. Set them in `.env.local` for local dev, and in the Vercel dashboard for production.

**Why `VITE_*` prefixed variables?**
Vite only exposes environment variables to the browser bundle if they start with `VITE_`. This is a build-time injection, not a runtime lookup — the values are baked into the JS bundle. The Firebase web config is intentionally public-facing (it's required by the Firebase client SDK and can be found in any deployed app's network requests), so embedding it in the bundle is safe. The actual security comes from Firebase Auth and Firestore rules, not from keeping the config secret.

## No authentication on the AI engine — fixed

All FastAPI endpoints previously had no authentication whatsoever. Any script with the AI engine URL could call `/match`, `/payments/create-order`, `/send-auto-apply-email`, or `/generate-test` without providing any credentials.

This is fixed. Every endpoint except `GET /` and `POST /contact` now requires a valid Firebase ID token (`Authorization: Bearer <token>`). See [Auth & access control](/platform/auth#backend-authentication-firebase-jwt-verification) for the full rationale.

**What this means when debugging:** If an AI feature stops working after this change, the first thing to check is whether the frontend is correctly attaching the auth token. `geminiService.ts`'s `getAuthHeader()` calls `auth.currentUser.getIdToken()` — if `auth.currentUser` is `null` at the point of the call (e.g., user not yet authenticated, or calling before `onAuthStateChanged` fires), the request will get a `401`. Add a `console.log(auth.currentUser)` before the fetch to confirm.

## Subscription privilege escalation — fixed

`authService.ts` previously had an `updateSubscription()` method that wrote `isPremium: true` directly to Firestore from the browser, called after the frontend received a payment confirmation redirect from Cashfree.

**The attack this enables:** any authenticated user could call `authService.updateSubscription()` from the browser console and self-upgrade to premium without paying — the method was a public API that wrote to their own `users/{uid}` document, which Firestore rules allowed (authenticated users can write their own profile).

**The fix:** `updateSubscription(orderId, plan)` now calls `POST /payments/activate-subscription` on the AI engine. The backend:
1. Verifies the Firebase token (confirms caller identity)
2. Calls Cashfree's `PGOrderFetchPayments` to confirm the payment actually succeeded
3. Only then writes `isPremium: true` to Firestore via the Firebase Admin SDK

The client never touches `isPremium` or `isStudent` directly. The Admin SDK write bypasses Firestore client rules entirely — it's server-authoritative.

**Why not just tighten Firestore rules to block `isPremium` writes?**
You could. But you'd also need to ensure the rule doesn't break legitimate profile updates that happen to be in the same document. A server-side activation endpoint is cleaner: the payment verification and the database write are a single atomic server-side operation with full audit logging, not two client-side steps that could be interrupted or replayed independently.

## Repo root is cluttered with debug artifacts

`tsc_output.txt` through `tsc_output4.txt` are committed `tsc` output from a past debugging session. `vite_debug.log`, `vite_error.log`, `import_error.log`, `startup_error.log`, `last_error.txt`, and `vars_list.txt` are untracked but sitting in the working tree. None of this is load-bearing — safe to delete, and worth doing before it's mistaken for something intentional.

## `fly` — a stray zero-byte file

A tracked, extensionless, empty file at the repo root. Likely an accidental `touch` or a truncated `fly.toml` (Fly.io config) that never got filled in. Not referenced anywhere; safe to delete.

## Duplicate `setup-aidocs` scripts

`setup-aidocs.cjs` and `setup-aidocs.js` are byte-identical (3821 bytes each), committed as two separate files in two module formats. Only one is presumably wired into the AI-docs pipeline — check which before editing either, since a fix applied to one silently doesn't apply to the other.

## Five near-duplicate Firestore cleanup scripts

`cleanup-jobs.mjs`, `cleanup-empty-jobs.mjs`, `check-jobs.mjs`, `purge-external.mjs`, and `wipe-jsearch.mjs` each reimplement their own `firebase-admin` + `service-account.json` init boilerplate independently. `purge-external.mjs` and `wipe-jsearch.mjs` are near-identical and both **wipe the entire `jobs` collection** — running the wrong one against production is a one-line mistake with a collection-wide blast radius. See [Scripts & maintenance tools](/reference/scripts) before running any of them.

## `ai-engine/matcher.py` is dead code

A second, fully separate FastAPI app that does resume↔job matching using a locally-loaded `sentence-transformers` model. It's never imported by `api.py` and `render.yaml`'s start command only points at `api:app` — so it never runs in production. The real matching logic lives entirely in `api.py`'s `/match` endpoint (HuggingFace Inference API embeddings, not a local model). Don't edit `matcher.py` expecting it to affect production behavior.

## `razorpay` is a dead dependency

`razorpay` is installed and mentioned in landing-page marketing copy (`constants.tsx`) as a feature bullet, but there is no actual payment code wired to it anywhere. **Cashfree is the only live payment gateway** — see [Payments](/reference/payments). If you're looking for where Razorpay orders get created, they don't; that copy is aspirational/stale.

## Env vars missing from `render.yaml`

`GROQ_API_KEY`, `GOOGLE_API_KEY`, `HF_API_KEY`, and the new `FIREBASE_SERVICE_ACCOUNT_JSON` are read by `ai-engine/api.py` but not declared in `render.yaml`. If the Render service is ever torn down and recreated from the yaml alone, every LLM-backed endpoint breaks silently and every authenticated endpoint returns `401` until these are set by hand. See [Infrastructure](/platform/infrastructure#environment-variables).

## Routing is hash-based, not path-based

The app uses `HashRouter` (`#/candidate`, `#/recruiter`, ...), not `BrowserRouter`. `vercel.json`'s SPA catch-all rewrite is effectively a safety net that isn't strictly required for this to work, but don't remove it — some entry points (deep links, this very docs site's cross-link back to the app) may still hit a real path segment before the hash takes over.

## Rate limiting is in-memory, not distributed

`slowapi` rate limits are tracked in memory on the single Render worker process. This means:
- Limits reset if the service restarts (Render's free tier spins down after inactivity).
- If the service is ever scaled to multiple workers, each worker has its own counter — a determined caller can multiply their effective limit by the number of workers.

At current scale (one worker, free tier) this is fine. If you scale, switch to Redis-backed storage for the limiter.
