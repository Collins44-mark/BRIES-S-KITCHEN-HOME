import type { SaleDetail } from '@/lib/supabase/sales-history';

/** Display-only cash tendering (not stored on the sale). */
export type ReceiptCashExtras = {
  /** Amount the customer handed over (may exceed total). */
  cashReceived: string | null;
  /** cashReceived − total when positive; display only. */
  changeDue: string | null;
};

export type ReceiptLine = {
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
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

export type ReceiptLayout = 'screen' | 'a4' | 'thermal';

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

/**
 * Map authoritative SaleDetail (+ optional cash extras) into receipt data.
 * Does not recompute totals from product catalog prices.
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
