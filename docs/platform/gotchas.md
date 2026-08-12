# Gotchas that cost days

Read this before you need it.

## Committed service-account credential

::: danger `ai-engine/service-account.json` is a live Firebase Admin key, checked into git
It has been in the repo since commit `d97af71` ("indeed connect"). It is **not** covered by `.gitignore` (which only excludes `.env*`, not this file). Anyone with read access to this repository — including anyone it was ever cloned or forked to — has standing Firestore Admin access via this key.

**This is not a documentation issue, it's an active exposure.** The fix is outside the scope of writing docs about it:

1. Rotate/revoke the key in the Firebase console (Project Settings → Service Accounts).
2. Remove it from git history (not just delete it in a new commit — `git filter-repo` or equivalent, since the old key stays retrievable from history otherwise).
3. Add `service-account.json` to `.gitignore`.
4. Confirm the GitHub Actions aggregator workflow, which already writes this file at runtime from the `FIREBASE_SERVICE_ACCOUNT` secret, still works without a committed copy — it should, since it overwrites the file every run.
:::

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

`GROQ_API_KEY`, `GOOGLE_API_KEY`, and `HF_API_KEY` are read by `ai-engine/api.py` but not declared in `render.yaml`. If the Render service is ever torn down and recreated from the yaml alone, every LLM-backed endpoint breaks silently until someone notices and sets these by hand. See [Infrastructure](/platform/infrastructure#environment-variables).

## Routing is hash-based, not path-based

The app uses `HashRouter` (`#/candidate`, `#/recruiter`, ...), not `BrowserRouter`. `vercel.json`'s SPA catch-all rewrite is effectively a safety net that isn't strictly required for this to work, but don't remove it — some entry points (deep links, this very docs site's cross-link back to the app) may still hit a real path segment before the hash takes over.
