# Auth & access control

## Identity

Firebase Auth, via Google and LinkedIn (`OAuthProvider('linkedin.com')`) plus email/password. `authService.ts` wraps all of it and is the only place that should talk to `firebase/auth` directly.

**Why Firebase Auth and not a custom JWT system?**
Firebase Auth gives you OAuth provider integration (Google, LinkedIn), email/password with built-in verification flows, and ID tokens that the backend can verify cryptographically without a database lookup — all without managing a user store or signing infrastructure. A custom JWT setup would require running a token-issuing server, rotating signing keys, and building the OAuth dance yourself. Firebase Auth eliminates all of that at zero marginal cost for a startup-scale product.

Session state is tracked **twice**: once by Firebase Auth itself (`onAuthStateChanged`), and once by a manual shadow copy in `sessionStorage` (`asterix_session_uid`). The shadow copy exists so `getCurrentUser()` can resolve immediately after a page refresh, before Firebase has finished rehydrating its own session — it's a UX workaround for the async gap, not a separate auth mechanism. If you're debugging a "logged in but UI thinks I'm not" bug, check both.

## Roles

`AuthUser.role` is one of `candidate`, `recruiter`, or `admin`, set at signup and stored in `users/{uid}.role`.

Role is **read from Firestore and trusted as the source of truth**. To make a user an admin, set `role: "admin"` in their `users/{uid}` document via the Firebase Console or the Admin SDK — not by editing application code.

::: tip Why Firestore is the role source, not the Firebase token
Firebase Custom Claims (set via `firebase_auth.set_custom_user_claims()`) are an alternative: they embed role into the JWT itself, so the backend doesn't need a Firestore read per request. However, custom claims have a 1KB limit and require a token refresh to take effect (old tokens still carry the old claim for up to 1 hour).

For this app, reading `users/{uid}.role` from Firestore on each `getCurrentUser()` call is the right tradeoff: role changes take effect immediately, there's no stale-token window, and the 1KB limit is irrelevant. The extra Firestore read is negligible for an auth flow that only runs on page load and login.
:::

::: warning Removed: hardcoded admin email
Previously, any account logging in with `asterixadmin@gmail.com` was force-promoted to `admin` in both `loginWithEmail` and `getCurrentUser` — overriding whatever Firestore said. This was removed because it tied admin access to email ownership rather than an explicit database grant.

**Why the email check was a vulnerability:** If the Gmail account was ever compromised, phished, or transferred, the attacker automatically got admin access to the entire platform — no Firestore write required, no audit trail, no revocation path short of deploying new code. An email address is an externally-controlled string, not a capability you issue.

**The replacement:** Set `role: "admin"` in Firestore for the admin user's UID. This is an explicit, auditable, revocable grant that lives in your database — not in application code.
:::

## Backend authentication — Firebase JWT verification

Every AI engine endpoint (except `GET /` and `POST /contact`) requires a valid Firebase ID token in the `Authorization: Bearer <token>` header.

**Why require auth on the backend at all?**
Without it, any anonymous script could:
- Call `/match` and exhaust your HuggingFace and Groq API quotas
- Call `/send-auto-apply-email` to spam arbitrary email addresses through your Resend account
- Call `/payments/create-order` to create fake orders and enumerate your Cashfree account
- Call `/parse-jd` or `/generate-test` (LLM-heavy endpoints) to run up your AI costs indefinitely

CORS headers don't prevent this — they only block browsers from other origins, not `curl`, Python scripts, or any non-browser HTTP client.

**Why Firebase ID tokens specifically, and not API keys or session cookies?**

| Approach | Problem |
|---|---|
| Shared API key | One leaked key compromises every user. No per-user identity. Rotation requires coordinating all clients. |
| Session cookies | Requires a session store (Redis/DB) on the backend. Stateless FastAPI on Render has no session store. |
| Custom JWT | Requires running your own signing key infrastructure and token rotation. Firebase Auth already does this. |
| Firebase ID token | Cryptographically verifiable against Firebase's public keys — no database lookup required. Carries the user's `uid`. Short-lived (1 hour), auto-refreshed by the Firebase SDK. Already issued at login — zero extra work for the client. |

