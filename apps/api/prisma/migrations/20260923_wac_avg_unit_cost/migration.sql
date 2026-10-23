ALTER TABLE "InventoryProjection"
  ADD COLUMN IF NOT EXISTS "avg_unit_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_receipt_unit_cost" DECIMAL(18,6);

UPDATE "InventoryProjection"
SET "avg_unit_cost" = CASE
  WHEN available_stock > 0 AND total_value > 0
  THEN ROUND((total_value / available_stock)::numeric, 6)
  ELSE COALESCE(avg_unit_cost, 0)
END
WHERE COALESCE(avg_unit_cost, 0) = 0
  AND available_stock > 0
  AND total_value > 0;
