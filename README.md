# Pricingblock · MVP1

One pricing block. Every customer gets their own package.

A working MVP of [the product vision](docs/MVP1.md), built with React, TypeScript, Vite, and a Node.js API backed by SQLite. It replaces traditional plan cards with a searchable, customizable feature catalog.

## What works

- Owner account registration, sign-in, and sign-out with hashed passwords and HTTP-only sessions.
- Multiple projects, categories, and feature create/edit/delete/activate/deactivate controls.
- Fixed monthly, one-time, and per-unit monthly pricing, stored and calculated in integer cents (USD).
- Required features that customers cannot remove; configurable quantity limits.
- Search, category filters, checkboxes, quantity controls, live itemized totals, and final package capture.
- Owner preview excluded from session analytics.
- Embedding via a custom element and isolated iframe, with a verified cross-origin configuration event.
- Basic analytics: pricing sessions, selected/removed features, average monthly and one-time values, captured packages.
- Optional HTTPS checkout/next-step link carrying project and configuration references.
- Explainable rule-based feature suggestions using customer goals, owner descriptions, and selected categories. Suggestions never add paid features without approval.

**AI provider integration is deferred by choice.** Suggestions are explicitly labeled rule-based. This MVP does not charge customers, provision feature entitlements, verify email addresses, or implement password reset. Account recovery and a production AI connection are future additions, not simulated capabilities.

## Run locally

Requires **Node.js 24** (pinned in `.nvmrc`); this uses Node's built-in SQLite module.

```sh
npm ci
npm run dev
```

The development command starts the API on port 3001 and Vite on port 5173. Vite proxies `/api` to the API. The dashboard and customer-facing embed are served by Vite; the API maintains durable data at `data/pricing.sqlite`. Register your own account, create a project, and optionally start with editable sample features.

For a production-style local run:

```sh
npm run build
npm start
```

The Node server serves both the built app and API on port 3001. Open the dashboard at that server's origin. No secret or external service is needed for the current MVP.

## Validate

```sh
npm test
npm run build
npm run test:browser
```

The Node tests cover pricing arithmetic, required/hidden features, quantities, authentication, authorization, catalog changes, captured snapshots, and analytics. Browser tests cover owner setup and feature management, search/filter controls, customer quantities, suggestions requiring approval, final capture, the custom element on a separate origin, and mobile layout.

Browser tests use `/usr/bin/chromium` if available, or set `CHROMIUM_PATH` to an existing Chromium executable. Otherwise install Playwright's browser with `npx playwright install chromium`. Tests use isolated temporary SQLite databases and do not modify your development data. Run the build before the browser suite.

## Embed your project

Deploy the application first, then copy the snippet from the owner's Integration tab:

```html
<script src="https://your-pricing-host.example/pricing.js" defer></script>
<smart-pricing project="your-project-id"></smart-pricing>
```

The loader creates an iframe with the pricing UI. It accepts configuration messages only from that frame and the pricing server's exact origin. In your host page:

```js
document.querySelector('smart-pricing').addEventListener('configuration', (event) => {
  const { projectId, configurationId, summary } = event.detail;
  // Pass the reference to your application's next step.
});
```

The browser event includes the itemized package, monthly total, one-time total, and first-payment total. `Continue` stores a server-calculated price snapshot first. Owners can inspect captured configurations from Analytics or retrieve the latest 100 via the authenticated `GET /api/projects/:id/configurations` endpoint. A configured checkout URL opens only after capture and receives `configurationId` and `projectId` as query parameters.

A payment integration must verify the reference using trusted server-side data, not browser-submitted prices or event payloads. This MVP deliberately has no payment-provider integration or public unauthenticated lookup of final customer configurations.

## Runtime configuration

| Variable        | Default                     | Purpose                                                      |
| --------------- | --------------------------- | ------------------------------------------------------------ |
| `PORT`          | `3001`                      | API and production web server port                           |
| `DATABASE_PATH` | `data/pricing.sqlite`       | SQLite database location                                     |
| `APP_ORIGIN`    | Request host with `http://` | Exact browser origin allowed for state-changing API requests |
| `COOKIE_SECURE` | Unset / false               | Set to `true` for HTTPS production session cookies           |
| `CHROMIUM_PATH` | Auto-detected               | Optional executable path for browser tests                   |

For deployment, use Node 24 with a persistent writable disk for SQLite, HTTPS, `APP_ORIGIN` set to your public HTTPS origin, and `COOKIE_SECURE=true`. For example:

```sh
APP_ORIGIN=https://pricing.example.com COOKIE_SECURE=true \
DATABASE_PATH=/persistent/pricing.sqlite npm start
```

Serve the frontend and API from one origin. Do not use a static-only deployment: account storage, package capture, and analytics require the Node server. SQLite is intended for a single API instance; keep backups and do not run replicas against separate local databases. The lightweight rate limiter is per-process and based on the direct connection IP; adapt it to your hosting proxy before operating at scale.

## Project layout

- `src/`: owner dashboard and customer pricing block.
- `shared/pricing.mjs`: shared integer-cent pricing engine.
- `server/index.mjs`: authenticated owner API, public catalog/session API, SQLite storage, and static serving.
- `public/pricing.js`: custom-element embed loader.
- `tests/`: pricing/API tests and browser workflow checks.
- `docs/MVP1.md`: original product vision.

## MVP boundaries

Monthly recurrence and USD only. One-time charges are shown separately; quantity pricing means customer-selected units, not metered usage. Analytics count live block sessions and selected/removed events, not identified customers. Captured packages retain original prices even if features are subsequently edited or deleted. Advanced AI, scanning, usage tracking, automatic upsells, experimentation, regional pricing, enterprise contracts, and multiple payment providers are intentionally outside MVP1.
