# Web POS fixes (Michael 3 Oct 2026)

## Lint / build
- `use-pos-dashboard.ts`: no `any` — typed `BootstrapMenuRow` + `MenuAvailability`.

## A — Multi Inventory Select
- Full Need on select; single-option auto-fill.

## B — Short dialog
- Dedupe `componentKey`; FIXED summarized; Inventory Select only.

## D — Payment
- Paid → badge (not Mark unpaid).

Deploy `apps/web` to Netlify. Pair with Go deduction-chain zip.
