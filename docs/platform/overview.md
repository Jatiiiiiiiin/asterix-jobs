# How it all fits together

```
                        ┌─────────────────────────┐
                        │   Browser (React SPA)    │
                        │  HashRouter — #/candidate │
                        │  #/recruiter  #/admin ... │
                        └────────────┬─────────────┘
                                     │
                 ┌───────────────────┼────────────────────┐
                 │                   │                    │
                 ▼                   ▼                    ▼
        ┌────────────────┐  ┌──────────────────┐  ┌───────────────┐
        │  Firebase Auth  │  │  Firestore        │  │  AI engine     │
        │  Google/        │  │  (users, jobs,     │  │  (FastAPI on   │
        │  LinkedIn OAuth │  │  applications, ...) │  │  Render)       │
        └────────────────┘  └────────┬───────────┘  └───────┬────────┘
                                      │                      │
                                      │              ┌───────┴────────┐
                                      │              │ Groq / Gemini /  │
                                      │              │ HF Inference API │
                                      │              │ Cashfree · Resend│
                                      │              └──────────────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        │  GitHub Actions: aggregator │
                        │  runs every 12h, writes     │
                        │  "aggregated_*" job docs     │
                        │  fetched from JSearch/RapidAPI│
                        └────────────────────────────┘
```

## The two independently-deployable pieces

**Frontend** — a Vite + React 19 + TypeScript SPA. `App.tsx` owns every route and a global `AuthUser` hydrated from `onAuthStateChanged`. It talks to Firestore directly from the browser (via the Firebase client SDK) for almost everything — job listings, applications, profile data — and only calls out to the AI engine for anything that needs an LLM, a PDF parsed, or a payment created.

**AI engine** — a separate FastAPI app (`ai-engine/api.py`), deployed on its own to Render. It's stateless: no direct Firestore writes of its own beyond what individual endpoints do explicitly. The frontend reaches it through a single configured base URL (`VITE_API_BASE_URL`).

These deploy independently, on different triggers, to different hosts. See the [deploy matrix](/platform/deploy-matrix) before assuming a push to `main` deploys both.

## What talks to what

- The browser talks to **Firestore** directly for job listings, applications, profiles, contact messages, and admin moderation. There is no backend API in front of Firestore — access control is entirely `firestore.rules` plus client-side route guards (see [Auth & access control](/platform/auth)).
- The browser talks to the **AI engine** for anything that needs a PDF parsed, an LLM call, or a payment session created — resume extraction/matching, chat, insights, JD auto-fill, Campus Connect test generation, and Cashfree order creation/status. Every AI engine request includes a Firebase ID token (`Authorization: Bearer <token>`) that the backend verifies using Firebase Admin SDK. This is the server-side auth boundary for all AI, payment, and email operations.
- The **AI engine** talks to Groq, Gemini, and the HuggingFace Inference API for LLM/embedding calls, to Cashfree for payments, and to Resend for transactional email. It does not talk to Firestore for general queries, but it does write to `users/{uid}` via Firebase Admin SDK when activating subscriptions after payment verification.
- A **GitHub Actions cron job** (`aggregator.yml`), running independently of both, pulls listings from JSearch via RapidAPI and writes them straight into the `jobs` collection — the same collection the frontend reads from and admins write to manually. It runs entirely outside the request/response path; nothing waits on it.

## What's notably *not* here

- No backend API layer between the SPA and Firestore for CRUD — the AI engine is not a general-purpose backend, it's specifically the AI/PDF/payments/email surface.
- No Firebase Storage — resumes are parsed client-side (PDF.js) and sent to the AI engine as extracted text/structured data, not uploaded as files.
- No separate session or JWT infrastructure — the app uses Firebase Auth's ID tokens end-to-end. The browser gets a token at login (via Firebase Auth), attaches it to AI engine requests, and the backend verifies it against Firebase's public keys using the Admin SDK. No custom signing, no token database.
