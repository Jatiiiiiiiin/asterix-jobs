# Deploy matrix

| What | Trigger | Where | Confirmation step? |
|---|---|---|---|
| Frontend SPA | Push to `main` (Vercel Git integration) | Vercel | No — deploys automatically |
| AI engine | Push to `main` affecting `ai-engine/` (Render Git integration) | Render | No — deploys automatically |
| Job aggregation | Cron `0 */12 * * *` (every 12h) **or** manual `workflow_dispatch` | GitHub Actions runner | No — runs unattended |
| AI docs automation | Push to `main`, or a PR closed/merged into `main` | External n8n webhook | No — fires unattended. Unrelated to this handbook; see [Read this first](/#what-this-covers). |

::: warning No staged/approved deploys anywhere
Unlike handbooks you may have seen elsewhere with a manual-approval gate on prod branches, **every** deploy path here is push-to-deploy. A merge to `main` is live within minutes on both Vercel and Render, with nobody in the loop. Review PRs like they're going straight to production, because they are.
:::

## Practical implications

- **Frontend and AI engine deploy independently.** A PR that only touches `views/` or `components/` redeploys the SPA and leaves the AI engine untouched, and vice versa for `ai-engine/`. There's no coordinated release — if you need a frontend change and a matching AI engine change to land together, land the AI engine change first (or make the frontend tolerant of the old API shape) since Render and Vercel finish independently.
- **The job aggregator runs on its own clock, not on deploy.** Merging code that changes `import-jobs.mjs` doesn't run it — it waits for the next 12-hour tick, or you trigger it manually via `workflow_dispatch` in the Actions tab.
- **`main` is the only branch that matters for deploys.** There's no separate `staging`/`prod` branch split observed in the workflow files — see [Infrastructure](/platform/infrastructure#single-environment-no-staging).
