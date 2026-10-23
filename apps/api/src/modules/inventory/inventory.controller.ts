import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { INVENTORY_CATEGORIES } from '../../common/constants/inventory-categories';
// apps/api/src/modules/inventory/inventory.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InventoryService } from './inventory.service';

function parseBool(value?: string): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('MANAGER', 'KITCHEN', 'POS', 'ADMIN')
  @ApiOperation({
    summary: 'List current stock levels (paginated, default 20)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({
    name: 'includeFinished',
    required: false,
    description: 'Include Finished Goods SKUs (default false)',
  })
  @ApiQuery({
    name: 'includeWrittenOff',
    required: false,
    description: 'Include written-off expired zero-stock rows',
  })
  @ApiQuery({ name: 'lowStockOnly', required: false })
  async list(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('includeFinished') includeFinished?: string,
    @Query('includeWrittenOff') includeWrittenOff?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
  ) {
    const resolvedLimit = pageSize
      ? parseInt(pageSize, 10)
      : limit
        ? parseInt(limit, 10)
        : 20;

    return this.inventoryService.getAllStock({
      shopId: scopedShop,
      page: page ? parseInt(page, 10) : 1,
      limit: Number.isFinite(resolvedLimit) ? resolvedLimit : 20,
      search,
      category,
      status,
      includeFinished: parseBool(includeFinished),
      includeWrittenOff: parseBool(includeWrittenOff),
      lowStockOnly: parseBool(lowStockOnly),
    });
  }

  /** Must be registered before :itemId */
  @Get('summary')
  @Roles('MANAGER', 'KITCHEN', 'POS', 'ADMIN')
  @ApiOperation({
    summary: 'Shop-wide inventory totals (not page-scoped)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async summary(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.inventoryService.getSummary(scopedShop);
  }

  @Get('expiry-alerts')
  @Roles('MANAGER', 'KITCHEN', 'ADMIN')
  @ApiOperation({ summary: 'Batch-level expiry alerts for expired and 1/3/7-day windows' })
  async expiryAlerts(@CurrentShop() scopedShop: string) {
    return this.inventoryService.getExpiryAlerts(scopedShop);
  }

  @Get('alerts')
  @Roles('MANAGER', 'KITCHEN', 'POS', 'ADMIN')
  @ApiOperation({ summary: 'Low stock and near-expiry items' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async alerts(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.inventoryService.getAlerts(scopedShop);
  }

  @Get('categories')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN', 'POS')
  @ApiOperation({ summary: 'Canonical inventory category list' })
  listCategories() {
    return { success: true, items: [...INVENTORY_CATEGORIES] };
  }

  @Get(':itemId/movements')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({ summary: 'Read append-only stock movement history for an item' })
  async getMovements(
    @CurrentShop() scopedShop: string,
    @Param('itemId') itemId: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getMovements(itemId, scopedShop, limit ? Number(limit) : 100);
  }

  @Get(':itemId/batches')
  @Roles('MANAGER', 'KITCHEN', 'POS', 'ADMIN')
  @ApiOperation({ summary: 'List remaining stock batches for an item' })
  async getBatches(
    @CurrentShop() scopedShop: string,
    @Param('itemId') itemId: string,
  ) {
    return this.inventoryService.getBatches(itemId, scopedShop);
  }

  @Get(':itemId')
  @Roles('MANAGER', 'KITCHEN', 'POS', 'ADMIN')
  @ApiOperation({ summary: 'Get stock for one item' })
  async getOne(
    @CurrentShop() scopedShop: string,
    @Param('itemId') itemId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.inventoryService.getStockByItem(
      itemId,
      scopedShop,
    );
  }


}
