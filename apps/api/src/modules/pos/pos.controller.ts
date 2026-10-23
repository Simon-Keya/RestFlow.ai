// apps/api/src/modules/pos/pos.controller.ts
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
import type { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderSchema } from './dto/create-order.dto';
import type { SendToKitchenDto } from './dto/send-to-kitchen.dto';
import { SendToKitchenSchema } from './dto/send-to-kitchen.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpdatePaymentSchema } from './dto/update-payment.dto';
import { PosService } from './pos.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos')
@UseGuards(RolesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('order')
  @HttpCode(HttpStatus.CREATED)
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Create new POS order (not sent to kitchen yet)' })
  @UsePipes(new ZodValidationPipe(CreateOrderSchema))
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.createOrder(dto, user.id);
  }

  @Post('orders/:orderId/send-to-kitchen')
  @HttpCode(HttpStatus.OK)
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Send order to kitchen queue' })
  async sendToKitchen(
    @CurrentShop() scopedShop: string,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(SendToKitchenSchema)) dto: SendToKitchenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.sendToKitchen(orderId, user.id, scopedShop);
  }

  @Post('orders/:orderId/payment')
  @HttpCode(HttpStatus.OK)
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update payment status only (not kitchen)' })
  async updatePayment(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(UpdatePaymentSchema)) dto: UpdatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.updatePayment(orderId, dto, user.id);
  }

  @Get('orders')
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List POS orders (paginated)' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listOrders(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.posService.listOrders({
      shopId: scopedShop,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
    });
  }

  @Get('orders/:orderId')
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get one POS order' })
  @ApiQuery({ name: 'shopId', required: false })
  async getOrder(
    @CurrentShop() scopedShop: string,
    @Param('orderId') orderId: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.posService.getOrder(orderId, scopedShop);
  }


  @Get('bootstrap')
  @Roles('POS', 'MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({
    summary: 'POS bootstrap: menus + availability + combos + categories (one RTT)',
  })
  async bootstrap(@CurrentShop() scopedShop: string) {
    return this.posService.getBootstrap(scopedShop);
  }

  @Get('menu-availability')
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Menu item availability from stock + recipes' })
  @ApiQuery({ name: 'shopId', required: false })
  async menuAvailability(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.posService.getMenuAvailability(scopedShop);
  }
}
