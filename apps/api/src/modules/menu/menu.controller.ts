import { MenuCatalogBackfillService } from '../../core/menu-catalog-backfill.service';
// apps/api/src/modules/menu/menu.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { CreateMenuDto } from './dto/create-menu.dto';
import { CreateMenuSchema } from './dto/create-menu.dto';
import type { MenuItemDto } from './dto/menu-item.dto';
import { MenuItemSchema } from './dto/menu-item.dto';
import type { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { UpdateCatalogItemSchema } from './dto/update-catalog-item.dto';
import type { UpdateComboDto } from './dto/update-combo.dto';
import { UpdateComboSchema } from './dto/update-combo.dto';
import type { AdjustMenuDto } from './dto/adjust-menu.dto';
import { AdjustMenuSchema } from './dto/adjust-menu.dto';
import { MenuService } from './menu.service';
import { SellableResolutionService } from './sellable-resolution.service';
import { MenuCategoryService } from './menu-category.service';
import { ComboService } from './combo.service';
import { CatalogMenuItemService } from './catalog-menu-item.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('menu')
@ApiBearerAuth()
@Controller('menu')
@UseGuards(RolesGuard)
export class MenuController {
  constructor(
    private readonly menuCatalogBackfill: MenuCatalogBackfillService,
    
    private readonly menuService: MenuService,
    private readonly sellableResolution: SellableResolutionService,
    private readonly menuCategoryService: MenuCategoryService,
    private readonly comboService: ComboService,
    private readonly catalogMenuItemService: CatalogMenuItemService,
  ) {}

  @Get()
  @Roles('POS', 'MANAGER', 'KITCHEN', 'ADMIN')
  @ApiOperation({
    summary: 'List menu items (fixed + choice components, stock, cost)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async list(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.menuService.listMenus(scopedShop);
  }

  /**
   * Fixed FG picker — only finished goods / complete recipe products.
   * Declared before :menuId routes.
   */
  @Get('finished-goods')
  @Roles('POS', 'MANAGER', 'KITCHEN', 'ADMIN')
  @ApiOperation({
    summary: 'List finished goods only (for FIXED menu components)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async listFinishedGoods(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.menuService.listFinishedGoods(scopedShop);
  }

  @Get('finished-good-categories')
  @Roles('POS', 'MANAGER', 'KITCHEN', 'ADMIN')
  @ApiOperation({
    summary: 'List finished-good choice categories (Pizza, 1L Soda, …)',
  })
  async listFinishedGoodCategories() {
    return this.menuService.listFinishedGoodCategories();
  }

  @Post('finished-good-categories')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create or update a finished-good choice category' })
  async createFinishedGoodCategory(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
    },
  ) {
    return this.menuService.createFinishedGoodCategory(body);
  }

  @Post('finished-good-categories/assign')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Assign a finished-good SKU to a choice category (or clear)',
  })
  async assignFinishedGoodCategory(
    @Body()
    body: {
      item_id: string;
      category_id: string | null;
    },
  ) {
    return this.menuService.assignItemToFinishedGoodCategory(
      body.item_id,
      body.category_id,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Create menu item with FIXED / CHOICE / MULTI_CHOICE component lines',
  })
  @UsePipes(new ZodValidationPipe(CreateMenuSchema))
  async createMenu(
    @Body() dto: CreateMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuService.createMenu(dto, user.id);
  }

  @Post('item')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Add a FIXED finished-good line to an existing menu item',
  })
  @UsePipes(new ZodValidationPipe(MenuItemSchema))
  async addMenuItem(
    @Body() dto: MenuItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuService.addMenuItem(dto, user.id);
  }

  
  @Patch(':menuId/adjust')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Adjust menu item name, price, and recipe components (ADMIN)',
  })
  @UsePipes(new ZodValidationPipe(AdjustMenuSchema))
  async adjustMenu(
    @CurrentShop() scopedShop: string,
    @Param('menuId') menuId: string,
    @Body() dto: AdjustMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuService.adjustMenu(menuId, dto, user.id, scopedShop);
  }