The implementation: `get_current_user()` in `api.py` calls `firebase_auth.verify_id_token(token)`. Firebase Admin SDK handles key fetching, signature verification, expiry checking, and project binding automatically. The result is a `TokenData` object with `uid` and `email` available to every endpoint.

**How the frontend attaches the token:**
`geminiService.ts` exports `getAuthHeader()`, which calls `auth.currentUser.getIdToken()` before every fetch. `getIdToken()` returns the cached token if still valid, or silently refreshes it — the frontend never manually manages token expiry.

## Admin-only endpoints

`/parse-jd` and `/generate-test` use `require_admin()` instead of `get_current_user()`.

`require_admin()` calls `get_current_user()` first (verifying the token), then checks `user.role == "admin"`. If not admin, it returns `403 Forbidden`.

**Why not just check Firestore on the backend for role?**
The token verification is already done server-side by Firebase Admin SDK. The role in the token comes from Firestore (read at login by the frontend's `getCurrentUser()`). For admin-gated endpoints this is sufficient: the frontend set the role from Firestore when the user logged in, and the backend verifies the token was genuinely issued by Firebase. For production-critical role enforcement (e.g. financial operations), read the role from Firestore directly in the endpoint — don't trust the claim in the token alone.

## Rate limiting

All sensitive endpoints use `slowapi` rate limiting, keyed by client IP.

| Endpoint group | Limit |
|---|---|
| `/match` | 10 req/min — prevents AI cost exhaustion |
| `/chat` | 20 req/min |
| `/insights`, `/tips`, `/summary`, `/embed-resume`, `/extract` | 30 req/min |
| `/payments/create-order`, `/payments/activate-subscription`, `/send-auto-apply-email` | 5 req/min |
| `/parse-jd` | 10 req/min |
| `/generate-test` | 3 req/min — most expensive LLM call (52 questions) |

**Why slowapi and not a gateway-level rate limiter?**
Render's free tier doesn't provide built-in rate limiting. A gateway approach (e.g., Cloudflare) would add a layer to manage and cost money. `slowapi` integrates directly into FastAPI with a single decorator and uses in-memory storage — zero infrastructure overhead, zero cost. The tradeoff: it doesn't share state across multiple workers (if the service ever scales beyond `workers=1`). At current scale this is fine; upgrade to Redis-backed slowapi if you add workers.

## Route guards (frontend)

All frontend enforcement is in `App.tsx`:

| Guard | Allows | Redirects to |
|---|---|---|
| `RequireAuth` | Any signed-in user | `/signup` if not |
| `RequireCandidate` | `candidate`, `admin` | `/signup` if not |
| `RequireRecruiter` | `recruiter` | `/signup` if not |
| `RequireAdmin` | `admin` | `/signup` if not |
| `PublicRoute` | Signed-out users | Sends already-signed-in users to their dashboard |

::: danger This is UI routing, not a security boundary
None of the above stops a signed-in `candidate` from opening browser devtools and calling Firestore queries that a `recruiter`-only view would run. **The only real access control for Firestore is `firestore.rules`.** Route guards decide what the app *shows*; rules decide what Firestore *allows*. Before trusting that a role split is actually enforced, check the rules, not the routes.

For the AI engine, the security boundary is the JWT auth middleware — not the route guards.
:::

## Practical checklist when adding a new role-gated feature

1. Add the route guard in `App.tsx` for the UI experience.
2. Add or update the matching `firestore.rules` condition — **this is the part that actually enforces data access**.
3. If the feature calls an AI engine endpoint, ensure that endpoint uses `Depends(get_current_user)` or `Depends(require_admin)`.
4. Don't assume an existing collection's rules cover a new access pattern just because the UI already gates it.
