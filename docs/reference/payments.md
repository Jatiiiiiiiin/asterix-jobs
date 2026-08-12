# Payments (Cashfree)

**Cashfree is the only live payment gateway.** `razorpay` is an installed dependency and a marketing-copy bullet in `constants.tsx`, with zero functional integration behind it — see [Gotchas](/platform/gotchas#razorpay-is-a-dead-dependency).

## Flow

1. `PaymentButton` sets the chosen plan/intent in `localStorage` and navigates to `/confirm-payment`. It does not talk to Cashfree itself.
2. `views/ConfirmPaymentPage.tsx` dynamically loads the `@cashfreepayments/cashfree-js` SDK, initialized with `mode: import.meta.env.VITE_CASHFREE_MODE` (sandbox or production).
3. It calls the AI engine's `POST /payments/create-order`, which creates the order server-side via `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` and returns a `payment_session_id`.
4. The SDK redirects into Cashfree's hosted checkout using that session id.
5. On return, `App.tsx`'s `handleGlobalPaymentVerification` polls `GET /payments/status/{order_id}` on the AI engine.
6. Once confirmed, `authService.updateSubscription(...)` writes the result to Firestore `users/{uid}.subscription`:
   - Recruiters land on `plan: "premium"`.
   - Candidates on the student plan land on `plan: "premium_student"`.
   - Both get a 30-day expiry from confirmation time.

## Where the money logic actually lives

Order creation and status checks are entirely server-side in the AI engine (`/payments/create-order`, `/payments/status/{order_id}`) — the frontend never holds a Cashfree secret. If a payment isn't reflecting as premium, check in this order:

1. Did `/payments/status/{order_id}` actually return success? (Render logs.)
2. Did `updateSubscription` run and write to `users/{uid}`? (Firestore console.)
3. Is the frontend reading the right field — `isPremium`/`isStudent` derived from `subscription`, not a separate flag?

## Config

`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` on the AI engine (Render); `VITE_CASHFREE_MODE` on the frontend (Vercel). Both need to agree on sandbox vs. production — a mismatch here is a classic "works for me, fails for the user" bug.