@Get(':menuId/availability')
  @Roles('POS', 'MANAGER', 'KITCHEN', 'ADMIN')
  @ApiOperation({
    summary: 'Check real-time menu availability (fixed + choice pools)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  async checkAvailability(
    @CurrentShop() scopedShop: string,
    @Param('menuId') menuId: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.menuService.checkMenuAvailability(menuId, scopedShop);
  }


  @Get('catalog-items')
  @Roles('MANAGER', 'ADMIN', 'POS', 'KITCHEN')
  @ApiOperation({ summary: 'List catalog menu items (recipe | stocked)' })
  async listCatalogItems(@CurrentShop() scopedShop: string) {
    return this.catalogMenuItemService.list(scopedShop);
  }

  @Post('catalog-items')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create catalog menu item with production_type' })
  async createCatalogItem(
    @CurrentShop() scopedShop: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { id: string },
  ) {
    return this.catalogMenuItemService.create(
      {
        menu_item_id: body.menu_item_id as string | undefined,
        name: String(body.name ?? ''),
        production_type: body.production_type as 'recipe' | 'stocked',
        recipe_id: body.recipe_id as string | undefined,
        stock_item_id: body.stock_item_id as string | undefined,
        selling_price: Number(body.selling_price ?? 0),
        shop_id: scopedShop,
        active: body.active !== false,
      },
      user.id,
    );
  }

  
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
  async updateComboRoute(
    @CurrentShop() scopedShop: string,
    @Param('comboId') comboId: string,
    @Body() dto: UpdateComboDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comboService.update(scopedShop, comboId, dto, user.id);
  }

  @Get('categories')
  @Roles('MANAGER', 'ADMIN', 'POS', 'KITCHEN')
  @ApiOperation({
    summary: 'List Menu Categories (named groups of Menu Items for combos)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  async listMenuCategories(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
  ) {
    // Merged DB + event membership (multi-component menu IDs)
    return this.menuCategoryService.list(scopedShop);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a Menu Category' })
  async createMenuCategory(
    @CurrentShop() scopedShop: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { id: string },
  ) {
    return this.menuCategoryService.create(
      {
        category_id: body.category_id as string | undefined,
        name: String(body.name ?? ''),
        menu_item_ids: Array.isArray(body.menu_item_ids)
          ? (body.menu_item_ids as string[])
          : [],
        shop_id: scopedShop,
        notes: body.notes as string | undefined,
      },
      user.id,
    );
  }

  @Get('combos')
  @Roles('MANAGER', 'ADMIN', 'POS', 'KITCHEN')
  @ApiOperation({ summary: 'List Combos (pick N from category rules)' })
  @ApiQuery({ name: 'shopId', required: false })
  async listCombos(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
  ) {
    const db = await this.comboService.list(scopedShop);
    if (db.count > 0) return db;
    return this.menuService.listCombos(scopedShop);
  }

  @Post('combos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a Combo' })
  async createCombo(
    @CurrentShop() scopedShop: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { id: string },
  ) {
    const groups = Array.isArray(body.selection_groups)
      ? (body.selection_groups as Record<string, unknown>[]).map((g) => ({
          menu_category_id: String(g.menu_category_id ?? g.menuCategoryId ?? ''),
          menu_category_name: g.menu_category_name
            ? String(g.menu_category_name)
            : undefined,
          quantity: Number(g.quantity ?? 1),
        }))
      : [];
    return this.comboService.create(
      {
        combo_id: body.combo_id as string | undefined,
        name: String(body.name ?? ''),
        selling_price: Number(body.selling_price ?? 0),
        selection_groups: groups,
        shop_id: scopedShop,
        notes: body.notes as string | undefined,
      },
      user.id,
    );
  }

  @Post('combos/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN', 'POS', 'KITCHEN')
  @ApiOperation({
    summary: 'Preview stock impact for a combo + selections (read-only)',
  })
  async previewCombo(
    @CurrentShop() scopedShop: string,
    @Body()
    body: {
      combo_id: string;
      quantity?: number;
      selections: Array<{ group_index: number; menu_item_ids: string[] }>;
    },
  ) {
    const result = await this.sellableResolution.previewCombo(
      scopedShop,
      String(body.combo_id),
      Number(body.quantity ?? 1),
      (body.selections ?? []).map((s) => ({
        group_index: Number(s.group_index),
        menu_item_ids: s.menu_item_ids ?? [],
      })),
    );
    return { success: true, ...result };
  }


  @Post('catalog/backfill')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Backfill MenuCatalogProjection / categories / combos from events',
  })
  async backfillCatalog(@CurrentShop() scopedShop: string) {
    return this.menuCatalogBackfill.backfillShop(scopedShop || '1');
  }

}
