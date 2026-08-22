# Plans & pricing

Figures below are pulled from the actual plan config and landing-page copy in the codebase, not estimated.

## Candidate side

| | Free | Student Plan — ₹99/month |
|---|---|---|
| Auto-Pilot (auto-apply) | ✅ | ✅ |
| AI match scoring on every job | ✅ | ✅ |
| View all live job listings | ✅ | ✅ |
| Manual apply ("Manual Initialize") | ❌ | ✅ |
| Full job detail access | ❌ | ✅ |
| Priority visibility to recruiters | ❌ | ✅ |
| Resume cloud storage | ❌ | ✅ |
| Unlimited applications | — | ✅ |

Landing-page marketing bullets for the Student Plan: "Auto-apply to 30+ jobs every day," "Get noticed by recruiters first," "Matches even for entry-level profiles," "Track all your applications," "Email alerts for new matches."

::: warning "30+ jobs a day" is marketing copy, not an enforced limit
There's no daily cap in the code — Auto-Pilot applies to however many jobs clear the match threshold on a given check, with no ceiling. Don't repeat "30+" as a guaranteed number if precision matters; it's descriptive, not a hard limit.
:::

::: warning The upgrade modal's payment claim doesn't match the actual flow
The paywall modal (shown when a free user tries to manually apply) says *"No payment gateway required — contact support to activate your student plan."* In reality, upgrading routes straight into a live **Cashfree** checkout with no support step involved — see [Payments](/reference/payments). This is a copy bug worth fixing in the product, not a documentation choice.
:::

## Recruiter side

| | Starter (free) | Pro — ₹1,999/month |
|---|---|---|
| Post job mandates | ✅ | ✅ Unlimited |
| Auto-match candidates | ✅ | ✅ Advanced/AI-powered |
| Applicant ordering | First-come-first-served only | Ranked by AI match score |
| Basic analytics | ✅ | ✅ Advanced dashboard |
| Priority candidate access | ❌ | ✅ |
| Bulk export | ❌ | ✅ |
| Support | Standard | Priority |

## How payment actually works

Both sides go through the same real flow: choosing a plan sets an intent in the browser and routes to a confirmation page, which loads the Cashfree checkout SDK, creates an order via the AI engine's backend, and redirects into Cashfree's hosted payment page. On return, the app polls for payment status and — once confirmed — flips the account to premium for **30 days** from that moment. It is a genuine, live payment integration; nothing about it is a placeholder or "contact support" workflow, regardless of what any in-app copy might say. Full technical detail: [Payments (Cashfree)](/reference/payments).
