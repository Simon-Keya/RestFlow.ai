-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('SINGLE_OUTPUT', 'PORTION_OUTPUT', 'MULTI_OUTPUT', 'ASSEMBLY', 'CONVERSION', 'CO_PRODUCT', 'SUB_RECIPE');

-- CreateEnum
CREATE TYPE "YieldBasis" AS ENUM ('BATCH', 'UNIT');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recipe_type" "RecipeType" NOT NULL DEFAULT 'SINGLE_OUTPUT',
ADD COLUMN     "yield_basis" "YieldBasis" NOT NULL DEFAULT 'BATCH',
ADD COLUMN     "yield_quantity" DOUBLE PRECISION,
ADD COLUMN     "yield_unit" TEXT;

-- CreateTable
CREATE TABLE "RecipeOutput" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT,
    "standard_quantity" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "unit_weight" DOUBLE PRECISION,
    "weight_unit" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeOutput_recipe_id_idx" ON "RecipeOutput"("recipe_id");

-- CreateIndex
CREATE INDEX "RecipeOutput_item_id_idx" ON "RecipeOutput"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeOutput_recipe_id_item_id_key" ON "RecipeOutput"("recipe_id", "item_id");

-- AddForeignKey
ALTER TABLE "RecipeOutput" ADD CONSTRAINT "RecipeOutput_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeOutput" ADD CONSTRAINT "RecipeOutput_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
