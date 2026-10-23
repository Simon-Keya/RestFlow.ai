CREATE TABLE IF NOT EXISTS "MenuCatalogProjection" (
  "id" TEXT NOT NULL,
  "shop_id" TEXT NOT NULL DEFAULT '1',
  "menu_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuCatalogProjection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MenuCatalogProjection_shop_id_menu_id_key"
  ON "MenuCatalogProjection" ("shop_id", "menu_id");
CREATE INDEX IF NOT EXISTS "MenuCatalogProjection_shop_id_active_idx"
  ON "MenuCatalogProjection" ("shop_id", "active");
