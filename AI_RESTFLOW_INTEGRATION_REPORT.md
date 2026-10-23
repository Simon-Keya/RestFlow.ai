# AI Operations Assistant × RestFlow Integration Report

**Date:** 2026-10-23  
**Baseline:** RestFlow-main (4)-3.zip (authoritative application)  
**AI source:** RestFlow-AI-Operations-Assistant-All-ReadOnly-Phases.zip  

## Summary

The latest RestFlow application is the source of truth for NestJS, web, mobile, Prisma, and business logic. The AI Operations Assistant (FastAPI read-only tools + web UI) was **merged into** that baseline without overwriting RestFlow features.

## What was added (from AI codebase)

| Path | Purpose |
|------|---------|
| `services/ai-assistant/` | FastAPI service, OpenAI tools, Dockerfile, tests, `.env.example` |
| `apps/web/src/features/assistant/` | Client API + Operations Assistant page |
| `apps/web/src/app/(dashboard)/shop/[shopId]/dashboard/assistant/page.tsx` | Route |
| `apps/web/src/lib/routes.ts` | `routes.assistant` |
| `apps/web/src/lib/permissions.ts` | Section `assistant` for ADMIN/MANAGER/KITCHEN/POS |
| `apps/web/src/components/layout/AppSidebar.tsx` | Nav item "AI Assistant" |

## RestFlow features preserved

- All Nest modules, Prisma schema, inventory/batch logic, menu, POS, waste, production, approvals, trace, team rules (ADMIN-only team; ADMIN-only menu/recipe write).
- No Prisma migrations or Nest business-logic changes for AI.
- Assistant calls Nest with the **user bearer token**; Nest remains system of record.

## AI tools (read-only) and Nest contracts checked

| Tool | Nest path (as coded) | Notes |
|------|----------------------|--------|
| get_low_stock_items | GET /inventory/alerts | Present on InventoryController |
| get_inventory_summary | GET /inventory/summary | Present |
| get_expiry_alerts | GET /inventory/expiry-alerts | Present |
| get_inventory_movements | GET /inventory/:itemId/movements | Present |
| get_sku_cost / recipe tools | Recipe/inventory endpoints | As implemented in main.py |
| get_waste_analytics | GET /waste/analytics | Depends on waste module |
| get_trace | GET /trace | Depends on trace module |
| get_pending_approvals | GET /approvals/pending | Depends on approvals module |
| get_dashboard_summary / kpis | GET /dashboard/summary, /dashboard/kpis | Depends on dashboard module |

Shop ID is validated on the assistant; data access is enforced by Nest guards with the forwarded JWT.

## Security

- No direct DB access from the assistant.
- Role allow-list: ADMIN, MANAGER, KITCHEN, POS (matches tool policy in main.py).
- Rate limit, concurrency semaphore, max tool calls, timeouts configured via env.
- Secrets: only `.env.example` placeholders; no real `.env` packaged.

## Tests actually run

```
cd services/ai-assistant
pip install -r requirements.txt
python -m pytest tests/ -q
→ 28 passed, 1 warning (0.54s)
```

```
python3 -m py_compile app/main.py  → OK
```

**Not run in this environment:** NestJS full suite, Next.js production build, live OpenAI calls, Docker image build (optional locally).

## Known limitations / follow-ups

1. Confirm dashboard/trace/approvals/waste analytics paths match production Nest route prefixes if custom global prefixes exist (`/api` etc.) — assistant uses `RESTFLOW_API_URL` root.
2. Mobile app: no AI assistant UI integrated (web only).
3. Docker Compose: AI service has Dockerfile; compose service may need to be added manually if not present in baseline compose.
4. Staging smoke: login → open AI Assistant → ask low-stock with real token against staging API.

## Environment

**AI service (`.env`):**

- `RESTFLOW_API_URL` — Nest base URL  
- `OPENAI_API_KEY`  
- `OPENAI_MODEL` (default gpt-4.1-mini)  
- `REQUEST_TIMEOUT_SECONDS`, `MAX_TOOL_CALLS`, `MAX_REQUESTS_PER_MINUTE`, `MAX_CONCURRENT_REQUESTS`

**Web:**

- `NEXT_PUBLIC_AI_ASSISTANT_URL` (default `http://localhost:8001`)
