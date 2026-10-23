import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Safaricom STK callbacks are server-to-server POSTs without a standard
 * Stripe-style signature header. We harden with:
 * 1) Optional shared secret (query ?secret= or header x-mpesa-secret)
 * 2) Structural validation of stkCallback
 * 3) Optional HMAC over raw body when MPESA_CALLBACK_HMAC_SECRET is set
 */

export function assertMpesaCallbackSecret(
  provided: string | undefined,
  configured: string | undefined,
): void {
  if (!configured || !configured.trim()) {
    // Secret not configured: allow in development; production should set it
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException(
        'MPESA_CALLBACK_SECRET is required in production',
      );
    }
    return;
  }
  const a = Buffer.from(String(provided ?? ''), 'utf8');
  const b = Buffer.from(configured.trim(), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Invalid M-Pesa callback secret');
  }
}

export function verifyOptionalHmac(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  hmacSecret: string | undefined,
): void {
  if (!hmacSecret || !hmacSecret.trim()) return;
  if (!signatureHeader) {
    throw new UnauthorizedException('Missing M-Pesa HMAC signature');
  }
  const expected = createHmac('sha256', hmacSecret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody)
    .digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Invalid M-Pesa HMAC signature');
  }
}

export type ParsedStkCallback = {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount?: number;
  mpesaReceipt?: string;
  phone?: string;
};

export function parseStkCallback(body: unknown): ParsedStkCallback | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const bodyNode = (root.Body ?? root.body) as Record<string, unknown> | undefined;
  const callback = (bodyNode?.stkCallback ?? bodyNode?.stk_callback) as
    | Record<string, unknown>
    | undefined;
  if (!callback) return null;

  const checkoutRequestId = String(
    callback.CheckoutRequestID ?? callback.checkoutRequestID ?? '',
  ).trim();
  if (!checkoutRequestId) return null;

  const resultCode = Number(callback.ResultCode ?? callback.resultCode);
  const resultDesc = String(callback.ResultDesc ?? callback.resultDesc ?? '');

  let amount: number | undefined;
  let mpesaReceipt: string | undefined;
  let phone: string | undefined;

  const meta = callback.CallbackMetadata as
    | { Item?: Array<{ Name?: string; Value?: unknown }> }
    | undefined;
  const items = meta?.Item;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.Name === 'Amount') amount = Number(item.Value);
      if (item.Name === 'MpesaReceiptNumber')
        mpesaReceipt = String(item.Value);
      if (item.Name === 'PhoneNumber') phone = String(item.Value);
    }
  }

  return {
    checkoutRequestId,
    resultCode: Number.isFinite(resultCode) ? resultCode : -1,
    resultDesc,
    amount,
    mpesaReceipt,
    phone,
  };
}
