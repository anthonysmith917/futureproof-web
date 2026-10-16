# Implementation and integration notes

## Information architecture

- `/studio`: primary AI Studio entry, idea composer, starter concepts, workflow, and scope disclosure.
- `/`: unified shop homepage connecting digital creation, launch packages, and physical products.
- `/packages`: Essentials, Presence, Full Picture, and custom package briefs. Quantities affect the brief; no fabricated prices or checkout totals.
- `/shop`: illustrative print, signage, branding, and apparel catalog. Existing store products remain linked to the current storefront.
- `/plans`: free local access and proposed paid/service directions. No unvalidated prices or allowances.
- `/signin`, `/portal`, `/workspace`: customer sign-in, saved records, brand details, and project editor.
- `/about`, `/contact`, `/privacy`, `/terms`, `/security`: supporting pages with truthful local-review scope.

## API

All API responses are private/no-store. Mutations require a session CSRF token from `GET /api/session`. Authentication rotates the session identifier. The local HTTP-only SameSite=Strict cookie is appropriate for loopback HTTP review; production must use HTTPS and Secure cookies.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/session` | Current local account, CSRF token, connection state |
| POST | `/api/auth/register` | Create local account |
| POST | `/api/auth/login` | Authenticate |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/account` | Owned projects, package drafts, brand, plan, order/invoice/subscription records |
| GET | `/api/account/export` | Download owned data without authentication secrets |
| PATCH | `/api/account/profile` | Update the signed-in account name |
| POST | `/api/account/password` | Verify the old password, change it, and revoke other sessions |
| DELETE | `/api/account` | Password-confirmed removal of this local account and its local records |
| PUT | `/api/brand` | Save brand details |
| POST | `/api/projects` | Create a project and initial snapshot |
| GET/PATCH | `/api/projects/:id` | Read or revise an owned project |
| GET | `/api/projects/:id/preview` | Personalized starter website |
| GET | `/api/projects/:id/download` | Download the same website HTML |
| POST | `/api/projects/:id/restore` | Restore an owned snapshot as a new version |
| POST | `/api/packages` | Save an unsubmitted package draft |
| POST | `/api/plan-interest` | Save interest without changing entitlements |

## Billing boundary

`src/billing.mjs` is provider-neutral. It cannot charge a card. A future provider adapter must verify a webhook against its raw body and signature, then return an allowlisted normalized event. Do not wire raw JSON directly into this receiver in production. No webhook route is currently registered.

Normalized event fields: `id`, `userId`, `occurredAt`, `type`, and `record`. Supported types are `subscription.updated`, `order.updated`, and `invoice.updated`. Records are associated with an authenticated customer mapping controlled by the server. A production adapter must map a verified external customer ID to an internal account; it must not trust an arbitrary account ID sent by the browser.

Subscriptions, orders, invoices, and event IDs have separate tables. Active/trialing supported subscriptions with a valid period grant paid access. One-time physical orders do not grant a digital subscription. Duplicate event IDs are ignored, older record events do not replace a newer state, and failed persistence rolls back the attempted billing write. Only one paid plan identifier (`studio-build`) is modeled until commercial plans are finalized.

No provider-specific checkout, portal, signing secret, email address, fee, or capability is assumed. Choose and configure these after the local experience is approved.

## Project-to-package connection

The project editor links to `/packages?project=<id>#configure`. The package builder loads the owned project, carries through its business name and direction, and explains the connection. A package save verifies project ownership on the server and captures a snapshot containing the project ID, current saved version ID, name, headline, color, description, and original brief. A browser-supplied snapshot is ignored. Later project edits do not rewrite an existing package draft. Revised copies keep the link and capture the current project direction when saved.

## Local account controls

Account Settings exposes name changes, password changes, full owned-data export, and deletion. Password changes and deletion require the current password and use authentication rate limits. A password change rotates the current session and revokes all other sessions for the account. Deletion removes only the current user's local records and revokes their sessions. It has an explicit confirmation dialog and requires typing DELETE. It does not attempt to cancel external subscriptions or modify the existing hosted websites.

## Production work remaining

1. Reconcile this implementation with the existing Studio/main-site source and preserve the existing integrations and products.
2. Decide the public identity model: verified email, email-based recovery, optional social sign-in, production retention/deletion rules, and account linking.
3. Replace the single-process JSON store with transactional persistent storage, migrations, backups, and concurrency control. Add account-scoped quotas and retention limits appropriate for production.
4. Connect a verified billing adapter, hosted checkout/portal, server-side price mappings, subscription lifecycle events, invoice history, and fulfillment states. Add purchase approvals and the relevant return/cancellation terms.
5. Connect an AI model and an isolated build runner with spending/time limits, artifact storage, task state, preview routing, build checks, cancellation, and versioned deployment. Never execute arbitrary generated code in the account API process.
6. Connect print/apparel production only after approval, pricing, shipping, artwork specifications, and checkout are verified. The local catalog is illustrative; existing product listings have not been migrated.
7. Configure verified business contact delivery and staff handling. Package drafts currently stay in the account.
8. Complete production legal copy, operational logging, monitoring, HTTPS, secure cookies, browser accessibility checks, and mobile QA.

No Cloudflare deployment or cloud resource changes were performed or scripted.

## Validation in the authoring environment

Node syntax checks and in-process request/billing tests are available. The environment prevented loopback client sockets (`EACCES`) and its browser bridge could not start. Browser rendering and end-to-end HTTP transport could therefore not be verified here. The standalone visual tour is supplied for review on a normal browser. These infrastructure limits are separate from passing request-handler tests.
