# RestFlow — Web Ops Console

Internal dashboard for shop managers and admins: inventory, kitchen production, POS orders,
waste, consumption analytics, variance review, approvals, and full event trace — reading from
the RestFlow NestJS event-sourced API.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at your running API
pnpm dev
```

Open http://localhost:3001 (or whatever port your monorepo assigns this app).

## Structure

- `src/app` — Next.js App Router routes only. Route files stay thin and delegate to `src/features/*`.
- `src/features/<domain>` — one folder per business domain (`inventory`, `kitchen`, `pos`, `waste`,
  `consumption`, `variance`, `approvals`, `trace`, `dashboard`, `auth`). Each owns its API calls,
  Zod schemas, types, React Query hooks, and page-level components.
- `src/components/ui` — small, unopinionated primitives (Button, Card, Table, Modal, ...).
- `src/components/layout` — the dashboard shell: sidebar, topbar, role gating.
- `src/lib` — API client, auth/session helpers, KPI formulas, formatting, route/permission constants.
- `src/store` — Zustand stores (auth session, UI state like sidebar collapse).

## Auth model

The API issues a JWT (`access_token`) on `POST /auth/login`. It's kept in memory + a secure,
httpOnly-equivalent cookie set via `src/app/(auth)/login` server action, and role-based access
is enforced both in `middleware.ts` (route-level) and `RoleGate` (component-level).
