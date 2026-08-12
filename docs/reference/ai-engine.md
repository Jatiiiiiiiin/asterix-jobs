# AI engine (FastAPI)

`ai-engine/api.py` — a standalone FastAPI service, deployed separately to Render (`ai-engine/render.yaml`, `root: ai-engine`, `uvicorn api:app`). Stateless: it doesn't hold its own database, it calls out to LLM providers, Cashfree, and Resend per-request.

::: tip `ai-engine/matcher.py` is not this service
A second, unused FastAPI app with its own `/match` endpoint using a locally-loaded `sentence-transformers` model. Not imported by `api.py`, not referenced by `render.yaml`. Dead code — see [Gotchas](/platform/gotchas#ai-engine-matcher-py-is-dead-code).
:::

## Endpoints

| Endpoint | Method | Does |
|---|---|---|
| `/` | GET | Health check |
| `/extract` | POST | PDF/text resume extraction via `pdfplumber` — fallback for when client-side PDF.js extraction fails |
| `/embed-resume` | POST | Groq LLM call → structured resume JSON (name, title, skills, past roles) |
| `/match` | POST | Core resume↔job scoring: token overlap + HuggingFace Inference API embeddings for cosine similarity, blended with skill/profile/quality weighting and a soft-skill boost |
| `/insights` | POST | AI-generated candidate insights |
| `/tips` | POST | Interview tips generation |
| `/summary` | POST | Resume/job summary generation |
| `/chat` | POST | Groq-backed career-advisor chatbot, used by `AsterixAssistant`/`AIChatOverlay`/`JobChatDrawer` |
| `/send-auto-apply-email` | POST | Sends auto-apply email via Resend |
| `/payments/create-order` | POST | Creates a Cashfree order, returns `payment_session_id` |
| `/payments/status/{order_id}` | GET | Polled by the frontend after Cashfree checkout to confirm payment |
| `/contact` | POST | Contact form submission → email via Resend |
| `/parse-jd` | POST | Groq call: freeform job description → structured fields, used to auto-fill `PostJobPage` |
| `/generate-test` | POST | Groq-generated 52-question Campus Connect assessment |

## Dependencies worth knowing about

`requirements.txt`: `fastapi`, `uvicorn`, `pdfplumber`, `numpy`, `huggingface_hub`, `groq`, `google-generativeai`, `resend`, `cashfree-pg==4.1.2`, `requests`, `python-dotenv`.

::: warning `cashfree-pg==4.1.2` needs a runtime patch to work
The top of `api.py` monkey-patches `builtins.StrictBytes` before importing the Cashfree SDK, because this SDK version is broken against the pinned `pydantic<2.0.0`. If you ever bump either dependency, re-check whether this patch is still necessary or now conflicting.
:::

## Config

Env vars are set in the Render dashboard — see the full table in [Infrastructure](/platform/infrastructure#environment-variables). The three LLM-provider keys (`GROQ_API_KEY`, `GOOGLE_API_KEY`, `HF_API_KEY`) are **not** declared in `render.yaml` and must be set manually.

The frontend reaches this service through a single `VITE_API_BASE_URL`, consumed in `geminiService.ts`, `contactService.ts`, `ConfirmPaymentPage.tsx`, and `App.tsx`.
