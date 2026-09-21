import { calculateSaleTotals } from './sale-calculator';

describe('calculateSaleTotals', () => {
  it('distributes percentage discount proportionally and computes profit after discount', () => {
    const result = calculateSaleTotals(
      [
        { productId: 'a', productName: 'A', quantity: 1, unitPrice: 200000, unitCost: 100000 },
        { productId: 'b', productName: 'B', quantity: 1, unitPrice: 200000, unitCost: 100000 },
        { productId: 'c', productName: 'C', quantity: 1, unitPrice: 400000, unitCost: 200000 },
        { productId: 'd', productName: 'D', quantity: 1, unitPrice: 1200000, unitCost: 600000 },
        { productId: 'e', productName: 'E', quantity: 1, unitPrice: 100000, unitCost: 50000 },
      ],
      { type: 'PERCENTAGE', value: 10 },
    );

    expect(result.subtotal.toFixed(2)).toBe('2100000.00');
    expect(result.discountAmount.toFixed(2)).toBe('210000.00');
    expect(result.totalAmount.toFixed(2)).toBe('1890000.00');
    expect(result.totalCost.toFixed(2)).toBe('1050000.00');
    expect(result.totalProfit.toFixed(2)).toBe('840000.00');
    expect(result.items[0].discountAmount.toFixed(2)).toBe('20000.00');
    expect(result.items[3].discountAmount.toFixed(2)).toBe('120000.00');
  });
});
