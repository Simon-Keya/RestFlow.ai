-- Additive batch movement ledger and production input trace. No existing stock is changed.
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT NOT NULL,
  "shop_id" TEXT NOT NULL DEFAULT '1',
  "batch_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "movement_type" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "user_id" TEXT,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryMovement_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryMovement_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovement_idempotency_key_key" ON "InventoryMovement"("idempotency_key");
CREATE INDEX IF NOT EXISTS "InventoryMovement_shop_id_item_id_created_at_idx" ON "InventoryMovement"("shop_id", "item_id", "created_at");
CREATE INDEX IF NOT EXISTS "InventoryMovement_shop_id_batch_id_created_at_idx" ON "InventoryMovement"("shop_id", "batch_id", "created_at");
CREATE INDEX IF NOT EXISTS "InventoryMovement_reference_type_reference_id_idx" ON "InventoryMovement"("reference_type", "reference_id");

CREATE TABLE IF NOT EXISTS "ProductionInput" (
  "id" TEXT NOT NULL,
  "shop_id" TEXT NOT NULL DEFAULT '1',
  "production_id" TEXT NOT NULL,
  "production_event_id" TEXT,
  "input_batch_id" TEXT NOT NULL,
  "input_item_id" TEXT NOT NULL,
  "output_item_id" TEXT,
  "output_batch_id" TEXT,
  "qty_used" DOUBLE PRECISION NOT NULL,
  "unit_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionInput_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionInput_production_id_input_batch_id_input_item_id_key" ON "ProductionInput"("production_id", "input_batch_id", "input_item_id");
CREATE INDEX IF NOT EXISTS "ProductionInput_shop_id_production_id_idx" ON "ProductionInput"("shop_id", "production_id");
CREATE INDEX IF NOT EXISTS "ProductionInput_shop_id_input_batch_id_idx" ON "ProductionInput"("shop_id", "input_batch_id");
CREATE INDEX IF NOT EXISTS "ProductionInput_production_event_id_idx" ON "ProductionInput"("production_event_id");

-- Enforce append-only movement history at the database boundary.
CREATE OR REPLACE FUNCTION reject_inventory_movement_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'InventoryMovement is append-only; insert a reversal or adjustment movement instead';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "InventoryMovement_append_only" ON "InventoryMovement";
CREATE TRIGGER "InventoryMovement_append_only"
BEFORE UPDATE OR DELETE ON "InventoryMovement"
FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();
