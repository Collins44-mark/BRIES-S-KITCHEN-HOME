'use client';

import { formatTzs } from '@/lib/utils';
import {
  paymentMethodLabel,
  type ReceiptLayout,
  type SaleReceiptData,
} from '@/lib/receipt/types';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type SaleReceiptProps = {
  data: SaleReceiptData;
  /** screen = on-screen preview; a4 = print paper; thermal = future 58/80mm. */
  layout?: ReceiptLayout;
  className?: string;
  /** Used as print/PDF root id when needed. */
  id?: string;
};

/**
 * Reusable BRIE'S HOME & KITCHEN sale receipt.
 * Renders stored sale values only — no catalog price recalculation.
 */
export function SaleReceipt({
  data,
  layout = 'screen',
  className = '',
  id,
}: SaleReceiptProps) {
  const layoutClass =
    layout === 'thermal'
      ? 'receipt-thermal max-w-[80mm] text-[11px]'
      : layout === 'a4'
        ? 'receipt-a4 max-w-[210mm]'
        : 'receipt-screen max-w-lg';

  const showCashExtras =
    data.cashReceived != null &&
    Number(data.cashReceived) > 0 &&
    (data.payments.some((p) => p.method === 'CASH') || Number(data.changeDue) > 0);

  return (
    <article
      id={id}
      data-receipt-layout={layout}
      className={`receipt-root mx-auto w-full bg-white text-slate-800 ${layoutClass} ${className}`}
    >
      <header className="border-b border-slate-200 pb-3 text-center">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          BRIE&apos;S HOME &amp; KITCHEN
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">Sale Receipt</p>
      </header>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Invoice</dt>
        <dd className="text-right font-semibold">{data.invoiceNumber}</dd>
        <dt className="text-slate-500">Date</dt>
        <dd className="text-right">{formatDateTime(data.soldAt)}</dd>
        <dt className="text-slate-500">Cashier</dt>
        <dd className="text-right">{data.cashierName}</dd>
        <dt className="text-slate-500">Customer</dt>
        <dd className="text-right">{data.customerName}</dd>
      </dl>

      <table className="mt-4 w-full border-t border-slate-200 text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 pr-2 font-medium">Qty</th>
            <th className="py-2 pr-2 font-medium">Price</th>
            <th className="py-2 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={`${item.productName}-${idx}`} className="border-b border-slate-50">
              <td className="py-2 pr-2 font-medium text-slate-800">{item.productName}</td>
              <td className="py-2 pr-2 text-slate-600">{item.quantity}</td>
              <td className="py-2 pr-2 text-slate-600">{formatTzs(item.unitPrice)}</td>
              <td className="py-2 text-right text-slate-800">{formatTzs(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span>{formatTzs(data.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Discount</span>
          <span>-{formatTzs(data.discountAmount)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-slate-900">
          <span>Total</span>
          <span>{formatTzs(data.totalAmount)}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Payment method(s)
        </p>
        {data.payments.length === 0 ? (
          <p className="text-slate-500">No payment recorded</p>
        ) : (
          data.payments.map((p, idx) => (
            <div key={`${p.method}-${idx}`} className="flex justify-between text-slate-600">
              <span>
                {paymentMethodLabel(p.method)}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
              <span>{formatTzs(p.amount)}</span>
            </div>
          ))
        )}
        <div className="flex justify-between font-medium text-slate-800">
          <span>Amount paid</span>
          <span>{formatTzs(data.amountPaid)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Amount due</span>
          <span>{formatTzs(data.amountDue)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Payment status</span>
          <span className="font-medium">{data.paymentStatus}</span>
        </div>
      </div>

      {showCashExtras && (
        <div className="mt-3 space-y-1 border-t border-dashed border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Cash received</span>
            <span>{formatTzs(data.cashReceived!)}</span>
          </div>
          {data.changeDue != null && Number(data.changeDue) > 0 && (
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Change</span>
              <span>{formatTzs(data.changeDue)}</span>
            </div>
          )}
        </div>
      )}

      <footer className="mt-5 border-t border-slate-100 pt-3 text-center text-xs italic text-slate-500">
        Thank you for shopping at BRIE&apos;S HOME &amp; KITCHEN.
      </footer>
    </article>
  );
}

/** Open a print-only window (hides app chrome). Suitable for A4; thermal-ready structure. */
export function printSaleReceipt(data: SaleReceiptData): void {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!w) {
    throw new Error('Pop-up blocked. Allow pop-ups to print the receipt.');
  }

  const escape = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td>${escape(item.productName)}</td>
        <td>${item.quantity}</td>
        <td>${escape(formatTzs(item.unitPrice))}</td>
        <td class="right">${escape(formatTzs(item.lineTotal))}</td>
      </tr>`,
    )
    .join('');

  const paymentsHtml =
    data.payments.length === 0
      ? `<div class="row"><span>Payments</span><span>—</span></div>`
      : data.payments
          .map(
            (p) => `
        <div class="row">
          <span>${escape(paymentMethodLabel(p.method))}${
              p.reference ? ` · ${escape(p.reference)}` : ''
            }</span>
          <span>${escape(formatTzs(p.amount))}</span>
        </div>`,
          )
          .join('');

  const cashHtml =
    data.cashReceived != null && Number(data.cashReceived) > 0
      ? `
      <div class="row"><span>Cash received</span><span>${escape(formatTzs(data.cashReceived))}</span></div>
      ${
        data.changeDue != null && Number(data.changeDue) > 0
          ? `<div class="row bold"><span>Change</span><span>${escape(formatTzs(data.changeDue))}</span></div>`
          : ''
      }`
      : '';

  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escape(data.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    .receipt { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0; text-align: center; }
    .sub { text-align: center; color: #64748b; font-size: 12px; margin-top: 4px; }
    .meta { margin-top: 16px; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
    .meta dt { color: #64748b; }
    .meta dd { margin: 0; text-align: right; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding: 8px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; }
    .right { text-align: right; }
    .totals { margin-top: 12px; font-size: 13px; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; }
    .bold { font-weight: 700; }
    .thanks { margin-top: 24px; text-align: center; font-size: 12px; color: #64748b; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: A4; }
      /* Thermal-ready hook for later: body.thermal .receipt { max-width: 80mm; } */
    }
  </style>
</head>
<body>
  <div class="receipt" data-receipt-layout="a4">
    <h1>BRIE'S HOME &amp; KITCHEN</h1>
    <p class="sub">Sale Receipt</p>
    <dl class="meta">
      <dt>Invoice</dt><dd>${escape(data.invoiceNumber)}</dd>
      <dt>Date</dt><dd>${escape(formatDateTime(data.soldAt))}</dd>
      <dt>Cashier</dt><dd>${escape(data.cashierName)}</dd>
      <dt>Customer</dt><dd>${escape(data.customerName)}</dd>
    </dl>
    <table>
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th class="right">Total</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${escape(formatTzs(data.subtotal))}</span></div>
      <div class="row"><span>Discount</span><span>-${escape(formatTzs(data.discountAmount))}</span></div>
      <div class="row bold"><span>Total</span><span>${escape(formatTzs(data.totalAmount))}</span></div>
      ${paymentsHtml}
      <div class="row bold"><span>Amount paid</span><span>${escape(formatTzs(data.amountPaid))}</span></div>
      <div class="row"><span>Amount due</span><span>${escape(formatTzs(data.amountDue))}</span></div>
      <div class="row"><span>Payment status</span><span>${escape(data.paymentStatus)}</span></div>
      ${cashHtml}
    </div>
    <p class="thanks">Thank you for shopping at BRIE'S HOME &amp; KITCHEN.</p>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`);
  w.document.close();
}
