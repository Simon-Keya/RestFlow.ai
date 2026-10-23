# Inventory ↔ Consumption audit

## P0 Root cause — double inventory deduction

`handlePosSale` ran for `pos_sale` **and** `order_sent_to_kitchen` (and status/payment events).
Kitchen event re-embeds the same `stock_deductions` for KDS → inventory deducted twice.

**Fix:** only apply stock deductions when `event.event_type === 'pos_sale'`.

## P0 Consumption double path

`mergeLineDeductions` concatenated line + nested selection deductions → 2× on reports.

**Fix:** primary line deductions win; nested only if primary empty.

File: `apps/api/src/core/projection-engine.service.ts`, `consumption.service.ts`
