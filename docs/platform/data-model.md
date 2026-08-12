# Data model (Firestore)

There's no backend API in front of the database and no schema file to grep — this page *is* the schema, reverse-engineered from every `collection(...)` call in the codebase. If you add a new collection, add it here.

## Collections

| Collection | Written by | Holds |
|---|---|---|
| `users` | `authService.ts` | User profile, `role` (`candidate` \| `recruiter` \| `admin`), `isOnboarded`, `subscription` (`plan`, `status`, `isPremium`, `isStudent`, dates) |
| `jobApplicationCounts` | `authService.ts` (single doc `global`) | Site-wide application counter shown on the landing page |
| `jobs` | `Jobservice.ts`, `AdminPortal.tsx`, `PostJobPage.tsx`, `RecruiterDashboard.tsx`, `import-jobs.mjs` | Job postings — both admin/recruiter-posted and aggregator-imported (doc id `aggregated_<slug>`) |
| `applications` | `applicationService.ts`, `ApplicationsPage.tsx`, `RecruiterDashboard.tsx`, `TalentPipelinePage.tsx` | Candidate applications against `jobs` |
| `contact_messages` | `contactService.ts` | Contact form submissions |
| `profiles` | `AdminPortal.tsx` | Moderation flags, notably `isBlocked` |
| `test_results` | `AdminPortal.tsx`, `CampusConnectTestPage.tsx` | Campus Connect assessment scores |
| `talentPipeline` | `TalentPipelinePage.tsx` | Recruiter's saved/shortlisted candidates |

## Things worth knowing before you touch this

- **`jobs` is shared between humans and the aggregator.** Manually-posted jobs and `import-jobs.mjs`-written jobs live in the same collection, distinguished only by doc id convention (`aggregated_*` vs everything else). A query or admin action that doesn't account for this will treat both the same way — usually fine, but worth remembering when debugging "why is this job here."
- **`users` and `profiles` are two different collections**, both holding data about a person. `users` is the account/role/subscription record; `profiles` is where moderation state (`isBlocked`) lives. Don't assume one is a superset of the other.
- **No Storage bucket.** Resumes are never uploaded as files to Firebase — they're parsed into text/JSON client-side or via the AI engine's `/extract` and `/embed-resume` endpoints, and only the extracted result is what gets used. If you're looking for where resume files live, they don't persist anywhere server-side.
- **Access control is `firestore.rules`, not this page.** This table describes what the app *writes*; it says nothing about who's *allowed* to write it. See [Auth & access control](/platform/auth).
