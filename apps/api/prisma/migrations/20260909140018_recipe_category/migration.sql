-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");
