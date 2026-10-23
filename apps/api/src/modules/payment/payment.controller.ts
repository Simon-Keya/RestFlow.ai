// apps/api/src/modules/payment/payment.controller.ts
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { MpesaPaymentDto } from './dto/mpesa-payment.dto';
import type { StripePaymentDto } from './dto/stripe-payment.dto';
import { PaymentService } from './payment.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('mpesa')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Initiate M-Pesa STK Push' })
  async initiateMpesa(
    @Body() dto: MpesaPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.initiateMpesaPayment(dto, user.id);
  }

  @Post('stripe')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('POS', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Create Stripe Payment Intent' })
  async createStripe(
    @Body() dto: StripePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.createStripePaymentIntent(dto, user.id);
  }

  /**
   * Register CallBackURL as:
   *   https://api.example.com/payment/mpesa/callback?secret=YOUR_MPESA_CALLBACK_SECRET
   * Optionally send header x-mpesa-secret or x-mpesa-signature (HMAC).
   */
  @Public()
  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M-Pesa STK callback (Safaricom → us)' })
  async mpesaCallback(
    @Body() body: Record<string, unknown>,
    @Query('secret') secretQuery?: string,
    @Headers('x-mpesa-secret') secretHeader?: string,
    @Headers('x-mpesa-signature') hmacHeader?: string,
    @Req() req?: Request,
  ) {
    const raw =
      (req as Request & { rawBody?: Buffer })?.rawBody ||
      JSON.stringify(body);
    return this.paymentService.handleMpesaCallback(body, {
      secret: secretHeader || secretQuery,
      hmacSignature: hmacHeader,
      rawBody: raw,
    });
  }

  @Public()
  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook' })
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody || req.body;
    return this.paymentService.handleStripeWebhook(rawBody, signature);
  }
}
