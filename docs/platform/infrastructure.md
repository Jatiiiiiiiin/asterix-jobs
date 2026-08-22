# Infrastructure & environments

## Hosts

| Piece | Host | Notes |
|---|---|---|
| Frontend SPA | **Vercel** | `vercel.json` rewrites everything to `index.html`. Routing is actually done client-side via `HashRouter` (`#/candidate`, `#/recruiter`, ...), so the rewrite is mostly defensive — hash routes don't need server-side rewriting to work, but it's harmless to keep. |
| AI engine | **Render.com** | Free-tier Python web service, `ai-engine/render.yaml`, root set to `ai-engine/`, started with `uvicorn api:app`. |
| Auth + database | **Firebase** (project `asterix-find`) | Auth (Google + LinkedIn OAuth) and Firestore only. |
| Job aggregation | **GitHub Actions** | Scheduled workflow, not a hosted service — runs on GitHub-hosted runners on a cron. |

## Environment variables

**Frontend** (`import.meta.env.*`, set in Vercel project settings, `VITE_`-prefixed):

| Variable | Used for |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the AI engine — used by `geminiService.ts`, `contactService.ts`, `ConfirmPaymentPage.tsx`, `App.tsx` |
| `VITE_CASHFREE_MODE` | `sandbox` or `production` mode passed to the Cashfree JS SDK |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (`asterix-find.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (`asterix-find`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics measurement ID |

::: tip Why `VITE_*` prefix?
Vite only exposes environment variables to the browser bundle if they're prefixed with `VITE_`. This is a build-time injection — the values are baked in at `npm run build`. The Firebase web config is inherently public (visible in any deployed app's network requests), so there's no secret-protection purpose here; the prefix is just Vite's mechanism for opting into browser exposure.
:::

**AI engine** (`os.getenv(...)`, set in the Render dashboard):

| Variable | Used for | Declared in `render.yaml`? |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK init — the full service account JSON as a single-line string. Replaces the previously committed `service-account.json` file. | **No — manual only** |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` | Payment order creation/status | Yes |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email (auto-apply, contact form) | Yes |
| `FRONTEND_URL` | CORS allow-list | Yes |
| `GROQ_API_KEY` | Primary LLM calls (chat, insights, tips, JD parsing, test generation) | **No — manual only** |
| `GOOGLE_API_KEY` | Gemini calls | **No — manual only** |
| `HF_API_KEY` | HuggingFace Inference API embeddings for resume↔job matching | **No — manual only** |

::: warning If the Render service is ever recreated from `render.yaml` alone
`GROQ_API_KEY`, `GOOGLE_API_KEY`, `HF_API_KEY`, and `FIREBASE_SERVICE_ACCOUNT_JSON` won't come with it. Every LLM-backed endpoint will fail silently, and every authenticated endpoint will return `401` until these four are set by hand in the Render dashboard.
:::

**Why `FIREBASE_SERVICE_ACCOUNT_JSON` and not a file?**
The service account was previously committed as `ai-engine/service-account.json`. Committing credentials to git means they can never be truly revoked — the key stays in history even after deletion. An environment variable set as a Render secret never touches disk in the deployment environment and never appears in source control. The startup code in `api.py` does `json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))` and passes the resulting dict to `credentials.Certificate()`.

**Job aggregation** (`process.env.*`, set as GitHub Actions repo secrets):

| Variable | Used for |
|---|---|
| `RAPIDAPI_KEY` | JSearch API access via RapidAPI |
| `FIREBASE_SERVICE_ACCOUNT` | Written to `ai-engine/service-account.json` at workflow runtime so `firebase-admin` can authenticate |
| `JOB_PROVIDER` | Optional override of the provider (`mock` vs `rapidapi`) |

`.env.local` exists at the repo root for local frontend dev and is gitignored (`.env` / `.env.*` are covered in `.gitignore`).

`ai-engine/.env` holds local AI engine secrets for development and is also gitignored (explicitly added to `.gitignore`).

## Single environment, no staging

There is one Firebase project, one Vercel project, and one Render service — no separate staging/prod split observed in this repo. Anything you deploy from `main` is live. Treat local dev (`npm run dev` against the real Firebase project) accordingly: it reads and writes real data unless you point it at a different project.
