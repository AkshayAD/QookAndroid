# Google Play Billing Plan

Last updated: June 13, 2026

## Recommendation

Use direct Google Play Billing through a maintained Capacitor plugin, with server-side verification in Qook's existing Vercel/Supabase billing backend.

Recommended plugin for the implementation phase: Capawesome Capacitor Purchases, after confirming its current Google Play Billing Library version at implementation time. This is preferable to RevenueCat for Qook because the app already has a Supabase credit/subscription ledger, Razorpay verification endpoints, and idempotent grant RPCs. RevenueCat would add another entitlement source to reconcile; direct Play Billing keeps Google as the Android payment provider and Supabase as the single source of truth.

Do not wire this into UI yet. Android checkout remains blocked until the full client, backend verification, product setup, RTDN, and internal testing are complete.

## Product Catalog

Create one Play Console subscription product per plan. Use one base plan per product, monthly auto-renewing, in INR.

| Existing plan | Price | Credits / entitlement | Suggested Play product ID | Existing grant target |
| --- | ---: | --- | --- | --- |
| `byok` | INR 29 | BYOK entitlement, no platform credit grant | `qook_sub_byok_29` | `user_subscriptions.plan_id = 'byok'` |
| `basic` | INR 49 | 8 credits/month | `qook_sub_basic_49` | `verify_razorpay_payment`-equivalent subscription grant for `basic` |
| `pro` | INR 99 | 20 credits/month | `qook_sub_pro_99` | `verify_razorpay_payment`-equivalent subscription grant for `pro` |
| `family_pro` | INR 149 | 40 pooled credits/month, family entitlement | `qook_sub_family_pro_149` | existing family `grant_credits` path for `family_pro` |

Create one in-app product per credit pack. Mark these as consumable and consume only after server verification and ledger grant succeed.

| Existing pack | Price | Credits | Suggested Play product ID | Existing grant target |
| --- | ---: | ---: | --- | --- |
| `starter` | INR 19 | 3 | `qook_credits_starter_3_19` | `grant_credits(..., 3, 'purchased', ...)` |
| `popular` | INR 49 | 8 | `qook_credits_popular_8_49` | `grant_credits(..., 8, 'purchased', ...)` |
| `value` | INR 99 | 20 | `qook_credits_value_20_99` | `grant_credits(..., 20, 'purchased', ...)` |
| `mega` | INR 199 | 50 | `qook_credits_mega_50_199` | `grant_credits(..., 50, 'purchased', ...)` |

The typed product-ID scaffold lives in `services/billing/playBilling.ts`. It has no plugin calls and is not imported by the app today.

## Client Flow

1. Feature-flag Android billing off by default.
2. When enabled, native pricing UI loads Play products by the IDs above.
3. User purchases through the Play Billing plugin.
4. Client sends only `productId`, `purchaseToken`, `packageName`, and product kind to a new authenticated server endpoint.
5. Server verifies and grants. Client never sends credit amount, plan tier, or price as trusted values.
6. For consumables, client consumes the purchase only after the server returns a verified, idempotent grant success.
7. For subscriptions, client acknowledges only after server verification succeeds.

## Server Verification

Add one consolidated endpoint, for example `/api/verify-android-purchase`, rather than several new Vercel functions. Production has a 12-function cap, so this should share helpers with the existing Razorpay verification path where possible.

Endpoint responsibilities:

1. Require Supabase bearer auth and assert request user, matching current payment endpoints.
2. Map `productId` to a server-owned catalog row or constant. Reject unknown or inactive products.
3. Use the Google Play Developer API with a service account to verify the token:
   - Consumables: `purchases.products.get(packageName, productId, token)`.
   - Subscriptions: `purchases.subscriptionsv2.get(packageName, token)`.
4. Assert package name is `in.qook.app`, purchase state is purchased/active, currency and product match the server catalog, and the token has not already been granted.
5. Record a billing intent/event using provider `google_play`, with unique keys on purchase token and order ID where present.
6. Grant through the same ledger paths web uses:
   - Packs call `grant_credits` with `credit_type = 'purchased'`.
   - Subscriptions use a `verify_razorpay_payment`-equivalent service-role function or a renamed provider-neutral wrapper that updates `user_subscriptions` and calls `grant_credits`.
7. Return idempotent success for duplicate verified tokens without granting twice.

Required env:

```env
GOOGLE_PLAY_PACKAGE_NAME=in.qook.app
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=...
```

The service account JSON must stay server-side only. Never ship Google API credentials in the Capacitor app.

## Idempotency

Use a provider-neutral payment event key:

```text
google_play:product:<purchaseToken>
google_play:subscription:<purchaseToken>
google_play:order:<orderId>
```

Store raw Google verification payloads in `billing_payment_events.payload` or a provider-neutral successor table. The grant transaction should insert the event first under a unique constraint, then mutate `user_subscriptions`, `credit_purchases`, `user_credits`, and `family_credit_pool`. If the unique insert conflicts, return the existing completed result.

For consumables, only mark/consume the Play purchase after Qook's server has committed the grant. If consume fails after commit, RTDN or restore can reconcile because the token is already idempotently recorded.

## RTDN Reconciliation

Configure Google Play Real-time Developer Notifications to Pub/Sub.

Recommended handling:

1. Pub/Sub push hits one authenticated Vercel endpoint, or a small relay if Vercel auth/secrets are awkward.
2. Endpoint stores the RTDN event key idempotently.
3. For subscription notifications, fetch current subscription state from Google, then update `user_subscriptions` status/renewal fields.
4. For renewal purchases, grant monthly credits through the same provider-neutral subscription grant path using the latest purchase token/order reference.
5. For cancellations, expirations, grace, hold, pause, and revoke events, update entitlement status without deleting already-granted non-expired credits unless policy explicitly requires revocation.

RTDN is reconciliation, not the primary checkout success path. The user-facing purchase still verifies synchronously after checkout.

## Owner Steps

These cannot be completed from this repo:

1. In Play Console, confirm the app package is `in.qook.app`.
2. Create the four subscription products and base plans listed above.
3. Create the four consumable in-app products listed above.
4. Link Play Console to a Google Cloud project.
5. Create a service account with the required Google Play Developer API permissions.
6. Grant the service account access in Play Console under API access.
7. Enable Google Play Developer API in Google Cloud.
8. Configure Pub/Sub topic and subscription for Real-time Developer Notifications.
9. Add server-only env vars in Vercel.
10. Run Play internal testing with license testers before enabling the Android billing flag.

## Coexistence With Razorpay

Web remains Razorpay. Android uses Google Play Billing. Both providers must feed the same Supabase credit ledger and subscription state so feature gates, credit display, family pooling, and admin tools remain provider-agnostic.

The current native Razorpay block must remain until Android Play Billing is fully implemented and tested.

## References

- Google Play Billing integration guide: https://developer.android.com/google/play/billing/integrate
- Google Play Developer API purchases products: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
- Google Play Developer API subscriptions v2: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
- Google Play Real-time Developer Notifications: https://developer.android.com/google/play/billing/rtdn-reference
- Capawesome Capacitor Purchases: https://capawesome.io/plugins/purchases/
