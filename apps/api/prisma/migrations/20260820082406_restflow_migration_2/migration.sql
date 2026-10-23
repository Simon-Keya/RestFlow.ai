-- AlterTable
ALTER TABLE "InventoryProjection" ADD COLUMN     "last_counted_at" TIMESTAMP(3),
ADD COLUMN     "last_counted_qty" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "VarianceBatch" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "product_item_id" TEXT,
    "product_name" TEXT,
    "source" TEXT NOT NULL,
    "expected_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "value_affected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "reason_code" TEXT,
    "reason_note" TEXT,
    "lines" JSONB,
    "production_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VarianceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VarianceBatch_batch_id_key" ON "VarianceBatch"("batch_id");

-- CreateIndex
CREATE INDEX "VarianceBatch_shop_id_flagged_idx" ON "VarianceBatch"("shop_id", "flagged");

-- CreateIndex
CREATE INDEX "VarianceBatch_shop_id_created_at_idx" ON "VarianceBatch"("shop_id", "created_at");
