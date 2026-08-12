# Scripts & maintenance tools

All root-level `.mjs` scripts talk to Firestore via `firebase-admin`, each reinitializing its own connection independently rather than sharing a helper.

## Run by automation

| Script | Run by | Does |
|---|---|---|
| `import-jobs.mjs` | `aggregator.yml`, every 12h | Pulls from JSearch/RapidAPI, writes `aggregated_*` docs to `jobs`. Full detail: [Job aggregation pipeline](/reference/job-aggregation) |
| `cleanup-jobs.mjs` | `aggregator.yml`, right after import | Closes jobs past `applicationDeadline` |

## Manual / ad-hoc — not wired into any workflow

| Script | Does |
|---|---|
| `cleanup-empty-jobs.mjs` | Removes active jobs missing required content |
| `check-jobs.mjs` | Read-only debug listing of admin-posted jobs |
| `purge-external.mjs` | **Wipes the entire `jobs` collection** |
| `wipe-jsearch.mjs` | **Also wipes the entire `jobs` collection** — near-identical to `purge-external.mjs` |
| `set-premium.mjs` | Manually flips a user's subscription to premium (support/debugging tool) |

::: danger `purge-external.mjs` and `wipe-jsearch.mjs` are both full-collection wipes
They look like two versions of the same one-off cleanup tool, kept around after whatever they were built for. Before running either against the real Firestore project, confirm which jobs you actually intend to delete — there is no dry-run flag, and both operate on the live `jobs` collection with no environment guard.
:::

## Other root scripts

`import-test.mjs`, `tmp_check_jsearch.mjs`, `tmp_test_all_queries.mjs` — ad-hoc JSearch query testing, not part of any pipeline; treat as scratch scripts rather than maintained tooling.

## Duplicate doc-pipeline setup scripts

`setup-aidocs.cjs` and `setup-aidocs.js` are byte-identical, committed twice in two module formats — part of the unrelated AI documentation automation pipeline (`ai-docs.yml`), not this handbook. See [Gotchas](/platform/gotchas#duplicate-setup-aidocs-scripts) before editing either.
