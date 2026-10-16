# Version 0.2.0 — Connected projects and account controls

- A Studio project can now start a launch package with its business name and brand direction already connected.
- Saved package briefs retain a server-validated project snapshot and version reference. Later project changes do not alter the saved brief.
- Package history shows the saved brand direction and links back to the project. Revised copies can keep the connection.
- Added Account Settings: profile name, password change, full workspace export, and confirmed local account deletion.
- Password changes rotate the current session and revoke the account's other sessions. Local deletion is isolated to the requesting account.
- The Windows launcher waits until the server is listening before opening the browser.
- The visual design tour includes the new Account Settings layout. Real settings actions require the local server.
- No hosting configuration, deployment, payment collection, or external AI connection was added.

## Verification

Twenty automated request/billing checks passed. Source syntax checks and the standalone-preview structural checks passed. Browser execution remains unverified because no browser engine is installed in the authoring environment; loopback-client restrictions from the earlier review also remain a verification limitation.
