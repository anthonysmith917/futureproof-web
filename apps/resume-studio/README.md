# FutureProof Resume Studio

Resume Studio lives under `apps/resume-studio` in the AskFutureProof repository `anthonysmith917/futureproof-web`, with its own Cloudflare Worker at the target `resume.askfutureproof.com`. Existing main-site pages remain at the repository root; this app and its deployment workflow are added alongside them. This project is based on the resume-import, profile-editing, and export workflow developed for NurseReady, expanded for general professions. It contains no NurseReady user records or uploaded credential documents.

## Version 12 — repository and Google sign-in correction

- Job search with real Remotive remote listings, keyword/location/category/type filters, pagination and source links. Any employer's job can also be added manually. Saved jobs support notes, status, resume comparison, application snapshots, browser persistence, backup/restore and conflict-safe account copies.
- Google is the only Resume Studio sign-in provider. Desygn Shop handles checkout through a signed payment bridge. A separate companion portal is included in `integrations/desygnshop-portal/`; the existing main shop and its hosted Site have not been changed. Signed payment notifications unlock the correct Resume Studio account once, independently of the return page.
- Cloudflare custom domain configured for **resume.askfutureproof.com**, with an idempotent deployment script that provisions/reuses D1 and applies migrations. Deployment is currently blocked by missing Cloudflare authentication. No live domain or connected production payments are claimed.

See [the connection and deployment guide](docs/CONNECT-AND-DEPLOY.md) for the exact remaining configuration and current limits.

## What works in the review build

- Free access is limited to one **Traditional basic single-column** format. Imports, checks, local snapshots and Word/HTML/PDF exports remain available. All other templates, layout changes, colors and section placement require a server-confirmed paid pack. The existing $4.99 and $9.99 packs now include template access along with AI credits; template access does not disappear when credits are used. The standalone build stays Free while account and payment services are unconfigured.
- All **15 original NurseReady templates** are included directly from the deployed client code: Traditional, Contemporary, Split column, Photo editorial, Executive, Minimal, Clinical, Academic, Timeline, Monogram, Compact, Leadership, New graduate, Right sidebar, and Photo card. Their catalogue, renderer and print CSS are copied into `src/vendor/nurseready/original-templates.js` without rewriting. The original deployed bundle and SHA-256 provenance are included beside it. Default HTML/PDF output is tested against the original function for every template. Preview documents are isolated in sandboxed frames so AskFutureProof's application styles cannot change the original typography, banner placement, columns, spacing or colors.
- The existing 100 additional FutureProof editions remain below the original collection. These are 20 editorial families × 5 career editions, with 35 single-column, 30 left-sidebar, 25 right-sidebar and 10 balanced split options. They remain distinct from the fifteen exact source templates.
- Live editor for contact details, summary, employment, education, skills, certifications, and projects.
- PDF, DOCX, and TXT import with local extraction and a mandatory review step. Suggestions fill blank fields only. Image-only PDF OCR is not included.
- HTML download using the original renderer, actual `.docx` export, browser print / Save as PDF, plain-text inspection, and workspace JSON backup/restore. HTML and PDF retain original design fidelity; Word provides an editable adaptation. Word export preserves section placement, font, accent, and sidebar colors with actual two-cell layouts for split formats and simplified heading decoration; browser printing provides the closest visual match. Preview is responsive; inspect actual export page breaks before sharing.
- Work history restores inline bullet separators from pasted/imported resumes, renders achievements as hanging-indented lists, and separates role headings from dates. A local Format work history bullets action also restores editable line breaks without using AI or changing claims. HTML/PDF and Word use the same structure. The main preview expands to the document height so longer work histories remain visible. The copied NurseReady renderer remains unchanged; this formatting is applied separately to experience sections containing bullets.
- Section placement controls move any of the six content sections between the physical left and right columns. Choices carry through the preview, Word/PDF, local saves, backups, application snapshots, and cloud design JSON. Single-column exports keep all sections. Reset positions restores the chosen layout’s defaults.
- Photo editorial supports an optional locally processed JPG/PNG/WebP portrait. It is converted to a cropped JPEG and included in that layout’s preview, Word export, and PDF print view. Original NurseReady layouts retain their original optional photo behavior; the additional FutureProof editions support photos in Photo editorial. Stored images travel only when the user explicitly saves or exports the resume; they are excluded from AI requests.
- Eight preset color palettes plus independent custom accent and sidebar color pickers. Sidebar text selects black or white automatically for contrast. Design settings persist in browser saves, cloud resumes, application snapshots, and JSON backups. Old backups without design settings remain supported.
- A separate single-column Word export creates a simpler copy without changing the selected visual design.
- Six published formatting checks, totaling 100 points. Split layouts do not earn the 25 points for simple reading order; low-contrast heading colors also affect the readability check. The score applies to the generated template and entered content, not the original uploaded document. It does not execute or emulate an employer's proprietary parser.
- Separate literal job-description term overlap. Repeating keywords does not earn more credit. This is not a semantic match, qualification assessment, or interview probability.
- Local application snapshots with a saved resume, job description, template, company, role, and status.
- Resume persistence uses “Save on this device.” Saving a job explicitly stores the shortlist, notes and statuses on this browser automatically.

## Implemented server integrations — configuration still required

