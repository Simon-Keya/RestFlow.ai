-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "finished_good_category_id" TEXT;

-- CreateTable
CREATE TABLE "FinishedGoodCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishedGoodCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinishedGoodCategory_code_key" ON "FinishedGoodCategory"("code");

-- CreateIndex
CREATE INDEX "FinishedGoodCategory_is_active_idx" ON "FinishedGoodCategory"("is_active");

-- CreateIndex
CREATE INDEX "Item_finished_good_category_id_idx" ON "Item"("finished_good_category_id");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_finished_good_category_id_fkey" FOREIGN KEY ("finished_good_category_id") REFERENCES "FinishedGoodCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
