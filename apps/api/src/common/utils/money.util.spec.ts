import {
  addMoney,
  fromCents,
  multiplyMoney,
  percentOf,
  roundMoney,
  subtractMoney,
  toCents,
  toMoneyNumber,
} from './money.util';

describe('money.util', () => {
  it('rounds 0.1+0.2', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('multiplies and adds cleanly', () => {
    expect(multiplyMoney(10.01, 3)).toBe(30.03);
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it('cents round-trip', () => {
    expect(toCents(10.005)).toBe(1001);
    expect(fromCents(1001)).toBe(10.01);
  });

  it('subtract and percent', () => {
    expect(subtractMoney(10, 3.33)).toBe(6.67);
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(1, 0)).toBeNull();
  });

  it('toMoneyNumber handles strings', () => {
    expect(toMoneyNumber('12.345')).toBe(12.35);
    expect(toMoneyNumber(undefined, 1)).toBe(1);
  });
});
