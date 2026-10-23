-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'KITCHEN', 'POS', 'ADMIN');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "actor_user_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "item_id" TEXT,
    "batch_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION,
    "unit_cost" DOUBLE PRECISION,
    "total_cost" DOUBLE PRECISION,
    "supplier_id" TEXT,
    "approved_by_id" TEXT,
    "waste_reason" TEXT,
    "waste_photo_url" TEXT,
    "payload" JSON NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "min_stock" DOUBLE PRECISION DEFAULT 0,
    "reorder_point" DOUBLE PRECISION DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "supplier_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'KITCHEN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "recipe_code" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "standard_yield" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "raw_item_id" TEXT NOT NULL,
    "raw_item_name" TEXT NOT NULL,
    "quantity_per_unit" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_cost" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProjection" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "item_id" TEXT NOT NULL,
    "available_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expired_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "damaged_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "days_to_expiry_min" INTEGER,
    "last_received_at" TIMESTAMP(3),
    "next_expiry_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteProjection" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "item_id" TEXT NOT NULL,
    "total_wasted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason_summary" JSONB,
    "last_wasted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesProjection" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL DEFAULT '1',
    "period" TEXT NOT NULL,
    "total_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "avg_order_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "top_items" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionLog" (
    "id" TEXT NOT NULL,
    "projection_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_idempotency_key_key" ON "Event"("idempotency_key");

-- CreateIndex
CREATE INDEX "Event_event_type_idx" ON "Event"("event_type");

-- CreateIndex
CREATE INDEX "Event_shop_id_event_type_idx" ON "Event"("shop_id", "event_type");

-- CreateIndex
CREATE INDEX "Event_shop_id_item_id_idx" ON "Event"("shop_id", "item_id");

-- CreateIndex
CREATE INDEX "Event_created_at_idx" ON "Event"("created_at");

-- CreateIndex
CREATE INDEX "Event_idempotency_key_idx" ON "Event"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "Item_item_id_key" ON "Item"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplier_number_key" ON "Supplier"("supplier_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_recipe_code_key" ON "Recipe"("recipe_code");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipe_id_raw_item_id_key" ON "RecipeIngredient"("recipe_id", "raw_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProjection_shop_id_item_id_key" ON "InventoryProjection"("shop_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "WasteProjection_shop_id_item_id_key" ON "WasteProjection"("shop_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProjection_shop_id_period_key" ON "SalesProjection"("shop_id", "period");

-- CreateIndex
CREATE INDEX "ProjectionLog_projection_type_idx" ON "ProjectionLog"("projection_type");

-- CreateIndex
CREATE INDEX "ProjectionLog_processed_at_idx" ON "ProjectionLog"("processed_at");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_raw_item_id_fkey" FOREIGN KEY ("raw_item_id") REFERENCES "Item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProjection" ADD CONSTRAINT "InventoryProjection_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
