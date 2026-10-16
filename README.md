# FutureProof website

Static, responsive website for FutureProof Tech Support and Automations. It is ready for GitHub Pages and does not require a build step.

## Pages

- Home
- Services
- Pricing
- About
- Insights
- Contact

## Publish with GitHub Pages

1. Use `main` as the default branch and keep the website files in the repository root.
2. Open **Settings → Pages** in GitHub.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and the `/(root)` folder, then save.
5. GitHub Pages will publish updates whenever changes are pushed to `main`.

## Contact form

The form works on static hosting by composing an email to `askfutureproof@outlook.com` in the visitor's default mail application. To submit without opening an email app, connect a hosted form endpoint later.

## Resume Studio

Resume Studio is part of this AskFutureProof repository under [`apps/resume-studio`](apps/resume-studio). It has a separate Cloudflare Worker and D1 database, targeting `https://resume.askfutureproof.com`, with **Google sign-in** and Desygn Shop checkout. Main-site pages remain at the repository root.

See the [connection and deployment guide](apps/resume-studio/docs/CONNECT-AND-DEPLOY.md). The [Resume Studio workflow](.github/workflows/resume-studio.yml) runs its checks and deploys from `main` when the required Cloudflare repository secrets are configured.
