# Frontend app

Vite + React 19 + TypeScript. `index.tsx` mounts `<App/>` inside a `HashRouter`. `App.tsx` owns every route, all role guards, and hydrates a global `AuthUser` from `onAuthStateChanged`.

## Routing & guards

| Guard | Allows | Redirects to |
|---|---|---|
| `RequireAuth` | Any signed-in user | `/signup` if not |
| `RequireCandidate` | `candidate`, `admin` | `/signup` if not |
| `RequireRecruiter` | `recruiter` | `/signup` if not |
| `RequireAdmin` | `admin` | `/signup` if not |
| `PublicRoute` | Signed-out users | Sends already-signed-in users to their dashboard instead of `/` or `/signup` |

::: danger Route guards are UI, not security boundaries
These guards redirect the browser — they don't prevent an authenticated user from making Firestore queries or AI engine calls outside of what the UI shows them. The actual data access boundary is `firestore.rules` (for Firestore) and Firebase JWT middleware (for the AI engine). Full details: [Auth & access control](/platform/auth).
:::

## Views

| View | Role | What it is |
|---|---|---|
| `LandingPage` | Public | Marketing page, live stats from Firestore |
| `SignupPage` | Public | Signup/login, role selection |
| `AboutPage`, `ContactPage`, `PrivacyPage`, `TermsPage` | Public | Static content |
| `CandidateOnboarding` | Candidate | Profile setup, gates access until `isOnboarded` |
| `CandidateDashboard` | Candidate | Home dashboard — resume, AI matching, auto-apply |
| `JobsPage` | Candidate | Job board / search |
| `JobDetailsPage` | Candidate + Recruiter | Shared job detail view — apply flow for candidates, applicant view for recruiters |
| `ProfilePage` | Candidate | Profile editing |
| `ApplicationsPage` | Candidate | Application history/status |
| `CampusConnectPage`, `CampusConnectTestPage` | Candidate (campus flow) | College verification + AI-generated assessment |
| `SettingsPage` | Candidate + Recruiter | Account/plan settings, takes a `role` prop |
| `ConfirmPaymentPage` | Candidate + Recruiter | Cashfree checkout redirect + post-payment verification. Calls `/payments/activate-subscription` to activate subscription server-side after payment confirmation. |
| `VerifyEmailPage` | Any | Email verification gate |
| `RecruiterDashboard` | Recruiter | Applicant pipeline overview |
| `PostJobPage` | Recruiter | Job posting form, with AI-assisted JD parsing |
| `TalentPipelinePage` | Recruiter | Saved/shortlisted candidates |
| `RecruiterReportsPage` | Recruiter | Hiring analytics |
| `AdminPortal` | Admin | Job moderation, user blocking, test-result export |

## Key components

- `AsterixAssistant` / `AIChatOverlay` / `JobChatDrawer` — the AI chat surfaces, all proxying through the AI engine's `/chat` endpoint rather than calling any LLM from the browser. **Why proxy and not call LLMs directly?** Calling Groq or Gemini from the browser would expose your API keys in the bundle — every user could extract them from DevTools and use them for their own LLM calls. The AI engine is the only place that holds provider keys.
- `PaymentButton` — sets a plan/intent in `localStorage` and navigates to `/confirm-payment`; does not itself talk to Cashfree. See [Payments](/reference/payments).
- `OnboardingTutorial`, `UpgradeModal`, `AuthPromptModal`, `InterviewTipsModal`, `CandidateModal` — modal/overlay UI, self-contained.
- `Sidebar` — shared nav shell across dashboards, role-aware.
- `BrandLogo` — the only place the logo assets (`public/assets/logo-*.png`) are referenced from component code.

## Services

| File | Owns |
|---|---|
| `authService.ts` | Firebase Auth wrapper, `users` collection, role assignment, subscription state. `updateSubscription(orderId, plan)` now calls the AI engine server-side instead of writing to Firestore directly — see [Payments](/reference/payments#why-the-subscription-write-moved-server-side). |
| `Jobservice.ts` | `jobs` collection reads/writes |
| `applicationService.ts` | `applications` collection |
| `contactService.ts` | Contact form → `contact_messages` + AI engine `/contact` (which sends via Resend) |
| `geminiService.ts` | Despite the name, does **not** call Gemini from the browser. It's the client for every AI-engine endpoint. All calls include a Firebase ID token via `getAuthHeader()`, which calls `auth.currentUser.getIdToken()` before each fetch. If `auth.currentUser` is `null` at call time, the request will get a `401` from the backend. |
| `firebase.ts` | Firebase app/auth/firestore init. Config is read from `VITE_FIREBASE_*` environment variables — set in `.env.local` for local dev and in Vercel project settings for production. |

## `firebase.ts` — why env-driven config

`firebase.ts` reads its config from `VITE_FIREBASE_*` environment variables rather than hardcoded strings. This allows:

- **Key rotation** without code changes or redeployment — update the Vercel env var and the next build picks it up.
- **Multiple environments** — point a staging build at a different Firebase project by setting different env vars.
- **No accidental commit of rotated keys** — the values live in `.env.local` (gitignored) and Vercel secrets, not in source.

The Firebase web API key (`VITE_FIREBASE_API_KEY`) is not a secret in the traditional sense — it's required by the Firebase client SDK and is visible in any deployed app's network requests. The actual security comes from Firebase Auth (verifying who the user is) and Firestore rules (what they can read/write). Keeping the config in env vars is about operational hygiene (rotation, multi-environment), not about keeping the key hidden.

## Build

`vite.config.ts` — standard Vite + `@tailwindcss/vite` (Tailwind v4) + `@vitejs/plugin-react` setup. `npm run build` also builds this documentation site first — see [Deploy matrix](/platform/deploy-matrix) and the note in the repo's `package.json`.
