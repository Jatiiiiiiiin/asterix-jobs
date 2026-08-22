# Security model

A summary of where security is enforced, why each mechanism was chosen, and what to check when something feels wrong.

## The three enforcement layers

```
Browser                    AI Engine (FastAPI)         Firebase
──────────────────────     ───────────────────────     ──────────────
Route guards (App.tsx)     JWT middleware               Firestore rules
└─ UI navigation only      └─ Real auth boundary        └─ Real data boundary
   for role-gated routes      for all AI/payment/          for all direct
                              email endpoints              Firestore reads/writes
```

**Route guards** are a UX convenience — they redirect unauthenticated or unauthorized users away from views they shouldn't see. They do not prevent data access. A determined user can bypass them from DevTools.

**JWT middleware** is the real auth boundary for the AI engine. Every request (except health check and contact form) must carry a valid Firebase ID token. The backend verifies it cryptographically — no database lookup, no trust in what the client claims about itself.

**Firestore rules** are the real data boundary for all direct Firestore access. The client SDK talks to Firestore directly (no API layer), so the rules file is the only thing standing between a browser and a collection write.

## Why Firebase ID tokens for backend auth

The short version: they're already there.

Every logged-in user has a Firebase ID token — issued by Firebase Auth, short-lived (1 hour), auto-refreshed by the SDK, cryptographically signed. The backend can verify them with `firebase_auth.verify_id_token()` in one line, with no session store, no token database, and no custom signing infrastructure.

Alternatives and why they weren't chosen:

| Alternative | Why not |
|---|---|
| Shared API key | No per-user identity. One leaked key compromises everything. Rotation requires coordinating all clients. |
| Session cookies | Requires a session store (Redis/DB). Stateless FastAPI on free-tier Render has neither. |
| Custom JWT | Requires your own signing key infrastructure, rotation schedule, and token lifecycle management. Firebase Auth already solves all of this. |
| No auth | Any anonymous script can exhaust LLM quotas, spam email through your Resend account, or enumerate your Cashfree account. CORS only blocks browsers, not curl. |

## Why subscription activation is server-side

The client can be tampered with. Any code that runs in the browser can be modified by the user running it.

The old flow: browser → (Cashfree redirect) → browser calls `updateSubscription()` → browser writes `isPremium: true` to Firestore. A user could skip Cashfree entirely and just call `updateSubscription()` from the console.

The new flow: browser → (Cashfree redirect) → browser calls `/payments/activate-subscription` with their JWT → **backend verifies payment with Cashfree** → backend writes `isPremium: true` via Admin SDK. The client has no path to write `isPremium` directly. The Admin SDK write bypasses Firestore client rules, so there's no Firestore rule that could accidentally allow a client to replicate it.

## Why service account credentials are in env vars

A secret committed to git is permanently exposed, even after deletion — it stays in history and is retrievable by anyone who ever cloned the repo. There is no way to "un-commit" a credential; you can only rotate it.

An environment variable set in the Render dashboard never touches disk in the deployment environment, never appears in source control, and can be rotated by updating a single field. The previous `ai-engine/service-account.json` is now gitignored. The AI engine reads `os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")` and calls `json.loads()` to reconstruct the credentials dict at startup.

::: danger The old key is still in git history
If you haven't already: rotate the Firebase service account key in the Firebase Console (Project Settings → Service Accounts). The `private_key_id: 6393ef79...` key should be revoked. After rotating, use `git filter-repo` or BFG Repo Cleaner to remove the file from history.
:::

## Why the hardcoded admin email was removed

`if email == "asterixadmin@gmail.com": role = "admin"` tied admin access to email ownership, not to an explicit database grant. Problems:

- If the Gmail account was phished or transferred, the attacker got admin access automatically — no Firestore write needed, no audit trail.
- The role assignment lived in application code, not in the database — meaning it couldn't be revoked without a deployment.
- It bypassed the Firestore role, so even if someone set the account's Firestore role to `candidate`, the email check overrode it.

**Replacement:** set `role: "admin"` in `users/{uid}` in Firestore for the admin user's UID. This is an explicit, auditable, instantly-revocable grant. The backend's `require_admin()` dependency reads the role from the verified JWT (which carries the role as set by `getCurrentUser()` from Firestore at login time).

## Rate limiting design

`slowapi` limits are applied per-client-IP on every sensitive endpoint. Limits are chosen based on endpoint cost:

- LLM embedding calls (`/match`): 10/min — each call hits HuggingFace Inference API
- Streaming chat (`/chat`): 20/min — Groq call per turn
- Standard LLM calls: 30/min — fast Groq calls
- Financial/email operations: 5/min — extra conservative
- `/generate-test`: 3/min — 52-question Groq generation, the most expensive single call in the system

**Limitation:** `slowapi` uses in-memory storage on a single worker process. Rate limits reset on service restart (Render free tier spins down after inactivity). If the service is scaled to multiple workers, each has an independent counter. This is acceptable at current scale; switch to Redis-backed storage if scaling.

## What's not covered here (Firestore rules)

The `firestore.rules` file is the access control layer for everything the browser reads/writes directly from Firestore. This handbook doesn't document the rules in detail because they're in the codebase and can drift. The principles to apply when adding a new collection or field:

- Authenticated users should be able to read/write their own user document, but not the `isPremium`, `isStudent`, or `role` fields directly (those are set server-side).
- Admin-only collections should require `request.auth.token.role == "admin"` or a `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"` check.
- The `jobApplicationCounts/global` document currently has `write: if true` — this allows anonymous count tampering and should be restricted to authenticated users at minimum.
