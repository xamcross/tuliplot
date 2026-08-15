# Freemius billing — design spec

Date: 2026-08-15. Status: owner-approved (Approach B). Supersedes the Stripe
half of plan 05 (`docs/superpowers/plans/2026-07-21-dashdash-05-billing.md`).

## Context

TulipLot sells one paid tier: Premium, $4/month. The shipped billing module
speaks to Stripe directly. It never worked in production: the Stripe secrets
were never set, so `POST /api/v1/billing/checkout-session` returns 500.
The deeper blocker: Stripe does not onboard merchants who are based in
Ukraine, and the owner is. The owner selected **Freemius**, a merchant of
record. Freemius supports sellers in Ukraine (non-sanctioned regions) and
pays out through PayPal, Payoneer, Wise, or wire.

Production has zero paying subscribers. There is no data to migrate.

## Decision

Replace the Stripe integration with a Freemius integration. Keep the
tier state machine and the grid reconcile logic. Delete the Stripe code.

**Freemius identifiers:** `productId=37109`, `planId=61603` ($4/month
Premium). The plan currency and price live in the Freemius dashboard; the
published pages state $4/month, and the plan must match.

## Verified facts about Freemius

Source: the Freemius documentation (`freemius.com/help/documentation/`),
read on 2026-08-15.

- Checkout runs as a JS overlay (`FS.Checkout` with `product_id`,
  `plan_id`; `open()` accepts `user_email` and `readonly_user`) or as a
  hosted page (`https://checkout.freemius.com/product/{id}/plan/{id}/`).
- Webhooks carry an `X-Signature` header: HMAC-SHA256 over the raw request
  body, keyed with the product **secret key**.
- License lifecycle events: `license.created`, `license.updated`,
  `license.plan.changed`, `license.extended`, `license.shortened`,
  `license.cancelled`, `license.expired`, `license.deleted`.
- The REST API authenticates with a Bearer token. Relevant endpoints:
  license retrieval, subscription retrieval for a license, and
  `POST /v1/products/{product_id}/portal/login.json` for a hosted
  customer-portal login link.
- A sandbox mode exists for test checkouts.

## Architecture

The flow keeps the shape the Stripe module proved:
**event → verify → dedupe → retrieve from the API → resync the tier.**
The webhook payload is only a trigger. The Freemius API is the source of
truth for license state. This protects against out-of-order events and
thin payloads, and it is the pattern the Freemius guide recommends.

### Deleted

- `BillingController`, `StripeService`, `StripeGateway`,
  `StripeGatewayImpl`, `StripeGatewayException`, `StripeConfig`,
  `StripeWebhookController`, `StripeSubscriptionSnapshot`,
  `NoStripeCustomerException`, `dto/CheckoutSessionResponse`.
- The `stripe-java` dependency.
- The `tuliplot.stripe` block in `application.yml`.
- All tests that cover the deleted classes.
- The frontend call to `POST /api/v1/billing/checkout-session`.

### Kept

- `SubscriptionService`: the tier state machine, the
  `wasPremium != premium` reconcile rule, and `reconcileForTier`.
- The event-dedupe mechanism (TTL collection). The class renames from
  `ProcessedStripeEvent` to `ProcessedBillingEvent`, collection
  `processed_billing_events`. The old collection holds nothing in
  production and dies unused.
- `dto/PortalSessionResponse` and the portal-session request shape.

### New backend components

All in package `com.tuliplot.billing`.

1. **`FreemiusConfig`** — `@ConfigurationProperties("tuliplot.freemius")`:
   `product-id`, `secret-key`, `api-base-url`. Env-driven
   (`FREEMIUS_PRODUCT_ID`, `FREEMIUS_SECRET_KEY`, `FREEMIUS_API_BASE_URL`)
   with empty defaults, so the app boots in dev without billing.
2. **`FreemiusGateway`** (interface) + **`FreemiusGatewayImpl`** on Spring
   `RestClient`:
   - `retrieveLicense(licenseId)` → a `FreemiusLicenseSnapshot`.
   - `retrieveSubscription(licenseId)` → renewal state for the license.
   - `createPortalLoginUrl(email)` → the hosted portal URL.
   The Bearer credential is the product secret key. Wrap transport
   failures in an unchecked `FreemiusGatewayException`.
