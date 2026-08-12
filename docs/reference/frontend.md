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

Full details, including why this isn't a real security boundary: [Auth & access control](/platform/auth).

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
| `ConfirmPaymentPage` | Candidate + Recruiter | Cashfree checkout redirect + post-payment verification |
| `VerifyEmailPage` | Any | Email verification gate |
| `RecruiterDashboard` | Recruiter | Applicant pipeline overview |
| `PostJobPage` | Recruiter | Job posting form, with AI-assisted JD parsing |
| `TalentPipelinePage` | Recruiter | Saved/shortlisted candidates |
| `RecruiterReportsPage` | Recruiter | Hiring analytics |
| `AdminPortal` | Admin | Job moderation, user blocking, test-result export |

## Key components

- `AsterixAssistant` / `AIChatOverlay` / `JobChatDrawer` — the AI chat surfaces, all proxying through the AI engine's `/chat` endpoint rather than calling any LLM from the browser.
- `PaymentButton` — sets a plan/intent in `localStorage` and navigates to `/confirm-payment`; does not itself talk to Cashfree. See [Payments](/reference/payments).
- `OnboardingTutorial`, `UpgradeModal`, `AuthPromptModal`, `InterviewTipsModal`, `CandidateModal` — modal/overlay UI, self-contained.
- `Sidebar` — shared nav shell across dashboards, role-aware.
- `BrandLogo` — the only place the logo assets (`public/assets/logo-*.png`) are referenced from component code.

## Services

| File | Owns |
|---|---|
| `authService.ts` | Firebase Auth wrapper, `users` collection, role assignment, subscription state |
| `Jobservice.ts` | `jobs` collection reads/writes |
| `applicationService.ts` | `applications` collection |
| `contactService.ts` | Contact form → `contact_messages` + AI engine `/contact` (which sends via Resend) |
| `geminiService.ts` | Despite the name, does **not** call Gemini from the browser — it's the client for every AI-engine endpoint (`/extract`, `/embed-resume`, `/match`, `/insights`, `/tips`, `/summary`, `/chat`, `/send-auto-apply-email`, `/parse-jd`, `/generate-test`). All LLM provider selection happens server-side. |
| `firebase.ts` | Firebase app/auth/firestore init. Config is hardcoded here, not env-driven — see [Infrastructure](/platform/infrastructure#environment-variables) |

## Build

`vite.config.ts` — standard Vite + `@tailwindcss/vite` (Tailwind v4) + `@vitejs/plugin-react` setup. `npm run build` also builds this documentation site first — see [Deploy matrix](/platform/deploy-matrix) and the note in the repo's `package.json`.
