import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CostingService } from './costing.service';

@ApiTags('costing')
@ApiBearerAuth()
@Controller('costing')
@UseGuards(RolesGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Get('sku/:itemId')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN', 'POS')
  @ApiOperation({
    summary: 'Live weighted-average unit cost for a SKU (fetch, do not re-type)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getSkuCost(
    @Param('itemId') itemId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    // SKUs may contain spaces (e.g. FRIES BOX) — Express already decodes, normalize once
    let sku = itemId;
    try {
      sku = decodeURIComponent(itemId);
    } catch {
      sku = itemId;
    }
    return this.costingService.getAvgUnitCost(
      shopId || shop_id || '1',
      sku.trim(),
    );
  }
}
