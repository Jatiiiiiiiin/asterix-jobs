# AI engine (FastAPI)

`ai-engine/api.py` — a standalone FastAPI service, deployed separately to Render (`ai-engine/render.yaml`, `root: ai-engine`, `uvicorn api:app`). Stateless: it doesn't hold its own database, it calls out to LLM providers, Cashfree, and Resend per-request.

::: tip `ai-engine/matcher.py` is not this service
A second, unused FastAPI app with its own `/match` endpoint using a locally-loaded `sentence-transformers` model. Not imported by `api.py`, not referenced by `render.yaml`. Dead code — see [Gotchas](/platform/gotchas#ai-engine-matcher-py-is-dead-code).
:::

## Authentication

Every endpoint except `GET /` and `POST /contact` requires a valid Firebase ID token in the `Authorization: Bearer <token>` header. The `get_current_user()` FastAPI dependency handles verification using Firebase Admin SDK's `verify_id_token()`. Unauthenticated requests receive `401 Unauthorized`.

Admin-only endpoints (`/parse-jd`, `/generate-test`) use `require_admin()`, which extends `get_current_user()` and returns `403 Forbidden` if the user's role isn't `admin`.

See [Auth & access control](/platform/auth#backend-authentication-firebase-jwt-verification) for the full rationale on why Firebase JWT was chosen over API keys, session cookies, or custom tokens.

## Rate limiting

All endpoints are rate-limited via `slowapi` (in-memory, keyed by client IP). Limits are:

| Endpoint | Limit | Reason |
|---|---|---|
| `/match` | 10 req/min | Most expensive endpoint — HF Inference API embeddings per call |
| `/chat` | 20 req/min | Groq LLM, multi-turn context |
| `/insights`, `/tips`, `/summary`, `/embed-resume`, `/extract` | 30 req/min | LLM or embedding call per request |
| `/payments/create-order`, `/payments/activate-subscription`, `/send-auto-apply-email` | 5 req/min | Financial or email-sending operations |
| `/parse-jd` | 10 req/min | LLM call, admin-only |
| `/generate-test` | 3 req/min | Most expensive LLM call — 52-question generation |

## Endpoints

| Endpoint | Method | Auth | Does |
|---|---|---|---|
| `/` | GET | ❌ public | Health check |
| `/extract` | POST | ✅ user | PDF/text resume extraction via `pdfplumber` — fallback for when client-side PDF.js fails |
| `/embed-resume` | POST | ✅ user | Groq LLM call → structured resume JSON (name, title, skills, past roles) |
| `/match` | POST | ✅ user | Core resume↔job scoring: token overlap + HuggingFace Inference API embeddings + skill/profile/quality weighting + soft-skill boost |
| `/insights` | POST | ✅ user | AI-generated candidate match insights |
| `/tips` | POST | ✅ user | Interview tips generation |
| `/summary` | POST | ✅ user | Resume/job summary generation |
| `/chat` | POST | ✅ user | Groq-backed career-advisor chatbot, used by `AsterixAssistant`/`AIChatOverlay`/`JobChatDrawer` |
| `/send-auto-apply-email` | POST | ✅ user | Sends auto-apply notification via Resend |
| `/payments/create-order` | POST | ✅ user | Creates a Cashfree order, returns `payment_session_id`. Enforces that `customer_id == uid` from token. |
| `/payments/status/{order_id}` | GET | ✅ user | Polled by frontend after Cashfree checkout to confirm payment |
| `/payments/activate-subscription` | POST | ✅ user | **New.** Verifies Cashfree payment server-side, then writes `isPremium`/`isStudent` to Firestore via Admin SDK. Replaces client-side `updateSubscription()`. |
| `/contact` | POST | ❌ public | Contact form submission → email via Resend |
| `/parse-jd` | POST | ✅ **admin** | Groq call: freeform job description → structured fields, auto-fills `PostJobPage` |
| `/generate-test` | POST | ✅ **admin** | Groq-generated 52-question Campus Connect assessment |

## `/payments/activate-subscription` — why this exists

Previously, the frontend called `authService.updateSubscription()` to write `isPremium: true` to Firestore after a payment redirect — trusting the client to report its own payment status. Any authenticated user could call this method from the browser console to self-upgrade for free.

The new endpoint enforces the correct order: the backend calls Cashfree's `PGOrderFetchPayments` to verify the payment status independently, and only writes to Firestore if the payment actually succeeded. The write uses Firebase Admin SDK, which bypasses Firestore client rules entirely — no client can replicate it. See [Gotchas](/platform/gotchas#subscription-privilege-escalation-fixed).

## Firebase Admin initialization

The Admin SDK is initialized from the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable (the service account JSON as a single-line string). The startup code parses it with `json.loads()` and passes it to `credentials.Certificate()`.

**Why not the file?** `ai-engine/service-account.json` was previously committed to git, which exposed the private key in version history indefinitely. Environment variables set as Render secrets are never written to disk in the deployment environment and never appear in source control. See [Gotchas](/platform/gotchas#service-account-credential-history-and-current-state).

A local file fallback exists for development convenience: if `FIREBASE_SERVICE_ACCOUNT_JSON` is not set and `service-account.json` exists on disk, it's used instead (with a clear "DEV ONLY" log line). This fallback path never runs in production.

## Dependencies worth knowing about

`requirements.txt`: `fastapi`, `uvicorn`, `pdfplumber`, `numpy`, `huggingface_hub`, `groq`, `google-generativeai`, `resend`, `cashfree-pg==4.1.2`, `requests`, `python-dotenv`, `firebase-admin`, `slowapi`.

::: warning `cashfree-pg==4.1.2` needs a runtime patch to work
The top of `api.py` monkey-patches `builtins.StrictBytes` before importing the Cashfree SDK, because this SDK version is broken against the pinned `pydantic<2.0.0`. If you ever bump either dependency, re-check whether this patch is still necessary or now conflicting.
:::

## Config

Env vars are set in the Render dashboard — see the full table in [Infrastructure](/platform/infrastructure#environment-variables). The three LLM-provider keys (`GROQ_API_KEY`, `GOOGLE_API_KEY`, `HF_API_KEY`) and `FIREBASE_SERVICE_ACCOUNT_JSON` are **not** declared in `render.yaml` and must be set manually — if the service is ever recreated from yaml alone, all authenticated endpoints will return `401` and all LLM endpoints will fail until they're restored.

The frontend reaches this service through a single `VITE_API_BASE_URL`, consumed in `geminiService.ts`, `contactService.ts`, `ConfirmPaymentPage.tsx`, and `App.tsx`.
