import { CurrentShop } from '../../common/decorators/current-shop.decorator';
// apps/api/src/modules/consumption/consumption.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConsumptionService } from './consumption.service';

@ApiTags('consumption')
@ApiBearerAuth()
@Controller('consumption')
@UseGuards(RolesGuard)
export class ConsumptionController {
  constructor(private readonly consumptionService: ConsumptionService) {}

  @Get('summary')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Consumption summary (recipe × usage)' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async summary(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return await this.consumptionService.getSummary(
      scopedShop,
      from,
      to,
    );
  }

  @Get('products/:productId')
  @Roles('MANAGER', 'ADMIN')
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async byProduct(
    @CurrentShop() scopedShop: string,
    @Param('productId') productId: string,
    @Query('shopId') shopId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return await this.consumptionService.byProduct(
      productId,
      scopedShop,
      from,
      to,
    );
  }

  @Get('menu-items/:menuItemId')
  @Roles('MANAGER', 'ADMIN')
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async byMenuItem(
    @CurrentShop() scopedShop: string,
    @Param('menuItemId') menuItemId: string,
    @Query('shopId') shopId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.consumptionService.byMenuItem(
      menuItemId,
      scopedShop,
      from,
      to,
    );
  }

  @Get('alerts')
  @Roles('MANAGER', 'ADMIN')
  async alerts(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
  ) {
    return await this.consumptionService.getAlerts(scopedShop);
  }
}
