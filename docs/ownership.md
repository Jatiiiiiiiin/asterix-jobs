# Who owns what

## Services and where they live

| Service | Host | Deploys from |
|---|---|---|
| Frontend SPA | Vercel | this repo, root |
| AI engine (FastAPI) | Render.com (`asterix-backend`, free tier) | this repo, `ai-engine/` as root |
| Auth + database | Firebase (`asterix-find` project) — Auth + Firestore only, **no Storage bucket in use** | managed console, not this repo |
| Job aggregation | GitHub Actions (`aggregator.yml`) | this repo, cron |
| Payments | Cashfree (live) | called from AI engine |
| Transactional email | Resend | called from AI engine |
| LLM calls | Groq (primary), Gemini/`google-generativeai`, HuggingFace Inference API (embeddings) | called from AI engine only — the browser never calls an LLM directly |

## Where secrets live

- **Vercel project env vars** — everything prefixed `VITE_*` that the frontend needs at build time (see [Infrastructure](/platform/infrastructure#environment-variables)).
- **Render dashboard env vars** — everything the AI engine reads via `os.getenv`. `render.yaml` only declares the Cashfree/Resend/`FRONTEND_URL` vars explicitly; `GROQ_API_KEY`, `GOOGLE_API_KEY`, and `HF_API_KEY` are **not** in `render.yaml` and must be set by hand in the Render dashboard if the service is ever recreated.
- **GitHub Actions repo secrets** — `RAPIDAPI_KEY` and `FIREBASE_SERVICE_ACCOUNT` (used by the aggregator workflow), plus `AIDOC_WEBHOOK_URL`/`AIDOC_WEBHOOK_SECRET` (used only by the unrelated `ai-docs.yml` workflow).
- **Firebase project config** — hardcoded in `firebase.ts`, not a secret in the traditional sense (it's a public client config), but it is the one piece of Firebase configuration that lives in source rather than an env var.

::: danger service-account.json is committed to git
`ai-engine/service-account.json` — a Firebase Admin private key — is checked into the repository (not gitignored) and has been since commit `d97af71`. Anyone with read access to this repo has standing admin access to the Firestore database. This needs to be **rotated in the Firebase console and scrubbed from git history**; it is not a documentation problem, it's an active exposure. See [Gotchas](/platform/gotchas#committed-service-account-credential) for the full writeup.
:::

## Issue tracking

Not centrally tracked outside of GitHub Issues/commit messages at the time of writing — there is no Linear/Jira integration wired into this repo's workflows.
