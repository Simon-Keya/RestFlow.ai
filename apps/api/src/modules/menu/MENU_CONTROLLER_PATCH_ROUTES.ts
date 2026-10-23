/**
 * Add to menu.controller.ts (imports UpdateCatalogItemSchema, UpdateComboSchema,
 * ZodValidationPipe already available).
 *
 * ADMIN only — matches Michael: edit already-created menu data without SQL.
 */

/*
  @Patch('catalog-items/:menuItemId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update catalog menu item (name, price, active)' })
  @UsePipes(new ZodValidationPipe(UpdateCatalogItemSchema))
  async updateCatalogItem(
    @CurrentShop() scopedShop: string,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogMenuItemService.update(
      scopedShop,
      menuItemId,
      dto,
      user.id,
    );
  }

  @Patch('combos/:comboId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update combo (name, price, active)' })
  @UsePipes(new ZodValidationPipe(UpdateComboSchema))
  async updateCombo(
    @CurrentShop() scopedShop: string,
    @Param('comboId') comboId: string,
    @Body() dto: UpdateComboDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comboService.update(scopedShop, comboId, dto, user.id);
  }
*/
