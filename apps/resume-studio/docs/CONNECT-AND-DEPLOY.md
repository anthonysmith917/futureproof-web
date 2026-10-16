# Resume Studio on Cloudflare

Resume Studio belongs to **anthonysmith917/futureproof-web**, the repository for AskFutureProof. Its source is in **apps/resume-studio/**. It runs as a separate Cloudflare Worker and D1 database at **https://resume.askfutureproof.com**. Existing main-site files and hosting remain separate. This is not hosted through ChatGPT Sites.

## Google sign-in

Google is the only Resume Studio sign-in provider. No Desygn Shop or Microsoft sign-in route is enabled. Google handles authentication; Resume Studio stores a stable provider subject, display name and its own hashed server session. Resume content and saved jobs belong to that account.

Create/configure a Google OAuth web client with:

- Authorized JavaScript origin: `https://resume.askfutureproof.com`
- Authorized redirect URI: `https://resume.askfutureproof.com/auth/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` through Cloudflare Worker secrets, never through client code or committed files. The implementation uses PKCE S256, nonce, one-use state, signature, issuer, audience and expiry validation, and HttpOnly/Secure session cookies. The header opens a Google-only sign-in dialog. Until credentials are configured, it explains that Google sign-in is not available yet.

## GitHub deployment

The root workflow `.github/workflows/resume-studio.yml` tests/builds this subfolder. On main-branch changes, it deploys only the Resume Studio Worker and its custom domain. The main website is not moved by this workflow.

Configure these repository secrets using GitHub's secret settings:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with Worker deployment, D1 management and custom-domain/DNS permissions for the intended account/zone |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `RESUME_GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `RESUME_GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |

The workflow checks Cloudflare access before deploying. It sends Google credentials into Worker secrets when both are supplied. If Google secrets are already configured directly in Cloudflare, leave both GitHub Google secrets unset to preserve them. No credential values are printed or committed.

Run locally from this subfolder with Node 24+:

```bash
npm ci
npm run build:review
npm test
npm run cloudflare:login
npm run deploy
```

The deployment script lists D1 databases, reuses or creates `futureproof-resume-studio`, applies all three migrations, builds, and deploys to the declared custom domain. The returned D1 database ID is written only into the working checkout. It does not create a separate GitHub repository or use a temporary Cloudflare account. The account must control the `askfutureproof.com` zone. Any existing record on the exact resume hostname must be resolved in that account without changing the main site's records.

For Cloudflare Workers Builds connected directly to this repository, select `main` and set the root directory to `apps/resume-studio`; use `npm ci && npm run build` for the build command and `npm run deploy` for deployment. Use one deployment pipeline at a time to avoid parallel migrations/releases. Worker secrets must be configured directly if GitHub Actions is not used.

For local Worker development:

```bash
npm run build
npx wrangler d1 migrations apply futureproof-resume-studio --local
npx wrangler dev --var APP_URL:http://localhost:8787
```

Local Google testing requires the corresponding loopback origin and `/auth/google/callback` registered on the OAuth client. An opened HTML download cannot perform server sign-in, cloud saves or live job search.

## Desygn Shop payments

Google signs customers into Resume Studio. Desygn Shop handles paid checkout independently and sends verified payment confirmation back to the originating Google account. The billing portal may require its own shop account; it does not replace Resume Studio's Google sign-in and does not receive resume text or saved-job notes.

The saved shop revamp's Node server, extended for checkout, is included under `integrations/desygnshop-portal/` for integration with the real portal. Neither the live storefront nor its existing hosted Site has been changed by this code. Do not set the portal URL to a static storefront or an unverified marketing URL.

Resume Studio configuration:

- `DESYGN_PORTAL_URL`: exact HTTPS origin running the companion checkout endpoints.
- `DESYGN_BRIDGE_SECRET`: cryptographically random server-only shared secret, at least 32 characters, stored using `npx wrangler secret put DESYGN_BRIDGE_SECRET`.
- `PAYMENTS_ENABLED`: `false` during setup; enable after sandbox end-to-end testing.

Portal server configuration:

| Name | Value |
| --- | --- |
| `DESYGN_PUBLIC_ORIGIN` | Exact HTTPS portal origin |
| `RESUME_APP_URL` | `https://resume.askfutureproof.com` |
| `DESYGN_BRIDGE_SECRET` | Same server-only private secret |
| `RESUME_PAYMENTS_ENABLED` | `false` during setup; `true` after testing |
| `STRIPE_RESTRICTED_KEY` | Restricted server key for Checkout, Prices and line items |
| `STRIPE_RESUME_WEBHOOK_SECRET` | Webhook signature secret |
| `STRIPE_PRICE_RESUME_STARTER` | One-time USD $4.99 Price |
| `STRIPE_PRICE_RESUME_PLUS` | One-time USD $9.99 Price |

The Node companion defaults to loopback and needs its own Node host/reverse proxy for production. It does not run unchanged as a Worker. Only Resume Studio is being moved to Cloudflare in this task. Keep portal data files outside public assets and all keys in server secret storage.

Register the required Stripe webhook at the actual portal origin's `/api/resume/stripe/webhook`. Subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. The handler verifies the raw signature, stored session, account, price, quantity, total and currency. Unpaid sessions grant nothing. It sends a signed notification to `https://resume.askfutureproof.com/api/shop/webhook`; failures return an error so Stripe retries. Duplicate notifications grant credits once, even if the customer never returns to the app. The return page can reconcile its own order and refresh the visible balance.

A $4.99 pack grants 10 AI credits and full template access; $9.99 grants 30 credits and the same access. No subscription is created. Template access remains after credits are spent. Browser-supplied prices/credits are ignored. These purchases do not unlock unrelated shop subscriptions. Refund/dispute revocation is not automated; finalize those procedures and commercial terms before live collection.

## Jobs and free access

Free includes one fixed Traditional single-column format with imports, formatting checks and Word/HTML/PDF exports. Other layouts, colors and section placement require a server-confirmed paid pack.

`GET /api/jobs/search` is public and free. It searches a shared D1-cached Remotive remote-job feed with keywords, location eligibility text, category, type and pagination. The feed refreshes at most every six hours, with stale fallback for up to seven days. Listings credit/link to Remotive and are delayed by 24 hours. Search does not submit applications.

Users can save up to 100 jobs, including manually added HTTPS listings from any employer, keep notes/status, compare descriptions with their resume and create application copies. Saving a job persists it on the browser. Account copies use explicit save/load/merge and owner-scoped APIs with revision conflicts. Workspace backups include saved jobs. The saved shortlist is free; it does not require template purchase.

## Verification and launch status

Tests cover Google OAuth validation, cross-app checkout/payment notification, duplicate fulfillment, credit accounting, cloud ownership, saved jobs, all fifteen original NurseReady templates, all 100 additional designs, imports, exports and work-history formatting. Google/Stripe transports in integration tests are mocked; no real account login or charge is claimed.

A production launch still requires Cloudflare account access, Google OAuth credentials/callback, and configured hosted portal checkout. A successful build or dry-run is not a live deployment.
