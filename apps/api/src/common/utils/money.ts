import { Decimal } from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function money(value: string | number | Decimal): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function formatMoney(value: string | number | Decimal): string {
  return money(value).toFixed(2);
}

export function decimalToNumber(value: Decimal): number {
  return value.toNumber();
}
