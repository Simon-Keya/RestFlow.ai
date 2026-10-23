import {
  payloadsEqual,
  resolveQuantityFromPayload,
  resolveShopIdFromPayload,
} from './event-store.logic';

describe('event-store.logic', () => {
  it('payloadsEqual', () => {
    expect(payloadsEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(payloadsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it('shop id', () => {
    expect(resolveShopIdFromPayload({})).toBe('1');
    expect(resolveShopIdFromPayload({ shop_id: '7' })).toBe('7');
  });
  it('quantity', () => {
    expect(resolveQuantityFromPayload(3, { quantity: 9 })).toBe(3);
    expect(resolveQuantityFromPayload(undefined, { issued_qty: 4 })).toBe(4);
  });
});
