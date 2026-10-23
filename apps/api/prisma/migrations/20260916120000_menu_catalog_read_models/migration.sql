-- CreateEnum
CREATE TYPE "MenuProductionType" AS ENUM ('recipe', 'stocked');

-- CreateTable
CREATE TABLE "CatalogMenuItem" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "name" TEXT NOT NULL,
    "production_type" "MenuProductionType" NOT NULL,
    "recipe_id" TEXT,
    "stock_item_id" TEXT,
    "selling_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuCategoryItem" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,

    CONSTRAINT "MenuCategoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Combo" (
    "id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "name" TEXT NOT NULL,
    "selling_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComboSelectionGroup" (
    "id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,
    "group_index" INTEGER NOT NULL,
    "menu_category_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ComboSelectionGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogMenuItem_shop_id_menu_item_id_key" ON "CatalogMenuItem"("shop_id", "menu_item_id");
CREATE INDEX "CatalogMenuItem_shop_id_active_idx" ON "CatalogMenuItem"("shop_id", "active");
CREATE INDEX "CatalogMenuItem_production_type_idx" ON "CatalogMenuItem"("production_type");

CREATE UNIQUE INDEX "MenuCategory_shop_id_category_id_key" ON "MenuCategory"("shop_id", "category_id");
CREATE INDEX "MenuCategory_shop_id_active_idx" ON "MenuCategory"("shop_id", "active");

CREATE UNIQUE INDEX "MenuCategoryItem_category_id_menu_item_id_key" ON "MenuCategoryItem"("category_id", "menu_item_id");
CREATE INDEX "MenuCategoryItem_menu_item_id_idx" ON "MenuCategoryItem"("menu_item_id");

CREATE UNIQUE INDEX "Combo_shop_id_combo_id_key" ON "Combo"("shop_id", "combo_id");
CREATE INDEX "Combo_shop_id_active_idx" ON "Combo"("shop_id", "active");

CREATE UNIQUE INDEX "ComboSelectionGroup_combo_id_group_index_key" ON "ComboSelectionGroup"("combo_id", "group_index");
CREATE INDEX "ComboSelectionGroup_menu_category_id_idx" ON "ComboSelectionGroup"("menu_category_id");

ALTER TABLE "MenuCategoryItem" ADD CONSTRAINT "MenuCategoryItem_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuCategoryItem" ADD CONSTRAINT "MenuCategoryItem_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "CatalogMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComboSelectionGroup" ADD CONSTRAINT "ComboSelectionGroup_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "Combo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComboSelectionGroup" ADD CONSTRAINT "ComboSelectionGroup_menu_category_id_fkey" FOREIGN KEY ("menu_category_id") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
