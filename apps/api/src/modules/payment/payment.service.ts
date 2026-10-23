import { PrismaService } from '../../../prisma/prisma.service';
// apps/api/src/modules/payment/payment.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Stripe from 'stripe';
import { EventStoreService } from '../../core/event-store.service';
import { IdempotencyService } from '../../core/idempotency.service';
import type { MpesaPaymentDto } from './dto/mpesa-payment.dto';
import {
  assertMpesaCallbackSecret,
  parseStkCallback,
  verifyOptionalHmac,
} from './mpesa-callback.security';
import { toMoneyNumber } from '../../common/utils/money.util';
import type { StripePaymentDto } from './dto/stripe-payment.dto';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key, {
        // Must match installed stripe package types
        apiVersion: '2025-02-24.acacia',
      });
      this.logger.log('Stripe client initialized');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — Stripe payments disabled (app still boots)',
      );
    }
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on this server');
    }
    return this.stripe;
  }

  private mpesaBaseUrl(): string {
    const env = this.config.get<string>('MPESA_ENV') || 'sandbox';
    return env === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private async getMpesaAccessToken(): Promise<string> {
    const key = this.config.get<string>('MPESA_CONSUMER_KEY');
    const secret = this.config.get<string>('MPESA_CONSUMER_SECRET');
    if (!key || !secret) {
      throw new BadRequestException('M-Pesa credentials not configured');
    }

    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const res = await axios.get(
      `${this.mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    return res.data.access_token as string;
  }

  private mpesaPassword(timestamp: string): string {
    const shortcode = this.config.get<string>('MPESA_SHORTCODE') || '';
    const passkey = this.config.get<string>('MPESA_PASSKEY') || '';
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  }

  private timestamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
      `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    );
  }

  private normalizePhone(raw: string): string {
    let phone = raw.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = `254${phone.slice(1)}`;
    if (phone.startsWith('254')) return phone;
    return phone;
  }

  // ═══════════════════ M-PESA STK ═══════════════════
  async initiateMpesaPayment(dto: MpesaPaymentDto, actorUserId: string) {
    const idempotencyKey = `mpesa-stk-${dto.order_id}`;

    const { isReplay, existing } =
      await this.idempotencyService.enforce(idempotencyKey, dto);
    if (isReplay) {
      return {
        success: true,
        ...(existing?.payload as object),
        message: 'Already initiated (idempotent replay)',
      };
    }

    const token = await this.getMpesaAccessToken();
    const ts = this.timestamp();
    const shortcode = this.config.get<string>('MPESA_SHORTCODE')!;
    const baseUrl =
      this.config.get<string>('BASE_URL') ||
      this.config.get<string>('MPESA_CALLBACK_URL')?.replace(
        /\/payment\/mpesa\/callback\/?$/,
        '',
      );

    if (!baseUrl) {
      throw new BadRequestException(
        'BASE_URL or MPESA_CALLBACK_URL is required for M-Pesa callbacks',
      );
    }

    // DTO fields: phone_number, transaction_desc (not phone / description)
    const phone = this.normalizePhone(dto.phone_number);
    const callbackUrl =
      this.config.get<string>('MPESA_CALLBACK_URL') ||
      `${baseUrl}/payment/mpesa/callback`;

    const stkRes = await axios.post(
      `${this.mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: this.mpesaPassword(ts),
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(dto.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: dto.account_reference || dto.order_id,
        TransactionDesc:
          dto.transaction_desc || `Order ${dto.order_id}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const checkoutRequestId = stkRes.data?.CheckoutRequestID as string;

    await this.eventStore.appendEvent({
      event_type: 'mpesa_stk_initiated',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      total_cost: dto.amount,
      payload: {
        order_id: dto.order_id,
        amount: dto.amount,
        phone,
        checkout_request_id: checkoutRequestId,
        merchant_request_id: stkRes.data?.MerchantRequestID,
        status: 'pending',
        raw: stkRes.data,
      },
    });

    this.logger.log(
      `M-Pesa STK initiated for order ${dto.order_id} → ${checkoutRequestId}`,
    );

    return {
      success: true,
      checkoutRequestId,
      merchantRequestId: stkRes.data?.MerchantRequestID,
      message: 'STK push sent to customer phone',
    };
  }

  async handleMpesaCallback(
    body: unknown,
    security?: {
      secret?: string;
      hmacSignature?: string;
      rawBody?: string | Buffer;
    },
  ) {
    assertMpesaCallbackSecret(
      security?.secret,
      process.env.MPESA_CALLBACK_SECRET,
    );
    if (security?.rawBody) {
      verifyOptionalHmac(
        security.rawBody,
        security.hmacSignature,
        process.env.MPESA_CALLBACK_HMAC_SECRET,
      );
    }

    const parsed = parseStkCallback(body);
    if (!parsed) {
      this.logger.warn('Invalid M-Pesa callback body');
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const checkoutRequestId = parsed.checkoutRequestId;
    const resultCode = parsed.resultCode;
    const resultDesc = parsed.resultDesc;
    const idempotencyKey = `mpesa-callback-${checkoutRequestId}-${resultCode}`;

    const { isReplay } = await this.idempotencyService.enforce(
      idempotencyKey,
      { checkoutRequestId, resultCode },
    );
    if (isReplay) {
      return { ResultCode: 0, ResultDesc: 'Already processed' };
    }

    // Correlate with original STK initiation when present
    const pending = await this.prisma.event.findFirst({
      where: {
        event_type: 'mpesa_stk_initiated',
        payload: {
          path: ['checkout_request_id'],
          equals: checkoutRequestId,
        },
      },
      orderBy: { created_at: 'desc' },
    });
    if (!pending && process.env.MPESA_REQUIRE_PENDING === 'true') {
      this.logger.warn(
        `M-Pesa callback for unknown checkoutRequestId=${checkoutRequestId}`,
      );
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    let amount = parsed.amount !== undefined ? toMoneyNumber(parsed.amount) : undefined;
    const mpesaReceipt = parsed.mpesaReceipt;
    const phone = parsed.phone;

    if (pending?.payload && amount !== undefined) {
      const p = pending.payload as Record<string, unknown>;
      const expected = toMoneyNumber(p.amount, NaN);
      if (Number.isFinite(expected) && Math.abs(expected - amount) > 0.05) {
        this.logger.error(
          `M-Pesa amount mismatch checkout=${checkoutRequestId} expected=${expected} got=${amount}`,
        );
        // Still record event for audit but flag mismatch
      }
    }

    const success = resultCode === 0;

    await this.eventStore.appendEvent({
      event_type: 'mpesa_callback_processed',
      idempotency_key: idempotencyKey,
      total_cost: amount,
      payload: {
        checkout_request_id: checkoutRequestId,
        result_code: resultCode,
        result_desc: resultDesc,
        success,
        amount,
        mpesa_receipt: mpesaReceipt,
        phone,
        raw: body,
        processed_at: new Date().toISOString(),
      },
    });

    if (success) {
      this.logger.log(
        `M-Pesa payment SUCCESS receipt=${mpesaReceipt} amount=${amount}`,
      );
    } else {
      this.logger.warn(
        `M-Pesa payment FAILED ${checkoutRequestId}: ${resultDesc}`,
      );
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  // ═══════════════════ STRIPE ═══════════════════
  async createStripePaymentIntent(dto: StripePaymentDto, actorUserId: string) {
    const stripe = this.getStripe();
    const idempotencyKey = `stripe-pi-${dto.order_id}`;

    const { isReplay, existing } =
      await this.idempotencyService.enforce(idempotencyKey, dto);
    if (isReplay) {
      return {
        success: true,
        ...(existing?.payload as object),
        message: 'Already created (idempotent replay)',
      };
    }

    const currency = (dto.currency || 'kes').toLowerCase();
    const amountMinor = Math.round(dto.amount * 100);

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountMinor,
        currency,
        metadata: {
          order_id: dto.order_id,
          actor_user_id: actorUserId,
        },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey },
    );

    await this.eventStore.appendEvent({
      event_type: 'stripe_payment_intent_created',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      total_cost: dto.amount,
      payload: {
        order_id: dto.order_id,
        payment_intent_id: intent.id,
        client_secret: intent.client_secret,
        amount: dto.amount,
        currency,
        status: intent.status,
      },
    });

    return {
      success: true,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      message: 'Payment intent created',
    };
  }

  async handleStripeWebhook(
    rawBody: Buffer | string | object,
    signature: string,
  ) {
    const stripe = this.getStripe();
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured');
    }

    let event: Stripe.Event;
    try {
      const payload =
        typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
          ? rawBody
          : JSON.stringify(rawBody);
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err: any) {
      this.logger.warn(`Stripe webhook signature failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    const idempotencyKey = `stripe-wh-${event.id}`;
    const { isReplay } = await this.idempotencyService.enforce(idempotencyKey, {
      type: event.type,
    });
    if (isReplay) {
      return { received: true };
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await this.eventStore.appendEvent({
        event_type: 'stripe_payment_succeeded',
        idempotency_key: idempotencyKey,
        total_cost: (pi.amount || 0) / 100,
        payload: {
          payment_intent_id: pi.id,
          order_id: pi.metadata?.order_id,
          amount: (pi.amount || 0) / 100,
          currency: pi.currency,
          status: pi.status,
        },
      });
      this.logger.log(`Stripe payment succeeded: ${pi.id}`);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await this.eventStore.appendEvent({
        event_type: 'stripe_payment_failed',
        idempotency_key: idempotencyKey,
        payload: {
          payment_intent_id: pi.id,
          order_id: pi.metadata?.order_id,
          status: pi.status,
        },
      });
    }

    return { received: true };
  }
}