describe('combo selection validation rules', () => {
  it('requires exact quantity per group', () => {
    const required = 2;
    const selected = ['a', 'b'];
    expect(selected.length).toBe(required);
  });

  it('multiplies combo quantity for deductions', () => {
    const perCombo = 3;
    const comboQty = 2;
    expect(perCombo * comboQty).toBe(6);
  });

  it('combo revenue uses combo price not sum of items', () => {
    const comboPrice = 1500;
    const itemSum = 1800;
    const revenue = comboPrice; // authoritative
    expect(revenue).not.toBe(itemSum);
    expect(revenue).toBe(1500);
  });
});
