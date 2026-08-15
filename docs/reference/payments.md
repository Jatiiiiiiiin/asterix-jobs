# Payments (Cashfree)

**Cashfree is the only live payment gateway.** `razorpay` is an installed dependency and a marketing-copy bullet in `constants.tsx`, with zero functional integration behind it — see [Gotchas](/platform/gotchas#razorpay-is-a-dead-dependency).

## Flow

1. `PaymentButton` sets the chosen plan/intent in `localStorage` and navigates to `/confirm-payment`. It does not talk to Cashfree itself.
2. `views/ConfirmPaymentPage.tsx` dynamically loads the `@cashfreepayments/cashfree-js` SDK, initialized with `mode: import.meta.env.VITE_CASHFREE_MODE` (sandbox or production).
3. It calls `POST /payments/create-order` on the AI engine with a Firebase ID token attached. The backend verifies the token, confirms that `customer_id` in the request matches the caller's `uid`, then creates the order via `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` and returns a `payment_session_id`.
4. The SDK redirects into Cashfree's hosted checkout using that session id.
5. On return, `App.tsx`'s `handleGlobalPaymentVerification` calls `GET /payments/status/{order_id}` on the AI engine (with auth token).
6. Once confirmed, it calls `POST /payments/activate-subscription` on the AI engine (with auth token). The backend verifies the Cashfree payment independently, then writes `isPremium`/`isStudent` to Firestore using the Firebase Admin SDK.

## Why the subscription write moved server-side

The previous flow had the frontend call `authService.updateSubscription()` after receiving a payment redirect — trusting the browser to report its own payment status and writing directly to Firestore.

**The problem:** Any authenticated user could open the browser console and call `authService.updateSubscription({plan: "premium", isPremium: true})` to self-upgrade without paying. Firestore rules allowed users to write their own `users/{uid}` document, so there was nothing blocking this.

**The fix:** The frontend now calls `POST /payments/activate-subscription` instead. The AI engine:
1. Verifies the Firebase token (confirms caller identity)
2. Calls Cashfree's `PGOrderFetchPayments` to confirm the payment actually succeeded server-side
3. Only then writes `isPremium: true` to Firestore via Firebase Admin SDK (which bypasses client-side rules)

This makes the payment verification and the subscription grant an atomic server-side operation. The client has no path to grant itself premium status — it can only trigger the server-side verification flow.

**Why not just tighten Firestore rules to block `isPremium` writes?**
You could add a rule like `allow update: if !request.resource.data.diff(resource.data).affectedKeys().hasAny(["isPremium", "isStudent"])`. But this creates a tight coupling between Firestore rules and the data model — any future field rename breaks the rule silently. A server-side activation endpoint is more explicit, more auditable, and survives data model evolution better.

## `/payments/create-order` — the `customer_id` check

The endpoint now enforces `req.customer_id == user.uid` (from the verified JWT). Without this check, an authenticated user could create an order on behalf of another user's UID — for example, to charge someone else's account or to confuse the payment attribution.

## Where the money logic actually lives

Order creation, status checks, and subscription activation are entirely server-side in the AI engine — the frontend never holds a Cashfree secret. If a payment isn't reflecting as premium, check in this order:

1. Did `/payments/status/{order_id}` return success? (Render logs.)
2. Did `/payments/activate-subscription` run? Did it get a `SUCCESS` status from Cashfree? (Render logs.)
3. Did the Admin SDK write succeed? Is `isPremium: true` now in `users/{uid}`? (Firestore console.)
4. Is the frontend reading the right field — `isPremium`/`isStudent` derived from `subscription`, not a stale cached value?

## Config

`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` on the AI engine (Render); `VITE_CASHFREE_MODE` on the frontend (Vercel). Both need to agree on sandbox vs. production — a mismatch here is a classic "works for me, fails for the user" bug.
