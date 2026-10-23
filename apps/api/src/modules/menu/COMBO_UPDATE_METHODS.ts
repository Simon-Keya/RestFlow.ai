/**
 * Merge into ComboService — ADMIN-only price/name/active fixes.
 * Call from: PATCH /menu/combos/:comboId
 */
/*
  async update(
    shopId: string,
    comboId: string,
    dto: { name?: string; selling_price?: number; active?: boolean },
    actorUserId: string,
  ) {
    const existing = await this.prisma.combo.findFirst({
      where: { shop_id: shopId, combo_id: comboId },
    });
    if (!existing) {
      throw new NotFoundException(`Combo not found: ${comboId}`);
    }

    const name =
      dto.name !== undefined ? String(dto.name).trim() : existing.name;
    const price =
      dto.selling_price !== undefined
        ? toMoneyNumber(dto.selling_price)
        : Number(existing.selling_price);
    const active =
      dto.active !== undefined ? dto.active : existing.active;

    await this.eventStore.appendEvent({
      event_type: 'combo_updated',
      actor_user_id: actorUserId,
      idempotency_key: `combo-update-${shopId}-${comboId}-${Date.now()}`,
      item_id: comboId,
      total_cost: price,
      payload: {
        combo_id: comboId,
        name,
        selling_price: price,
        active,
        shop_id: shopId,
        previous_name: existing.name,
        previous_price: Number(existing.selling_price),
      },
    });

    const row = await this.prisma.combo.update({
      where: { id: existing.id },
      data: {
        name,
        selling_price: new Prisma.Decimal(price),
        active,
      },
    });

    return {
      success: true,
      comboId: row.combo_id,
      name: row.name,
      sellingPrice: Number(row.selling_price),
      active: row.active,
    };
  }
*/
