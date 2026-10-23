import {
  computeWeightedAverageUnitCost,
  stockOutValue,
} from './weighted-average';

describe('WAC formula (Michael tomato example)', () => {
  it('receipt 1: 50 @ 40 → avg 40', () => {
    expect(
      computeWeightedAverageUnitCost({
        qtyOnHand: 0,
        currentAvg: 0,
        qtyReceived: 50,
        receiptUnitCost: 40,
      }),
    ).toBe(40);
  });

  it('receipt 2: +30 @ 46 → avg 42.25', () => {
    expect(
      computeWeightedAverageUnitCost({
        qtyOnHand: 50,
        currentAvg: 40,
        qtyReceived: 30,
        receiptUnitCost: 46,
      }),
    ).toBe(42.25);
  });

  it('receipt 3: +40 @ 38 → avg 40.833333', () => {
    const avg = computeWeightedAverageUnitCost({
      qtyOnHand: 80,
      currentAvg: 42.25,
      qtyReceived: 40,
      receiptUnitCost: 38,
    });
    // 4900/120 = 40.8333...
    expect(avg).toBeCloseTo(40.833333, 5);
  });

  it('stock-out does not need avg change; value = qty * avg', () => {
    expect(stockOutValue(1, 40.83)).toBeCloseTo(40.83, 2);
  });
});
