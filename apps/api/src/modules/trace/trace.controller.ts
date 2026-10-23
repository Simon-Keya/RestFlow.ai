import { CurrentShop } from '../../common/decorators/current-shop.decorator';
// apps/api/src/modules/trace/trace.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TraceService } from './trace.service';

@ApiTags('trace')
@ApiBearerAuth()
@Controller('trace')
@UseGuards(RolesGuard)
export class TraceController {
  constructor(private readonly traceService: TraceService) {}

  @Get()
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Search trace by query, item, batch, or event type',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'batchNumber', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'event_type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async search(
    @CurrentShop() scopedShop: string,
    @Query('q') q?: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('itemId') itemId?: string,
    @Query('batchNumber') batchNumber?: string,
    @Query('eventType') eventType?: string,
    @Query('event_type') event_type?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.traceService.search({
      shopId: scopedShop,
      q: q || itemId,
      itemId: itemId || q,
      batchNumber,
      eventType: eventType || event_type,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('item/:itemId')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Full trace timeline for one item' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async forItem(
    @CurrentShop() scopedShop: string,
    @Param('itemId') itemId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return await this.traceService.forItem(itemId, scopedShop);
  }
}
