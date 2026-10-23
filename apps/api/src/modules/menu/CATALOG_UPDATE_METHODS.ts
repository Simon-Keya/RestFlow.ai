/**
 * Merge into CatalogMenuItemService — ADMIN-only updates for existing items.
 * Call from: PATCH /menu/catalog-items/:menuItemId
 */
/*
  async update(
    shopId: string,
    menuItemId: string,
    dto: {
      name?: string;
      selling_price?: number;
      active?: boolean;
      recipe_id?: string | null;
      stock_item_id?: string | null;
      production_type?: 'recipe' | 'stocked';
    },
    actorUserId: string,
  ) {
    const existing = await this.prisma.catalogMenuItem.findFirst({
      where: { shop_id: shopId, menu_item_id: menuItemId },
    });
    if (!existing) {
      throw new NotFoundException(`Catalog item not found: ${menuItemId}`);
    }

    const name =
      dto.name !== undefined ? String(dto.name).trim() : existing.name;
    if (!name) throw new BadRequestException('Name is required');

    const price =
      dto.selling_price !== undefined
        ? toMoneyNumber(dto.selling_price)
        : Number(existing.selling_price);

    const active =
      dto.active !== undefined ? dto.active : existing.active;

    const productionType = (dto.production_type ??
      existing.production_type) as MenuProductionType;

    const recipeId =
      dto.recipe_id !== undefined
        ? dto.recipe_id
        : existing.recipe_id;
    const stockItemId =
      dto.stock_item_id !== undefined
        ? dto.stock_item_id
        : existing.stock_item_id;

    await this.eventStore.appendEvent({
      event_type: 'menu_item_updated',
      actor_user_id: actorUserId,
      idempotency_key: `catalog-menu-item-update-${shopId}-${menuItemId}-${Date.now()}`,
      item_id: menuItemId,
      total_cost: price,
      payload: {
        menu_item_id: menuItemId,
        name,
        selling_price: price,
        active,
        production_type: productionType,
        recipe_id: recipeId,
        stock_item_id: stockItemId,
        shop_id: shopId,
        previous_name: existing.name,
        previous_price: Number(existing.selling_price),
        previous_active: existing.active,
      },
    });

    const row = await this.prisma.catalogMenuItem.update({
      where: { id: existing.id },
      data: {
        name,
        selling_price: new Prisma.Decimal(price),
        active,
        production_type: productionType,
        recipe_id: productionType === 'recipe' ? recipeId : null,
        stock_item_id: productionType === 'stocked' ? stockItemId : null,
      },
    });

    // Keep projection label in sync when present
    await this.prisma.menuCatalogProjection.updateMany({
      where: { shop_id: shopId, menu_id: menuItemId },
      data: { name, active },
    });

    return {
      success: true,
      menuItemId: row.menu_item_id,
      name: row.name,
      sellingPrice: Number(row.selling_price),
      active: row.active,
    };
  }
*/
