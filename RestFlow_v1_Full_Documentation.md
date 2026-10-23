# RestFlow v1 -- Full Technical Documentation

## 1. Project Overview

RestFlow is an event-sourced inventory and waste-reduction system
designed for restaurant and kitchen operations. Version 1 (v1) focuses
on a single-shop deployment (Raos kitchen) while keeping the
architecture future-proof for SaaS expansion.

The system replaces Excel-based inventory tracking with:

-   Append-only event ledger
-   Real-time inventory projections
-   Waste tracking with reasons
-   Expiry monitoring
-   Offline-first mobile flows
-   Low-stock and expiry alerts

------------------------------------------------------------------------

## 2. Architecture Philosophy

RestFlow v1 uses:

-   Event Sourcing (append-only events table)
-   Projection-based read models
-   Postgres advisory locks for concurrency safety
-   Idempotency keys to prevent duplicate writes
-   Vertical slice architecture discipline

Design Goals:

-   Prevent inventory race conditions
-   Eliminate silent data overwrites
-   Enable audit trails
-   Keep v1 simple but scalable

------------------------------------------------------------------------

## 3. Tech Stack

Backend: - NestJS - Prisma ORM - PostgreSQL - pnpm + Turborepo (monorepo
ready)

Future-ready components: - S3/Cloudinary (image uploads) - WhatsApp
Business API (alerts) - DigitalOcean (deployment)

------------------------------------------------------------------------

## 4. Core Concepts

### 4.1 Event Store

All inventory changes are written to the `event` table.

Events are immutable and append-only.

Example Event Types: - RECEIVED - USED - WASTE - ADJUSTED - PRODUCED

Each event contains: - shopId - itemId - eventType - quantity -
batchNumber (optional) - expiryDate (optional) - wasteReason (if
applicable) - idempotencyKey - metadata

------------------------------------------------------------------------

### 4.2 Inventory Projection

`inventoryProjection` is a derived read model built from events.

It contains: - shopId - itemId - batchNumber - expiryDate - availableQty

Projections allow fast reads without scanning the entire event table.

------------------------------------------------------------------------

### 4.3 Advisory Locking

To prevent race conditions:

Postgres `pg_advisory_xact_lock` is used per shopId.

This ensures: - No concurrent conflicting inventory writes - Safe
transactional updates

------------------------------------------------------------------------

### 4.4 Idempotency

Each event requires an `idempotencyKey`.

If the same key is used twice: - The second request is rejected -
Duplicate inventory changes are prevented

------------------------------------------------------------------------

## 5. Backend Folder Structure

apps/api/src/

-   app.module.ts
-   main.ts
-   prisma/
    -   prisma.service.ts
-   core/
    -   core.module.ts
    -   event-store.service.ts
    -   advisory-lock.service.ts
    -   idempotency.service.ts
-   projections/
    -   projection-engine.service.ts
-   modules/
    -   receive/
    -   waste/
    -   production/
    -   pos/

------------------------------------------------------------------------

## 6. Core Services

### 6.1 EventStoreService

Responsibilities: - Start DB transaction - Acquire advisory lock -
Validate idempotency - Insert event - Trigger projection update - Commit
transaction

Guarantees: - Atomicity - Consistency - Concurrency safety

------------------------------------------------------------------------

### 6.2 ProjectionEngineService

Responsibilities: - Apply event to inventoryProjection - Increment
quantities - Maintain current stock state

Currently supports: - RECEIVED events

Planned support: - USED - WASTE - PRODUCED

------------------------------------------------------------------------

### 6.3 AdvisoryLockService

Uses Postgres advisory locks per shopId.

Prevents concurrent write conflicts.

------------------------------------------------------------------------

### 6.4 IdempotencyService

Checks uniqueness of: (shopId, idempotencyKey)

Prevents duplicate inserts from: - Network retries - Mobile offline
sync - Double-click errors

------------------------------------------------------------------------

## 7. Database Schema Overview

Tables:

1.  event
2.  inventoryProjection
3.  item
4.  shop

Event Table Characteristics: - Append-only - Indexed by shopId +
itemId - Indexed by idempotencyKey

InventoryProjection: - Unique composite index on: (shopId, itemId,
batchNumber)

------------------------------------------------------------------------

## 8. Operational Flow Example (Receive Stock)

1.  Staff logs received stock.
2.  API receives request with idempotencyKey.
3.  Transaction starts.
4.  Advisory lock acquired.
5.  Idempotency validated.
6.  Event inserted.
7.  Projection updated.
8.  Transaction committed.

Result: - Ledger updated - Inventory reflects new quantity - Fully
auditable

------------------------------------------------------------------------

## 9. Failure Scenarios Covered

1.  Duplicate mobile sync → Blocked by idempotency
2.  Two staff receiving same item simultaneously → Locked via advisory
    lock
3.  Partial failure → Entire transaction rolls back
4.  Projection error → Event not committed

------------------------------------------------------------------------

## 10. Deployment Plan (DigitalOcean)

Production Setup:

-   App Platform or Droplet
-   Managed PostgreSQL
-   Spaces (S3-compatible) for images
-   Backup snapshots enabled
-   Monitoring enabled

------------------------------------------------------------------------

## 11. Cost Estimate (Early Stage)

-   App server: \~\$24--48/month
-   Managed DB: \~\$15--30/month
-   Storage: \~\$5--10/month

Estimated total: \$50--90/month

------------------------------------------------------------------------

## 12. v1 Scope Discipline

Must Have: - Event ledger - Inventory projections - Waste reason
mandatory - Excel import seed tool - WhatsApp text alerts - Rebuild
projections admin tool

Deferred: - Multi-tenant logic - Advanced forecasting - Kafka -
ClickHouse - Supplier analytics

------------------------------------------------------------------------

## 13. Future SaaS Evolution

When scaling:

-   Add multi-shop support
-   Add role-based access control
-   Add event streaming
-   Add analytics warehouse
-   Introduce forecasting models

------------------------------------------------------------------------

## 14. Conclusion

RestFlow v1 is:

-   Architecturally strong
-   Production safe
-   Concurrency aware
-   Future proof
-   Focused on real operational value

The system is intentionally disciplined to: - Reduce waste - Increase
inventory accuracy - Enable scaling to SaaS later

------------------------------------------------------------------------

End of Documentation
