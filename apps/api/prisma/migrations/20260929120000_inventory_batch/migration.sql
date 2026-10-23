-- CreateTable: InventoryBatch (FEFO lots)
-- Model already in schema.prisma; was missing from migration history.
-- Required for Nest fefo-stock.service + Go FEFO / receive batch writes.

CREATE TABLE IF NOT EXISTS "InventoryBatch" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "item_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "qty_received" DOUBLE PRECISION NOT NULL,
    "qty_remaining" DOUBLE PRECISION NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" TIMESTAMP(3),
    "supplier_id" TEXT,
    "event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryBatch_shop_id_item_id_expiry_date_idx"
  ON "InventoryBatch"("shop_id", "item_id", "expiry_date");

CREATE INDEX IF NOT EXISTS "InventoryBatch_shop_id_item_id_qty_remaining_idx"
  ON "InventoryBatch"("shop_id", "item_id", "qty_remaining");

CREATE INDEX IF NOT EXISTS "InventoryBatch_batch_number_idx"
  ON "InventoryBatch"("batch_number");

-- AddForeignKey (Item.item_id) — skip if already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryBatch_item_id_fkey'
  ) THEN
    ALTER TABLE "InventoryBatch"
      ADD CONSTRAINT "InventoryBatch_item_id_fkey"
      FOREIGN KEY ("item_id") REFERENCES "Item"("item_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
