export type UnitFamily = 'mass' | 'volume' | 'count';

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitConversionError';
  }
}