3. **`FreemiusWebhookController`** — `POST /api/v1/billing/webhook`
   (the path the Stripe webhook used; `SecurityConfig` already permits it
   and exempts it from CSRF):
   - Read the raw bytes. Compute HMAC-SHA256 with the secret key. Compare
     to `X-Signature` with `MessageDigest.isEqual`. Failure → 401.
   - Parse the event id, the event type, and the license id.
   - Dedupe on the event id. A duplicate → 200, no work.
   - A handled event type → fetch the license from the API → apply.
   - An unhandled event type → 200, no work.
   - Write the dedupe record only after a successful apply.
4. **`BillingController`** (new, slim) —
   `POST /api/v1/billing/portal-session` (authenticated): return the
   portal URL for the user's email. No license on file → 400 with code
   `no_subscription`.

### Buyer matching

The checkout locks the email field to the signed-in user's account email
(`readonly_user: true`). The webhook matches the license to the account
by that email. An event whose email matches no account → 200 + a WARN
log. A 4xx would make Freemius retry a permanently unmatchable event.

### License-state mapping

| Freemius license state | SubStatus | Tier |
|---|---|---|
| active, not expired | `ACTIVE` | PREMIUM |
| in trial | `TRIALING` | PREMIUM |
| cancelled, not yet expired | `ACTIVE` + `cancelAtPeriodEnd=true`, `currentPeriodEnd` = license expiration | PREMIUM |
| expired or deleted | `CANCELED` | FREE + grid reconcile |

The user document keeps its subscription subdocument. `stripeCustomerId`
gives way to `fsLicenseId`. Mongo is schemaless; no migration.

### Frontend

1. `environment.freemius = { productId: 37109, planId: 61603 }`, plus the
   public key if the overlay requires it (open item 3).
2. The upgrade page lazy-loads the Freemius checkout script, then opens
   the overlay with `user_email` prefilled and `readonly_user: true`.
   The success callback shows a "finishing your upgrade" state and polls
   `/auth/me` until the tier flips. A poll timeout shows "payment
   received, activation pending" — honest, because the webhook does the
   flip.
3. The settings "Manage subscription" button keeps its current shape:
   call `portal-session`, open the returned URL.
4. The checkout script loads only inside the authenticated app. The
   consent and AdSense logic on the public pages stays untouched.

## Error handling

- Bad or absent signature → 401.
- Unknown event type → 200, ignored.
- Unknown email → 200 + WARN.
- Freemius API failure during apply → 500, so Freemius retries; the
  dedupe record does not exist yet, so the retry completes the work.
- Portal request without a license → 400 `no_subscription`.

## Testing

Backend:
- Signature: valid, invalid, missing header.
- Dedupe: a duplicate event does no work.
- One test per handled event type; each asserts the tier transition and
  the reconcile side effect.
- Unknown email; unknown event type.
- Portal endpoint: with and without a license (gateway mocked).
- `FreemiusGatewayImpl` against a mock HTTP server.

Frontend:
- The overlay opens with the locked email.
- The poll flips the UI on tier change; the timeout state renders.
- The portal button opens the returned URL.

End-to-end: a sandbox-mode checkout against production, an owner step
with guidance. Full suites green before merge.

## Configuration and deployment

- New Fly secrets: `FREEMIUS_SECRET_KEY`, `FREEMIUS_PRODUCT_ID=37109`.
- The `STRIPE_*` secrets were never set; nothing to remove on Fly.
- No other deployment change. The merge auto-deploys both halves.

## Out of scope

Annual pricing, trials UI, coupons, the affiliate program, invoice UI
(the hosted portal covers it), data migration (no subscribers exist).

## Open items to pin during implementation

1. The exact checkout script URL and the `FS.Checkout` option names —
   from the overlay-checkout doc and the dashboard-generated snippet.
2. The API base URL and the exact Bearer credential form — verified in
   sandbox before the webhook code is finalized.
3. Whether the overlay requires the public key (`pk_...`). The owner
   supplies it from the Freemius dashboard settings page if so.
4. The exact shape of the license JSON (field names for expiration,
   cancellation, trial) — pinned from a sandbox API response.
