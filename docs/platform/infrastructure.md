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

Firebase config is **not** here — it's hardcoded in `firebase.ts`. There are no `VITE_FIREBASE_*` variables.

**AI engine** (`os.getenv(...)`, set in the Render dashboard):

| Variable | Used for | Declared in `render.yaml`? |
|---|---|---|
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` | Payment order creation/status | Yes |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email (auto-apply, contact form) | Yes |
| `FRONTEND_URL` | CORS allow-list | Yes |
| `GROQ_API_KEY` | Primary LLM calls (chat, insights, tips, JD parsing, test generation) | **No — manual only** |
| `GOOGLE_API_KEY` | Gemini calls | **No — manual only** |
| `HF_API_KEY` | HuggingFace Inference API embeddings for resume↔job matching | **No — manual only** |

::: warning If the Render service is ever recreated from `render.yaml` alone
`GROQ_API_KEY`, `GOOGLE_API_KEY`, and `HF_API_KEY` won't come with it — every LLM-backed endpoint (`/embed-resume`, `/match`, `/insights`, `/tips`, `/summary`, `/chat`, `/parse-jd`, `/generate-test`) will fail until those three are set by hand in the dashboard.
:::

**Job aggregation** (`process.env.*`, set as GitHub Actions repo secrets):

| Variable | Used for |
|---|---|
| `RAPIDAPI_KEY` | JSearch API access via RapidAPI |
| `FIREBASE_SERVICE_ACCOUNT` | Written to `ai-engine/service-account.json` at workflow runtime so `firebase-admin` can authenticate |
| `JOB_PROVIDER` | Optional override of the provider (`mock` vs `rapidapi`) |

`.env.local` exists at the repo root for local frontend dev and is gitignored (`.env` / `.env.*` are covered in `.gitignore`).

## Single environment, no staging

There is one Firebase project, one Vercel project, and one Render service — no separate staging/prod split observed in this repo. Anything you deploy from `main` is live. Treat local dev (`npm run dev` against the real Firebase project) accordingly: it reads and writes real data unless you point it at a different project.
