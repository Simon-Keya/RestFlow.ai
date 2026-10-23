import { UnitConversionService } from '../../common/units/unit-conversion.service';

describe('Recipe COGS with unit conversion', () => {
  const units = new UnitConversionService();

  it('500 g sugar @ 200/kg → 100', () => {
    expect(units.lineCost(500, 'g', 200, 'kg')).toBe(100);
  });

  it('food cost % = COGS / revenue', () => {
    const cogs = 300;
    const revenue = 1000;
    expect((cogs / revenue) * 100).toBe(30);
  });
});
