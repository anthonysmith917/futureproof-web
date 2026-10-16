# The Desygn Shop — connected local revamp

This package starts with a revamped AI Studio and connects it to a new Desygn Shop website, launch-package builder, and customer workspace. Nothing in this package deploys to Cloudflare or changes an existing hosted site.

## Quick visual review

Open **Design-Preview.html** in a browser. It is a self-contained tour: use the top review bar to move between AI Studio, the main website, packages, and the account layout. The project editor includes an illustrative starter preview. This tour does not create accounts or save work.

## Run the working local version

1. Use a computer with **Node.js 22 or newer** installed. No npm packages are required.
2. Unzip this entire folder.
3. On Windows, double-click **Start-Desygn-Shop.cmd**. Alternatively, run `node server.mjs` in this folder.
4. Open **http://127.0.0.1:4317**. Create a local review account from Sign in → Create account. Use a test password with at least 12 characters.
5. Keep the terminal open while reviewing. Press Ctrl+C in that terminal to stop the local server.

If the default port is already used, set `DESYGN_PORT` to another port before running `node server.mjs`.

## What works

- Local registration, sign-in, sign-out, password hashing, and server-owned sessions.
- A private customer workspace with ownership checks between accounts.
- Account Settings for profile-name updates, password changes, whole-workspace export, and password-confirmed local account deletion. Password changes revoke other sessions.
- Project briefs and personalized websites generated from four curated starters.
- Editing name, headline, description, sections, brand color, and public contact email.
- Desktop/mobile preview controls, saved snapshots, version restore, and HTML source download.
- Saved brand details that can be applied inside the project editor.
- Launch-package selection, product quantities, saved drafts, draft download, and revised copies.
- Direct project-to-package links that carry business details and a saved brand-direction snapshot into the package brief.
- Plan-interest records that do not activate a subscription or grant paid access.
- Separate workspace areas for projects, brand, packages, plans, orders, and billing.
- A provider-neutral billing receiver module with a required signature-verification adapter, event deduplication, stale-event handling, account matching, and separate subscription/order/invoice tables. It is not exposed over HTTP and is not connected to a payment provider.
- Main website, AI Studio, packages, print/apparel catalog, plans, sign-in, account portal, editor, About, Contact, Privacy, Terms, and Security pages.

## What is intentionally not connected

- Live AI code generation, arbitrary instruction-based editing, isolated build environments, or cloud publishing.
- Social login, email verification, or email-based password recovery.
- Payment collection, real subscription renewals, customer billing portal, tax calculation, or production checkout.
- Order fulfillment, shipping, production-vendor submission, email delivery, or staff notifications.

The UI labels these boundaries. A saved package is a **draft**, not a submitted quote request or an order. A plan preference is **interest**, not a purchase. The website builder is an editable **starter generator**, not a connected AI coding engine.

## Data and privacy

Local records are stored in `data/workspace.json` on the computer running the server. The folder is created at first run and is not included in the delivery archive. Passwords are salted and hashed. Sessions live in memory and end when the server restarts; accounts and saved work persist.

This is a single-computer review server, bound to loopback. It is not a public hosting server. Account Settings can export or remove the current local account and its records; it does not manage any existing live-site account or external subscription. See `docs/IMPLEMENTATION.md` and the in-app Security page for remaining production work. The local Privacy and Terms pages describe this build and require business/legal review before public use.

## Verify

Run `npm test`, or `node --test --test-isolation=none test/*.test.mjs` on recent Node versions. The tests exercise real request handlers in memory, avoiding a network dependency. They cover ownership, authentication boundaries, persistence, versions, drafts, and billing lifecycle handling.

`node export.mjs` creates a static snapshot in `dist/`. Static snapshots do not contain the account API. `node make-preview.mjs` rebuilds the self-contained design tour.

## Existing sites

Existing hosted source could not be retrieved in the authoring workspace. This is a separate implementation for review and later integration. The current AI Studio and main shop remain unchanged. No source synchronization, deployment tools, Cloudflare configuration, or hosting credentials are included.

## Resume Studio payments

Resume Studio uses Google sign-in at its own Cloudflare origin. This companion server handles checkout only. Configure the signed order bridge in `src/resume-connect.mjs` and the required Stripe webhook according to the parent app's `docs/CONNECT-AND-DEPLOY.md`. The shop's own account service remains separate from Resume Studio's Google identity. Paid resume orders appear in the portal's Orders section and unlock only the originating Resume Studio account. No shop subscription is created.
