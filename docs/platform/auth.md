# Auth & access control

## Identity

Firebase Auth, via Google and LinkedIn (`OAuthProvider('linkedin.com')`) plus email/password. `authService.ts` wraps all of it and is the only place that should talk to `firebase/auth` directly.

Session state is tracked **twice**: once by Firebase Auth itself (`onAuthStateChanged`), and once by a manual shadow copy in `sessionStorage`/`localStorage` (`asterix_session_uid`). The shadow copy exists so `getCurrentUser()` can resolve immediately after a page refresh, before Firebase has finished rehydrating its own session — it's a UX workaround for the async gap, not a separate auth mechanism. If you're debugging a "logged in but UI thinks I'm not" bug, check both.

## Roles

`AuthUser.role` is one of `candidate`, `recruiter`, or `admin`, set at signup and stored in `users/{uid}.role`.

::: warning Hardcoded admin backdoor
Any account logging in with the exact email `asterixadmin@gmail.com` is force-promoted to `role: "admin"` in both `loginWithEmail` and `getCurrentUser` — including writing that role back to Firestore if it wasn't already set. This is intentional (a permanent admin account) but it means the admin role assignment logic lives in application code, not just in Firestore data. If that email is ever compromised or reused, whoever controls it gets admin.
:::

## Route guards

All enforcement is client-side, in `App.tsx`:

- `RequireAuth` — must be logged in, else redirect to `/signup`.
- `RequireCandidate` — allows `candidate` or `admin`.
- `RequireRecruiter` — allows `recruiter` only.
- `RequireAdmin` — allows `admin` only.
- `PublicRoute` (`views/PublicRoute.tsx`) — the inverse: if you're already logged in and hit `/` or `/signup`, it redirects you to the right dashboard (`/admin`, `/recruiter`, `/candidate`, or `/candidate/onboarding` depending on role and onboarding state).

::: danger This is UI routing, not a security boundary
None of the above stops a signed-in `candidate` from opening browser devtools and calling `getFirestore()` queries that a `recruiter`-only view would run. **The only real access control is `firestore.rules`.** Route guards decide what the app *shows*; rules decide what Firestore *allows*. Before trusting that a role split is actually enforced, check the rules, not the routes.
:::

## Practical checklist when adding a new role-gated feature

1. Add the route guard in `App.tsx` for the UI experience.
2. Add or update the matching `firestore.rules` condition — this is the part that actually matters.
3. Don't assume an existing collection's rules cover a new access pattern just because the UI already gates it.
