// apps/api/src/modules/kitchen/kitchen.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import {
  SubmitClosingStockSchema,
  type SubmitClosingStockDto,
} from './dto/closing-stock.dto';
import { KitchenService } from './kitchen.service';
import { ProductionService } from '../production/production.service';
import type { PrePrepDto } from '../production/dto/pre-prep.dto';
import { PrePrepSchema } from '../production/dto/pre-prep.dto';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('kitchen')
@ApiBearerAuth()
@Controller('kitchen')
@UseGuards(RolesGuard)
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly productionService: ProductionService,
  ) {}

  /**
   * Alias for POST /production/pre-prep — same handler.
   * Kitchen module is always mounted; use this if production path 404s.
   */
  @Post('pre-prep')
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Pre-prep batch (raw → prepped FG). Alias of POST /production/pre-prep',
  })
  @UsePipes(new ZodValidationPipe(PrePrepSchema))
  async prePrep(
    @Body() dto: PrePrepDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productionService.prePrep(dto, user.id);
  }



  /**
   * Static GET routes positioned before parameterized routes
   */

  @Get('active-orders')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get active kitchen orders' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getActiveOrders(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    const targetShopId = scopedShop;
    const orders = await this.kitchenService.getActiveOrders(targetShopId);
    return { success: true, orders, count: orders.length };
  }

  @Get('production-history')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Finished production batches (history)' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getProductionHistory(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('limit') limit?: string,
  ) {
    const targetShopId = scopedShop;
    const parsedLimit = limit ? Math.max(1, parseInt(limit, 10) || 50) : 50;

    return this.kitchenService.getProductionHistory(targetShopId, {
      limit: parsedLimit,
    });
  }

  @Get('production-queue')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Production queue for the kitchen' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getProductionQueue(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    const targetShopId = scopedShop;
    return this.kitchenService.getProductionQueue(targetShopId);
  }

  @Get('closing-stock')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Pre-filled closing stock count form (system quantities)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getClosingStock(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    const targetShopId = scopedShop;
    return this.kitchenService.getClosingStockForm(targetShopId);
  }

  /**
   * Action POST routes
   */

  @Post('closing-stock')
  @HttpCode(HttpStatus.CREATED)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary:
      'Submit closing stock count — ADMIN/MANAGER only; writes reconciliation event for accuracy + variance',
  })
  @UsePipes(new ZodValidationPipe(SubmitClosingStockSchema))
  async submitClosingStock(
    @Body() body: SubmitClosingStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kitchenService.submitClosingStock(body, user?.id);
  }

  @Post('orders/:orderId/status')
  @HttpCode(HttpStatus.OK)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update order status (idempotent per status)' })
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body()
    body: {
      status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
      batch_number?: string;
      item_id?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kitchenService.updateOrderStatus(
      orderId,
      body.status,
      user?.id,
      {
        batch_number: body.batch_number,
        item_id: body.item_id,
      },
    );
  }

  /**
   * Parameterized GET routes (must remain at bottom)
   */

  @Get('batches/:itemId')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get available batches for an item' })
  async getBatches(@Param('itemId') itemId: string) {
    const batches = await this.kitchenService.getBatchesForItem(itemId);
    return { success: true, batches };
  }
}
