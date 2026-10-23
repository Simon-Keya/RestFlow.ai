-- CreateIndex
CREATE INDEX "Event_shop_id_event_type_created_at_idx" ON "Event"("shop_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "Event_shop_id_approved_by_id_event_type_idx" ON "Event"("shop_id", "approved_by_id", "event_type");

-- CreateIndex
CREATE INDEX "InventoryProjection_shop_id_available_stock_idx" ON "InventoryProjection"("shop_id", "available_stock");

-- CreateIndex
CREATE INDEX "InventoryProjection_shop_id_days_to_expiry_min_idx" ON "InventoryProjection"("shop_id", "days_to_expiry_min");

-- CreateIndex
CREATE INDEX "Recipe_item_id_idx" ON "Recipe"("item_id");

-- CreateIndex
CREATE INDEX "Recipe_is_active_idx" ON "Recipe"("is_active");

-- CreateIndex
CREATE INDEX "RecipeIngredient_raw_item_id_idx" ON "RecipeIngredient"("raw_item_id");
