import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CostingService } from './costing.service';

@ApiTags('costing')
@ApiBearerAuth()
@Controller('costing')
@UseGuards(RolesGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Get('sku-costs')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN', 'POS')
  @ApiOperation({ summary: 'Live weighted-average costs for multiple SKUs' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({
    name: 'itemIds',
    required: true,
    description: 'Comma-separated SKU/item IDs (maximum 100)',
  })
  async getSkuCosts(
    @CurrentShop() shopId: string,
    @Query('itemIds') itemIds?: string | string[],
  ) {
    if (itemIds !== undefined && typeof itemIds !== 'string') {
      throw new BadRequestException('itemIds must be a comma-separated string');
    }

    const ids = [...new Set(
      (itemIds ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )];

    if (ids.length === 0) {
      throw new BadRequestException('At least one itemId is required');
    }
    if (ids.length > 100) {
      throw new BadRequestException('A maximum of 100 itemIds is allowed');
    }

    return this.costingService.getAvgUnitCosts(shopId, ids);
  }
  @Get('sku/:itemId')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN', 'POS')
  @ApiOperation({
    summary: 'Live weighted-average unit cost for a SKU (fetch, do not re-type)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getSkuCost(
    @Param('itemId') itemId: string,
    @CurrentShop() shopId: string,
  ) {
    // SKUs may contain spaces (e.g. FRIES BOX); normalize once.
    let sku = itemId;
    try {
      sku = decodeURIComponent(itemId);
    } catch {
      sku = itemId;
    }
    return this.costingService.getAvgUnitCost(shopId, sku.trim());
  }
}
