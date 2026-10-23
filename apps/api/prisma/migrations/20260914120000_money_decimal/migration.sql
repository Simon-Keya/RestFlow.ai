-- Monetary columns to DECIMAL(18,4); quantities stay float
ALTER TABLE "Event"
  ALTER COLUMN "unit_cost" TYPE DECIMAL(18,4) USING ROUND(("unit_cost")::numeric, 4),
  ALTER COLUMN "total_cost" TYPE DECIMAL(18,4) USING ROUND(("total_cost")::numeric, 4);
ALTER TABLE "RecipeIngredient"
  ALTER COLUMN "unit_cost" TYPE DECIMAL(18,4) USING ROUND(("unit_cost")::numeric, 4);
ALTER TABLE "InventoryProjection"
  ALTER COLUMN "total_value" TYPE DECIMAL(18,4) USING ROUND(("total_value")::numeric, 4);
ALTER TABLE "VarianceBatch"
  ALTER COLUMN "value_affected" TYPE DECIMAL(18,4) USING ROUND(("value_affected")::numeric, 4);
ALTER TABLE "WasteProjection"
  ALTER COLUMN "total_value" TYPE DECIMAL(18,4) USING ROUND(("total_value")::numeric, 4);
ALTER TABLE "SalesProjection"
  ALTER COLUMN "total_sales" TYPE DECIMAL(18,4) USING ROUND(("total_sales")::numeric, 4),
  ALTER COLUMN "avg_order_value" TYPE DECIMAL(18,4) USING ROUND(("avg_order_value")::numeric, 4);
