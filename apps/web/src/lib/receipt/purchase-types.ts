import type { PurchaseDetail } from '@/lib/supabase/purchases';
import { paymentMethodLabel, receiptFilename } from '@/lib/receipt/types';
import {
  DEFAULT_BUSINESS_NAME,
  DEFAULT_TAGLINE,
  loadSettingsPreferences,
} from '@/lib/settings/preferences';

export type PurchaseReceiptLine = {
  productName: string;
  quantity: number;
  unitLabel: string;
  unitCost: string;
  lineTotal: string;
};

export type PurchaseReceiptPayment = {
  paidAt: string;
  method: string;
  methodLabel: string;
  amount: string;
  reference: string | null;
};

/** Localized labels for print / PDF (built with t() in the UI). */
export type PurchaseReceiptLabels = {
  documentTitle: string;
  purchaseReference: string;
  date: string;
  supplier: string;
  statusHeading: string;
  paymentStatusHeading: string;
  items: string;
  product: string;
  quantity: string;
  unit: string;
  unitCost: string;
  lineTotal: string;
  subtotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentHistory: string;
  paymentMethod: string;
  cancelledBanner: string;
};

/**
 * Purchase document view-model from stored purchase / purchase_items /
 * purchase_payments only — never live product catalog prices.
 */
export type PurchaseReceiptData = {
  businessName: string;
  tagline: string;
  businessPhone: string;
  businessAddress: string;
  reference: string;
  purchaseDate: string;
  supplierName: string;
  supplierPhone: string | null;
  supplierEmail: string | null;
  supplierAddress: string | null;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  isCancelled: boolean;
  items: PurchaseReceiptLine[];
  subtotal: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  payments: PurchaseReceiptPayment[];
  labels: PurchaseReceiptLabels;
};

export function purchaseReceiptFilename(reference: string): string {
  return receiptFilename(reference);
}

export function toPurchaseReceiptData(options: {
  purchase: PurchaseDetail;
  labels: PurchaseReceiptLabels;
  statusLabel: string;
  paymentStatusLabel: string;
  unitLabel: string;
  /** Override payment method display (for i18n). Defaults to English labels. */
  methodLabel?: (method: string) => string;
}): PurchaseReceiptData {
  const {
    purchase,
    labels,
    statusLabel,
    paymentStatusLabel,
    unitLabel,
    methodLabel = paymentMethodLabel,
  } = options;
  const prefs =
    typeof window !== 'undefined'
      ? loadSettingsPreferences()
      : {
          businessName: DEFAULT_BUSINESS_NAME,
          tagline: DEFAULT_TAGLINE,
          businessPhone: '',
          businessAddress: '',
        };

  return {
    businessName: prefs.businessName.trim() || DEFAULT_BUSINESS_NAME,
    tagline: prefs.tagline.trim() || DEFAULT_TAGLINE,
    businessPhone: prefs.businessPhone?.trim() || '',
    businessAddress: prefs.businessAddress?.trim() || '',
    reference: purchase.reference,
    purchaseDate: purchase.purchaseDate,
    supplierName: purchase.supplierName,
    supplierPhone: purchase.supplierPhone,
    supplierEmail: purchase.supplierEmail,
    supplierAddress: purchase.supplierAddress,
    status: purchase.status,
    statusLabel,
    paymentStatus: purchase.paymentStatus,
    paymentStatusLabel,
    isCancelled: purchase.status === 'CANCELLED',
    items: purchase.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitLabel,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
    })),
    subtotal: purchase.subtotal,
    totalAmount: purchase.totalAmount,
    amountPaid: purchase.amountPaid,
    amountDue: purchase.amountDue,
    payments: purchase.payments.map((p) => ({
      paidAt: p.paidAt,
      method: p.method,
      methodLabel: methodLabel(String(p.method)),
      amount: p.amount,
      reference: p.reference,
    })),
    labels,
  };
}
