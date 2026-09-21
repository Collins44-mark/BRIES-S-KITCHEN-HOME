import { BadRequestException } from '@nestjs/common';
import { Decimal, money, toDecimal } from './money';

export interface DiscountInput {
  type: 'NONE' | 'PERCENTAGE' | 'FIXED';
  value: Decimal | number | string;
}

export interface LineItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Decimal | number | string;
  unitCost: Decimal | number | string;
}

export interface DiscountedLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Decimal;
  unitCost: Decimal;
  lineSubtotal: Decimal;
  discountAmount: Decimal;
  lineTotal: Decimal;
  lineCost: Decimal;
  lineProfit: Decimal;
}

export interface SaleCalculationResult {
  items: DiscountedLineItem[];
  subtotal: Decimal;
  discountAmount: Decimal;
  totalAmount: Decimal;
  totalCost: Decimal;
  totalProfit: Decimal;
}

/**
 * Distributes percentage or fixed discounts proportionally across line items.
 * Profit is calculated AFTER discount: lineTotal - lineCost.
 */
export function calculateSaleTotals(
  items: LineItemInput[],
  discount: DiscountInput,
): SaleCalculationResult {
  if (!items.length) {
    throw new BadRequestException('Sale must include at least one item');
  }

  const prepared = items.map((item) => {
    if (item.quantity <= 0) {
      throw new BadRequestException(`Invalid quantity for ${item.productName}`);
    }
    const unitPrice = money(item.unitPrice);
    const unitCost = money(item.unitCost);
    const lineSubtotal = money(unitPrice.mul(item.quantity));
    const lineCost = money(unitCost.mul(item.quantity));
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice,
      unitCost,
      lineSubtotal,
      lineCost,
    };
  });

  const subtotal = money(prepared.reduce((sum, i) => sum.plus(i.lineSubtotal), new Decimal(0)));

  let discountAmount = money(0);
  if (discount.type === 'PERCENTAGE') {
    const pct = toDecimal(discount.value);
    if (pct.lt(0) || pct.gt(100)) {
      throw new BadRequestException('Percentage discount must be between 0 and 100');
    }
    discountAmount = money(subtotal.mul(pct).div(100));
  } else if (discount.type === 'FIXED') {
    discountAmount = money(discount.value);
    if (discountAmount.lt(0)) {
      throw new BadRequestException('Fixed discount cannot be negative');
    }
    if (discountAmount.gt(subtotal)) {
      throw new BadRequestException('Fixed discount cannot exceed subtotal');
    }
  }

  const discountedItems: DiscountedLineItem[] = [];
  let allocatedDiscount = money(0);

  prepared.forEach((item, index) => {
    const isLast = index === prepared.length - 1;
    let itemDiscount = money(0);

    if (discountAmount.gt(0) && subtotal.gt(0)) {
      if (isLast) {
        itemDiscount = money(discountAmount.minus(allocatedDiscount));
      } else {
        itemDiscount = money(discountAmount.mul(item.lineSubtotal).div(subtotal));
        allocatedDiscount = money(allocatedDiscount.plus(itemDiscount));
      }
    }

    const lineTotal = money(item.lineSubtotal.minus(itemDiscount));
    const lineProfit = money(lineTotal.minus(item.lineCost));

    discountedItems.push({
      ...item,
      discountAmount: itemDiscount,
      lineTotal,
      lineProfit,
    });
  });

  const totalAmount = money(subtotal.minus(discountAmount));
  const totalCost = money(discountedItems.reduce((s, i) => s.plus(i.lineCost), new Decimal(0)));
  const totalProfit = money(totalAmount.minus(totalCost));

  return {
    items: discountedItems,
    subtotal,
    discountAmount,
    totalAmount,
    totalCost,
    totalProfit,
  };
}
