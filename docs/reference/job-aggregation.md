# Job aggregation pipeline

A GitHub Actions workflow (`.github/workflows/aggregator.yml`, "Job Aggregator Sync") that pulls fresher-job listings into Firestore, entirely independent of any deploy or user request.

## Trigger

Cron `0 */12 * * *` (every 12 hours) plus manual `workflow_dispatch` from the Actions tab.

## What it does, in order

1. Checkout, `npm install`.
2. Write the `FIREBASE_SERVICE_ACCOUNT` secret to `ai-engine/service-account.json` at runtime, so `firebase-admin` can authenticate. (This is a separate write from the credential that's committed to the repo — see [Gotchas](/platform/gotchas#committed-service-account-credential).)
3. `node import-jobs.mjs --provider=rapidapi`
4. `node cleanup-jobs.mjs`

## `import-jobs.mjs`

Pluggable via a `PROVIDERS` map — currently `mock` and `rapidapi`. The live path is `RapidAPIProvider`, which:

- Hits **JSearch** through RapidAPI (`jsearch.p.rapidapi.com/search`).
- Runs 6 hardcoded queries targeting entry-level/fresher roles in India.
- Does its own lightweight regex-based tech-stack extraction — this does **not** call the AI engine's `/embed-resume` or any LLM.
- Maps results into a `LiveJob` shape.
- Dedupes/merges by `slugify(company)_slugify(title)`, written to Firestore `jobs` with doc id `aggregated_<key>` and `merge: true`.

## `cleanup-jobs.mjs`

Closes any job (aggregated or manual) whose `applicationDeadline` has passed. Runs every aggregator cycle, right after import.

## Related scripts not run by the workflow

`cleanup-empty-jobs.mjs`, `check-jobs.mjs`, `purge-external.mjs`, `wipe-jsearch.mjs` — all manual/ad-hoc, not wired into any automation. Full rundown, including which two of these wipe the entire `jobs` collection: [Scripts & maintenance tools](/reference/scripts).

## If this breaks

Check the Actions tab run log first — RapidAPI rate limits or key expiry are the most likely failure, and they fail loudly (the fetch will throw) rather than silently importing nothing. `RAPIDAPI_KEY` lives in repo secrets, not in `render.yaml` or Vercel — see [Ownership](/ownership#where-secrets-live).
