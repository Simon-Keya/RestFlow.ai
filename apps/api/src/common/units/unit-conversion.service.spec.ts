import { UnitConversionService } from './unit-conversion.service';
import { UnitConversionError } from './unit-conversion.types';

describe('UnitConversionService', () => {
  const svc = new UnitConversionService();

  it('500 g → 0.5 kg', () => {
    expect(svc.convert(500, 'g', 'kg')).toBeCloseTo(0.5, 6);
  });

  it('0.5 kg → 500 g', () => {
    expect(svc.convert(0.5, 'kg', 'g')).toBeCloseTo(500, 6);
  });

  it('1 L → 1000 ml', () => {
    expect(svc.convert(1, 'L', 'ml')).toBeCloseTo(1000, 6);
  });

  it('250 g @ 400 KES/kg → line cost 100', () => {
    expect(svc.lineCost(250, 'g', 400, 'kg')).toBe(100);
  });

  it('batch cost then unit cost (100g×2 + 50g×4) / 10 = 40', () => {
    const a = svc.lineCost(100, 'g', 2, 'g'); // cost already per g
    const b = svc.lineCost(50, 'g', 4, 'g');
    const total = a + b;
    expect(total).toBe(400);
    expect(total / 10).toBe(40);
  });

  it('kg → ml throws', () => {
    expect(() => svc.convert(1, 'kg', 'ml')).toThrow(UnitConversionError);
  });

  it('unknown unit throws', () => {
    expect(() => svc.convert(1, 'stone', 'kg')).toThrow(UnitConversionError);
  });

  it('aliases kilogram → kg', () => {
    expect(svc.normalizeUnit('Kilogram')).toBe('kg');
    expect(svc.convert(1, 'kilogram', 'g')).toBe(1000);
  });

  it('same unit is no-op', () => {
    expect(svc.convert(12.5, 'kg', 'kg')).toBe(12.5);
  });

  it('CS / case aliases to pcs (count)', () => {
    expect(svc.normalizeUnit('CS')).toBe('pcs');
    expect(svc.normalizeUnit('case')).toBe('pcs');
    expect(svc.convert(2, 'CS', 'pcs')).toBe(2);
    expect(svc.convertOrThrow(1, 'cs', 'pcs')).toBe(1);
  });
});
