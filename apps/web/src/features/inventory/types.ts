// apps/web/src/features/inventory/types.ts
export type {
  InventoryItem,
  InventoryBatch,
  StockStatus,
} from "@/types/inventory";
export { stockStatusFor, expiredUnitsFor } from "@/types/inventory";