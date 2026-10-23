# RestFlow AI Operations Assistant

A separate, read-only Python/FastAPI orchestration service integrated with the existing RestFlow web application. The assistant calls existing NestJS endpoints with the signed-in user's bearer token. NestJS remains the source of truth for shop access, role enforcement, stock rules, costing, recipes, production records, waste, Trace, approvals, and reporting.

## Architecture

```text
RestFlow web (shop-scoped Assistant page)
  | user's Bearer JWT; no model API key in browser
  v
Python FastAPI (/v1/assistant/chat)
  | validates session with /users/me, applies role-specific tool allowlist
  | OpenAI Responses API function calling; bounded tool execution
  v
Existing NestJS API (same user's JWT)
  | CurrentShop / ShopScopeGuard / RolesGuard
  v
Existing NestJS services -> existing database and projections
```

The AI service has no database connection, no unrestricted HTTP tool, no shell/code execution, and no operational write tools. Retrieved records are treated as untrusted text. Tool outputs are size-bounded before being sent to the model.

## Capability phases included in this build

1. **Assistant foundation:** authenticated chat, structured response, UI, safe errors, health/readiness, per-user process-local rate limit and concurrency cap.
2. **Inventory operations:** low-stock alerts, shop-wide inventory summary, expiry/near-expiry batches, and stock movement history.
3. **Costing and recipe context:** read existing SKU weighted-average cost, recipe details, and recipe availability from NestJS; no formulas are recreated in Python.
4. **Waste and reporting:** existing waste analytics, dashboard summary/KPIs, and read-only pending approvals (manager/admin only).
5. **Trace and production investigation:** scoped Trace search (manager/admin) and production trace lookup (kitchen/manager/admin) using existing API contracts.
6. **Security and operations:** role-specific tool exposure, strict argument checks, date validation, output limits, structured low-content logs, and low-cardinality `/metrics` counters.

### Existing backend limitations kept visible

- `GET /production/history` currently returns an empty stub in this repository, so the assistant does not expose it as production history.
- The assistant does not perform inventory adjustments, receiving, waste recording/write-off, production start/finish, approval/rejection, or any other write. The current approval detail/decision controller methods do not visibly apply `CurrentShop` scope in the inspected code, so they are intentionally not called by the assistant. Do not add action tools until a narrowly scoped, server-validated, confirmation-based action contract is designed and tested.
- Costing/recipe responses are displayed as the existing NestJS output. The AI must not recompute, reinterpret, or replace authoritative formulas.
- The process-local rate limit and metrics reset on restart and are not shared between replicas. Use a shared limiter/metrics backend only if staging scale requires it.

## Local setup

From `services/ai-assistant` in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `OPENAI_API_KEY` in `.env`, point `RESTFLOW_API_URL` at your running NestJS API, and set `CORS_ORIGINS` to the exact web origin. Never commit `.env` or expose the OpenAI key in any `NEXT_PUBLIC_*` variable.

Run the API:

```powershell
uvicorn app.main:app --reload --port 8001
```

Run tests:

```powershell
python -m pytest -q
```

Set `NEXT_PUBLIC_AI_ASSISTANT_URL=http://localhost:8001` in the web environment and use the existing web development command. Open `/shop/<shopId>/dashboard/assistant` or select **AI Assistant** in the sidebar.

## Endpoints

- `GET /health` — process liveness; does not require provider configuration.
- `GET /ready` — readiness; returns 503 when `OPENAI_API_KEY` is absent.
- `GET /metrics` — process-local counters only; no prompts, user IDs, or operational records.
- `POST /v1/assistant/chat` — requires `Authorization: Bearer <RestFlow JWT>` and JSON `{ "message": "...", "shop_id": "..." }`.

Example request:

```http
POST /v1/assistant/chat
Authorization: Bearer <RESTFLOW_JWT>
Content-Type: application/json

{"message":"Which items are running low?","shop_id":"1"}
```

The response contains `answer`, `evidence` (low-stock evidence when applicable), `tool_results` (tool name, NestJS source endpoint and bounded data), `tool_used`, `suggested_questions`, and `limitations`.

## Environment variables

See `.env.example`. Configure at minimum `OPENAI_API_KEY`, `RESTFLOW_API_URL`, `CORS_ORIGINS`, and `OPENAI_MODEL`. Timeout, maximum tool calls, request rate, and concurrency are bounded by the service.

## Staging verification checklist

1. Start the existing RestFlow NestJS and web applications; start FastAPI on port 8001.
2. Sign in as each role and open the Assistant from a shop route.
3. Check low-stock and expiry answers against the existing Inventory screen.
4. Check a known SKU cost and recipe availability against the existing costing/recipe UI; do not compare against a newly implemented formula.
5. Check waste analytics and dashboard KPIs as manager/admin only.
6. Search Trace for a known item or batch as manager/admin; check production trace with a real production ID as kitchen/manager/admin.
7. Attempt to use a different shop ID with a non-admin account and verify NestJS rejects cross-shop access according to the existing `ShopScopeGuard` policy.
8. Verify no write actions are exposed; inspect `/metrics`; confirm logs contain no prompt or credential contents.
9. Run the complete web typecheck and production build after dependencies are fully installed.
10. Keep this as staging until live provider, API, and wrong-shop checks pass. Do not deploy to production from this handover.
