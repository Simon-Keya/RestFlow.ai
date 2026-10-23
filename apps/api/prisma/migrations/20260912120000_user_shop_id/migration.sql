-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shop_id" TEXT NOT NULL DEFAULT '1';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_shop_id_idx" ON "users"("shop_id");
