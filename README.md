# 🧾 RestFlow

> Event-Sourced Inventory & Waste Reduction System for Restaurants

RestFlow is a production-grade inventory management system designed to
eliminate Excel chaos in kitchen operations and reduce waste through a
structured, auditable event ledger.

Built first for **Raos kitchen**, designed to evolve into a scalable
SaaS platform.

------------------------------------------------------------------------

# 🎯 Mission

Replace spreadsheet-based stock tracking with:

-   Immutable event ledger
-   Real-time projections
-   Waste accountability
-   Expiry monitoring
-   Concurrency-safe architecture
-   Future SaaS readiness

------------------------------------------------------------------------

# 🏗 Architecture Overview

RestFlow v1 uses:

-   **Event Sourcing**
-   **Projection-based read models**
-   **PostgreSQL advisory locks**
-   **Idempotent write operations**
-   **Vertical slice architecture**

### Core Principle

> Inventory is never updated directly.\
> All changes are appended as events.

------------------------------------------------------------------------

# 🧱 Tech Stack

## Backend

-   NestJS
-   Prisma ORM
-   PostgreSQL
-   Zod validation
-   pnpm
-   Turborepo

## Infrastructure (Planned)

-   DigitalOcean (Droplet / App Platform)
-   Managed PostgreSQL
-   S3-compatible storage (Spaces)
-   WhatsApp Business API (alerts)

## Mobile (Planned)

-   Expo
-   React Native
-   Offline-first sync

------------------------------------------------------------------------
    
# 📂 Project Structure
```
restflow/
│
├── apps/
│   │
│   ├── api/                          # NestJS Backend (Core System)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   │
│   │   │   ├── config/               # Environment & configuration
│   │   │   ├── prisma/               # Prisma service & DB connection
│   │   │   │
│   │   │   ├── core/                 # Event engine (write model)
│   │   │   │   ├── event-store.service.ts
│   │   │   │   ├── advisory-lock.service.ts
│   │   │   │   └── idempotency.service.ts
│   │   │   │
│   │   │   ├── projections/          # Read models (inventory state)
│   │   │   │   └── projection-engine.service.ts
│   │   │   │
│   │   │   ├── common/               # Shared backend infrastructure
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   ├── pipes/
│   │   │   │   └── decorators/
│   │   │   │
│   │   │   └── modules/              # Feature-based vertical slices
│   │   │       ├── receive/
│   │   │       ├── waste/
│   │   │       ├── production/
│   │   │       ├── pos/
│   │   │       ├── inventory/
│   │   │       ├── auth/
│   │   │       └── admin/
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │
│   │   └── test/
│   │
│   ├── web/                          # Admin Dashboard (Next.js)
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── lib/
│   │   ├── styles/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── mobile/                       # Kitchen App (Expo / React Native)
│       ├── app/
│       ├── components/
│       ├── services/
│       ├── offline/
│       ├── assets/
│       └── package.json
│
├── packages/                         # Shared libraries
│   ├── config/                       # Shared configuration
│   ├── types/                        # Shared TypeScript types
│   ├── ui/                           # Shared UI components (future)
│   └── eslint-config/
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .nvmrc
└── README.md
```
------------------------------------------------------------------------

# 🧠 Core Concepts

## 1️⃣ Event Store

All stock changes are written to the `event` table.

Example event types:

-   RECEIVED
-   USED
-   WASTE
-   PRODUCED
-   ADJUSTED

Events are:

-   Append-only
-   Immutable
-   Fully auditable

------------------------------------------------------------------------

## 2️⃣ Inventory Projection

`inventoryProjection` is a derived read model built from events.

This allows:

-   Fast inventory lookups
-   Expiry tracking
-   Batch-level visibility

------------------------------------------------------------------------

## 3️⃣ Advisory Locks

Uses PostgreSQL `pg_advisory_xact_lock` per shop.

Prevents:

-   Race conditions
-   Double writes
-   Concurrent corruption

------------------------------------------------------------------------

## 4️⃣ Idempotency

Each event requires an `idempotencyKey`.

Prevents:

-   Duplicate mobile sync
-   Double-click submission
-   Retry corruption

------------------------------------------------------------------------

# 🚀 Getting Started

## 1️⃣ Install Node (LTS required)

    >= 20.19.4

## 2️⃣ Install pnpm

``` bash
npm install -g pnpm
```

## 3️⃣ Install dependencies

``` bash
pnpm install
```

## 4️⃣ Setup environment

Create:

    apps/api/.env

Example:

    DATABASE_URL="postgresql://user:password@localhost:5432/restflow"

## 5️⃣ Run migrations

``` bash
pnpm --filter api prisma migrate dev
```

## 6️⃣ Start API

``` bash
pnpm --filter api start:dev
```

------------------------------------------------------------------------

# 📦 First Vertical Slice

The first implemented module is:

> RECEIVE STOCK

Flow:

1.  Receive stock request
2.  Acquire advisory lock
3.  Validate idempotency
4.  Append event
5.  Update projection
6.  Commit transaction

Atomic & concurrency-safe.

------------------------------------------------------------------------

# 🛡 Security Features

-   Role-based access control
-   Shop-scoped guards
-   Zod request validation
-   Global HTTP exception filter
-   Structured logging interceptor

------------------------------------------------------------------------

# 🔄 Failure Scenarios Covered

-   Duplicate request → Blocked
-   Concurrent staff writes → Locked
-   Partial DB failure → Rolled back
-   Projection error → Event not committed

------------------------------------------------------------------------

# 💰 Estimated Infrastructure Cost (Early Stage)

  Component    Estimated Monthly Cost
  ------------ ------------------------
  App Server   \$24--48
  Managed DB   \$15--30
  Storage      \$5--10
  **Total**    \~\$50--90

------------------------------------------------------------------------

# 🗺 Roadmap

## v1 (Raos Deployment)

-   Event ledger
-   Inventory projection
-   Waste tracking
-   Expiry alerts
-   Excel import tool
-   WhatsApp notifications

## v1.1

-   Multi-role auth
-   Reporting dashboard
-   Production logs

## v2

-   Multi-shop support
-   Advanced forecasting
-   Analytics warehouse
-   Supplier scoring

------------------------------------------------------------------------

# 📈 Why Event Sourcing?

Because inventory corruption is expensive.

Benefits:

-   Full audit trail
-   Easy debugging
-   Future analytics capability
-   SaaS scalability
-   Historical reconstruction

------------------------------------------------------------------------

# 👤 Authors


- Michael Eldondo
  Founder | Product Vision & Operations  
  Identifying operational inefficiencies and turning them into scalable solutions.
- Simon Keya  
  Founding Engineer | Systems Architecture, Design & Development
  Building scalable, operationally correct systems.
------------------------------------------------------------------------

# 📜 License

MIT

------------------------------------------------------------------------

# 🧠 Final Philosophy

RestFlow is built with discipline:

-   Vertical slices
-   Production-safe patterns
-   Concurrency-first design
-   Scope control

Ship to one kitchen.\
Measure waste reduction.\
Then scale.