- Google OpenID Connect sign-in using PKCE, nonce, one-use state, signature/issuer/audience/expiry validation, hashed session tokens, and HttpOnly cookies.
- Optional cloud save, load, and delete of the current resume, scoped to the signed-in user.
- OpenAI Responses API for summary, experience, and project rewrites. Only the selected section and optional job description are sent. Response storage is disabled. Provider retention is subject to its policy; this is not a zero-retention guarantee.
- Server-controlled credits: reserve before AI work, cache completed request IDs, reject conflicting retries, refund confirmed failures, and recover stale reservations with hourly maintenance.
- Stripe Checkout credit packs and a signature-verified webhook. Credits are granted by a verified paid-session event, never by a success-page redirect. Repeated events cannot grant credits twice. Client-supplied prices and credit amounts are not trusted.
- Proposed launch pricing: 10 credits for $4.99 or 30 credits for $9.99, one-time purchases. Summary/projects cost 1 credit, experience 2. These amounts are a review proposal, not an approved commercial launch.

No live sign-in, live payment, or AI-provider transaction was performed. These are implemented integrations, not verified production services. Purchases default to **disabled**. Before public paid access, finalize business terms, privacy/retention policy, refunds/disputes handling, pricing, and end-to-end provider testing. Payment refunds and disputes require an operating procedure; automatic clawback is not included.

## Open the browser review

Open `review/AskFutureProof-Resume-Studio-v12.html` in Chrome or Edge. The top banner must read **ASKFUTUREPROOF RESUME STUDIO — VERSION 12**. The builder includes the separate main site’s header, responsive navigation, full footer, and absolute links to askfutureproof.com. The entire workspace has an explicit light background and uses embedded SVG navigation icons. Resume Studio appears immediately beneath the main header with the account controls; the duplicate sidebar logo and breadcrumb row have been removed. The versioned file uses AskFutureProof’s existing logo, navy (#102B4E), blue (#2E74B5), and Inter/system typography. The versioned file uses a new filename and contains previews of all fifteen original layout cards even if a document viewer blocks JavaScript. Editing requires JavaScript. The older canonical review filename is also updated. The review opens to a **Choose your layout** selector containing all fifteen original templates, with Traditional selected as the only free format. Each card previews a document rendered by the original NurseReady code. The 100-edition gallery remains below the main chooser, with locked paid split templates shown first. Free users can browse designs, but choosing a paid layout opens the upgrade prompt. Selecting a gallery card applies its actual layout even if the previous resume was set to a single column; your colors and resume content are preserved. The standalone file bundles the editor, templates, checks, import libraries, Word export, application workspace and local saved-job tools. Live search requires the deployed Worker. It does not connect accounts, AI, or payments. External fonts are optional; system fonts are used if unavailable. You can regenerate it with `npm run build:review`.

## Run locally

Requires Node.js 24 or newer.

```bash
npm ci
npm run dev
```

The Vite frontend works without accounts. For local Worker APIs:

```bash
npm run build
npx wrangler d1 migrations apply futureproof-resume-studio --local
npx wrangler dev --var APP_URL:http://localhost:8787
```

Use the Wrangler address shown in the terminal (normally `http://localhost:8787`) for server-integrated testing. Vite development alone does not serve the `/api` routes; it keeps the local-only tools usable.

## Repository and deployment

The parent repository is **anthonysmith917/futureproof-web**. This app is in **apps/resume-studio/**; no separate repository is needed. The existing main website stays at the repository root. The root workflow `.github/workflows/resume-studio.yml` verifies and deploys the separate Resume Studio Worker to Cloudflare.

Follow [docs/CONNECT-AND-DEPLOY.md](docs/CONNECT-AND-DEPLOY.md) for the Cloudflare account, Google credentials and exact callback, deployment pipeline, and separate Desygn Shop checkout configuration. Google is the only Resume Studio sign-in provider; Desygn Shop does not authenticate Resume Studio users. The app is not hosted through Sites. An opened review HTML file has local tools only.

### Verification

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

Tests use Node's SQLite engine to exercise the same SQL used by the D1 credit ledger. The automated checks cover templates, real split structures, Word table and color output, plain-text preservation, design persistence and validation, contrast, scoring, import mapping, escaping, ownership, refunds, duplicate requests, duplicate payment events, stale reservations, input bounds, unauthenticated access, and webhook signature rejection.

In this environment, the preview browser could not open `terminal.local` (`ERR_BLOCKED_BY_CLIENT`). Browser layout and real-provider end-to-end verification remain incomplete. The actual standalone HTML has additionally been exercised in a DOM runtime using a file URL: its fifteen-template chooser, original document rendering, HTML download, split-layout selection, and color controls execute without errors, and static layout previews remain visible with scripts disabled. Wrangler has no authenticated Cloudflare account here; no cloud resources or live deployment were created.

## References

- Cloudflare Worker assets: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Resume parsing guidance: https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse
- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- OpenAI Responses: https://developers.openai.com/api/reference/resources/responses/methods/create
- Stripe fulfillment: https://docs.stripe.com/checkout/fulfillment

Future feature candidates: guided achievement interview, linked cover-letter generation, fact-preserving full-resume review, accessible DOCX templates, and optional ATS round-trip extraction of the exported file. These are recommendations, not features represented as complete.
