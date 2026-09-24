import type { SaleDetail } from '@/lib/supabase/sales-history';
import {
  formatSaleItemBaseHint,
  formatSaleItemQuantity,
} from '@/lib/supabase/sales-history';

/** Display-only cash tendering (not stored on the sale). */
export type ReceiptCashExtras = {
  /** Amount the customer handed over (may exceed total). */
  cashReceived: string | null;
  /** cashReceived − total when positive; display only. */
  changeDue: string | null;
};

/**
 * Receipt line from sale_items snapshot only.
 * Selling-unit fields are null for pre-multi-unit historical rows.
 */
export type ReceiptLine = {
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  productUnitId: string | null;
  sellingUnitCode: string | null;
  sellingUnitLabel: string | null;
  conversionToBase: number | null;
  baseQuantity: number | null;
};

export type ReceiptPayment = {
  method: string;
  amount: string;
  reference: string | null;
};

/**
 * Receipt view-model built only from stored sale / sale_items / payments
 * (plus optional cash tendering extras for display).
 */
export type SaleReceiptData = {
  invoiceNumber: string;
  soldAt: string;
  cashierName: string;
  customerName: string;
  items: ReceiptLine[];
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
  payments: ReceiptPayment[];
  cashReceived: string | null;
  changeDue: string | null;
};

export type ReceiptLayout = 'screen' | 'a4' | 'thermal58' | 'thermal80';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  BANK: 'Bank',
};

export function paymentMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

export function moneyPlain(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

/** Qty + unit from historical snapshot (never invents SET/PACK for legacy). */
export function formatReceiptLineQuantity(item: ReceiptLine): string {
  return formatSaleItemQuantity({
    quantity: item.quantity,
    sellingUnitCode: item.sellingUnitCode,
    sellingUnitLabel: item.sellingUnitLabel,
    baseQuantity: item.baseQuantity,
  });
}

/**
 * Secondary base hint for multi-unit lines only.
 * Prefer "12 PCS base" when conversion > 1; null for legacy / PCS 1:1.
 */
export function formatReceiptLineBaseHint(item: ReceiptLine): string | null {
  const code = item.sellingUnitCode?.trim();
  const conversion =
    item.conversionToBase ??
    (item.baseQuantity != null && item.quantity > 0
      ? Math.round(item.baseQuantity / item.quantity)
      : null);

  if (code && item.baseQuantity != null && conversion != null && conversion > 1) {
    return `${item.baseQuantity} PCS base`;
  }

  // Fallback to shared hint text when conversion unknown but base differs
  const hint = formatSaleItemBaseHint({
    quantity: item.quantity,
    sellingUnitCode: item.sellingUnitCode,
    sellingUnitLabel: item.sellingUnitLabel,
    baseQuantity: item.baseQuantity,
  });
  if (hint && item.baseQuantity != null && code) {
    return `${item.baseQuantity} PCS base`;
  }
  return null;
}

/**
 * Map authoritative SaleDetail (+ optional cash extras) into receipt data.
 * Does not recompute totals from product catalog prices or live product_units.
 */
export function toSaleReceiptData(
  sale: SaleDetail,
  extras?: ReceiptCashExtras,
): SaleReceiptData {
  return {
    invoiceNumber: sale.invoiceNumber,
    soldAt: sale.soldAt,
    cashierName: sale.cashierName || '—',
    customerName: sale.customerName?.trim() || 'Walk-in Customer',
    items: sale.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      productUnitId: item.productUnitId,
      sellingUnitCode: item.sellingUnitCode,
      sellingUnitLabel: item.sellingUnitLabel,
      conversionToBase: item.conversionToBase,
      baseQuantity: item.baseQuantity,
    })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    totalAmount: sale.totalAmount,
    amountPaid: sale.amountPaid,
    amountDue: sale.amountDue,
    paymentStatus: sale.paymentStatus,
    payments: sale.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
    })),
    cashReceived: extras?.cashReceived ?? null,
    changeDue: extras?.changeDue ?? null,
  };
}

export function receiptFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, '-');
  return `BRIES-HOME-KITCHEN-${safe}.pdf`;
}
