import {
  assertMpesaCallbackSecret,
  parseStkCallback,
} from './mpesa-callback.security';

describe('mpesa-callback.security', () => {
  const prev = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prev;
  });

  it('parses valid stk callback', () => {
    const parsed = parseStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'ws_ABC',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 100 },
              { Name: 'MpesaReceiptNumber', Value: 'XYZ' },
            ],
          },
        },
      },
    });
    expect(parsed?.checkoutRequestId).toBe('ws_ABC');
    expect(parsed?.amount).toBe(100);
    expect(parsed?.mpesaReceipt).toBe('XYZ');
  });

  it('rejects missing secret in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertMpesaCallbackSecret(undefined, undefined)).toThrow();
  });

  it('accepts matching secret', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertMpesaCallbackSecret('s3cret', 's3cret')).not.toThrow();
  });
});
