# Pricing page starter

A responsive pricing page built with React, TypeScript, and Vite. Includes monthly/yearly billing controls, three plans, accessible selection feedback, and an FAQ.

The Forma branding and USD prices are sample content. Plan selection shows a demo message; authentication, subscriptions, and checkout are not connected.

## Development

Use Node.js 22.12+ (or Node.js 24) and npm.

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

## Validate and build

```sh
npm run build
npm run preview -- --host 0.0.0.0
```

The build runs TypeScript checking and writes the production site to `dist/`. Deploy that directory to a static hosting provider. No environment variables or backend services are required. The optional Google Fonts stylesheet falls back to system fonts when unavailable.
