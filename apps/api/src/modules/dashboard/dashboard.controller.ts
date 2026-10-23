import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SalesProjectionBackfillService } from '../../core/sales-projection-backfill.service';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly salesBackfill: SalesProjectionBackfillService,
  ) {}

  @Get('summary')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Shop summary cards (revenue/orders follow from/to period)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getSummary(
    @CurrentShop() scopedShop: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getSummary(scopedShop, from, to);
  }

  @Get('kpis')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Key performance indicators for a date range' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getKpis(
    @CurrentShop() scopedShop: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getKpis(scopedShop, from, to);
  }

  @Get('alerts')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({ summary: 'Dashboard alerts (low stock, near expiry, etc.)' })
  async getAlerts(@CurrentShop() scopedShop: string) {
    return this.dashboardService.getAlerts(scopedShop);
  }

  /**
   * Rebuild SalesProjection from historical pos_sale events.
   * Use once after deploying the sales-count fix so Today / This week show past orders.
   */
  @Post('rebuild-sales')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Backfill sales projection from historical pos_sale events',
  })
  async rebuildSales(@CurrentShop() scopedShop: string) {
    const result = await this.salesBackfill.backfillShop(scopedShop);
    return { success: true, ...result };
  }
}
