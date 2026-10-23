import { resolveShopId, userShopId } from './shop.util';

describe('shop.util', () => {
  it('defaults membership to 1', () => {
    expect(userShopId(undefined)).toBe('1');
    expect(userShopId({})).toBe('1');
  });

  it('blocks non-admin from foreign shop', () => {
    const r = resolveShopId({ role: 'KITCHEN', shopId: '1' }, '2');
    expect(r.allowed).toBe(false);
    expect(r.shopId).toBe('1');
  });

  it('allows admin any shop', () => {
    const r = resolveShopId({ role: 'ADMIN', shopId: '1' }, '99');
    expect(r.allowed).toBe(true);
    expect(r.shopId).toBe('99');
  });

  it('allows matching membership', () => {
    const r = resolveShopId({ role: 'POS', shop_id: '7' }, '7');
    expect(r.allowed).toBe(true);
    expect(r.shopId).toBe('7');
  });
});
