'use client';

import { formatTzs } from '@/lib/utils';
import {
  formatReceiptLineBaseHint,
  formatReceiptLineQuantity,
  paymentMethodLabel,
  type ReceiptLayout,
  type ReceiptLine,
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
  /** screen = preview; a4 = paper; thermal58 / thermal80 = thermal printers. */
  layout?: ReceiptLayout;
  className?: string;
  id?: string;
};

function layoutClassName(layout: ReceiptLayout): string {
  switch (layout) {
    case 'thermal58':
      return 'receipt-thermal receipt-thermal-58 max-w-[58mm] text-[10px]';
    case 'thermal80':
      return 'receipt-thermal receipt-thermal-80 max-w-[80mm] text-[11px]';
    case 'a4':
      return 'receipt-a4 max-w-[210mm]';
    default:
      return 'receipt-screen max-w-lg';
  }
}

function isThermal(layout: ReceiptLayout): boolean {
  return layout === 'thermal58' || layout === 'thermal80';
}

/**
 * Reusable BRIE'S HOME & KITCHEN sale receipt.
 * Renders stored sale values only — no catalog / product_units recalculation.
 */
export function SaleReceipt({
  data,
  layout = 'screen',
  className = '',
  id,
}: SaleReceiptProps) {
  const thermal = isThermal(layout);

  const showCashExtras =
    data.cashReceived != null &&
    Number(data.cashReceived) > 0 &&
    (data.payments.some((p) => p.method === 'CASH') || Number(data.changeDue) > 0);

  return (
    <article
      id={id}
      data-receipt-layout={layout}
      className={`receipt-root mx-auto w-full bg-white text-slate-800 ${layoutClassName(layout)} ${className}`}
    >
      <header
        className={`border-b border-slate-200 pb-3 text-center ${thermal ? 'pb-2' : ''}`}
      >
        <h1
          className={`font-bold tracking-tight text-slate-900 ${
            thermal ? 'text-sm leading-tight' : 'text-lg'
          }`}
        >
          BRIE&apos;S HOME &amp; KITCHEN
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">Sale Receipt</p>
      </header>

      <dl
        className={`mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 ${
          thermal ? 'mt-2 text-[10px] leading-snug' : 'text-sm'
        }`}
      >
        <dt className="text-slate-500">Invoice</dt>
        <dd className="text-right font-semibold break-all">{data.invoiceNumber}</dd>
        <dt className="text-slate-500">Date</dt>
        <dd className="text-right">{formatDateTime(data.soldAt)}</dd>
        <dt className="text-slate-500">Cashier</dt>
        <dd className="text-right break-words">{data.cashierName}</dd>
        <dt className="text-slate-500">Customer</dt>
        <dd className="text-right break-words">{data.customerName}</dd>
      </dl>

      {thermal ? (
        <ul className="mt-3 space-y-2 border-t border-slate-200 pt-2">
          {data.items.map((item, idx) => (
            <ReceiptItemBlock key={`${item.productName}-${idx}`} item={item} compact />
          ))}
        </ul>
      ) : (
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
            {data.items.map((item, idx) => {
              const qtyLabel = formatReceiptLineQuantity(item);
              const baseHint = formatReceiptLineBaseHint(item);
              return (
                <tr key={`${item.productName}-${idx}`} className="border-b border-slate-50 align-top">
                  <td className="py-2 pr-2 font-medium text-slate-800 break-words">
                    {item.productName}
                  </td>
                  <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">
                    <span className="block">{qtyLabel}</span>
                    {baseHint ? (
                      <span className="block text-[10px] text-slate-400">{baseHint}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">
                    {formatTzs(item.unitPrice)}
                  </td>
                  <td className="py-2 text-right text-slate-800 whitespace-nowrap">
                    {formatTzs(item.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div
        className={`mt-3 space-y-1 border-t border-slate-200 pt-3 ${
          thermal ? 'mt-2 pt-2 text-[10px]' : 'text-sm'
        }`}
      >
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span>{formatTzs(data.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Discount</span>
          <span>-{formatTzs(data.discountAmount)}</span>
        </div>
        <div
          className={`flex justify-between font-semibold text-slate-900 ${
            thermal ? 'text-[11px]' : 'text-base'
          }`}
        >
          <span>Total</span>
          <span>{formatTzs(data.totalAmount)}</span>
        </div>
      </div>

      <div
        className={`mt-3 space-y-1 border-t border-slate-100 pt-3 ${
          thermal ? 'mt-2 pt-2 text-[10px]' : 'text-sm'
        }`}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Payment
        </p>
        {data.payments.length === 0 ? (
          <p className="text-slate-500">No payment recorded</p>
        ) : (
          data.payments.map((p, idx) => (
            <div key={`${p.method}-${idx}`} className="flex justify-between text-slate-600">
              <span className="break-words pr-2">
                {paymentMethodLabel(p.method)}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
              <span className="shrink-0">{formatTzs(p.amount)}</span>
            </div>
          ))
        )}
        <div className="flex justify-between font-medium text-slate-800">
          <span>Paid</span>
          <span>{formatTzs(data.amountPaid)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Due</span>
          <span>{formatTzs(data.amountDue)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Status</span>
          <span className="font-medium">{data.paymentStatus}</span>
        </div>
      </div>

      {showCashExtras && (
        <div
          className={`mt-3 space-y-1 border-t border-dashed border-slate-200 pt-3 ${
            thermal ? 'mt-2 pt-2 text-[10px]' : 'text-sm'
          }`}
        >
          <div className="flex justify-between text-slate-600">
            <span>Cash tendered</span>
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

      <footer
        className={`mt-5 border-t border-slate-100 pt-3 text-center italic text-slate-500 ${
          thermal ? 'mt-3 pt-2 text-[9px]' : 'text-xs'
        }`}
      >
        Thank you for shopping at BRIE&apos;S HOME &amp; KITCHEN.
      </footer>
    </article>
  );
}

function ReceiptItemBlock({ item, compact }: { item: ReceiptLine; compact?: boolean }) {
  const qtyLabel = formatReceiptLineQuantity(item);
  const baseHint = formatReceiptLineBaseHint(item);
  return (
    <li className={`border-b border-slate-50 pb-2 last:border-0 ${compact ? '' : ''}`}>
      <p className="font-medium text-slate-800 break-words leading-snug">{item.productName}</p>
      <p className="mt-0.5 text-slate-700">{qtyLabel}</p>
      <p className="text-slate-500">
        @ {formatTzs(item.unitPrice)}
      </p>
      <p className="font-medium text-slate-800">= {formatTzs(item.lineTotal)}</p>
      {baseHint ? <p className="text-[9px] text-slate-400">{baseHint}</p> : null}
    </li>
  );
}

/** Open a print-only window (hides app chrome). A4 or thermal widths. */
export function printSaleReceipt(
  data: SaleReceiptData,
  layout: ReceiptLayout = 'a4',
): void {
  // Do not use noopener/noreferrer: Chromium opens a blank tab but returns null
  // (or a non-writable handle), so document.write never reaches the visible window.
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) {
    throw new Error(
      'Unable to open print window. Please allow pop-ups for this site.',
    );
  }

  const escape = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const thermal = isThermal(layout);
  const maxWidth =
    layout === 'thermal58' ? '58mm' : layout === 'thermal80' ? '80mm' : '720px';
  const pageSize =
    layout === 'thermal58'
      ? '58mm auto'
      : layout === 'thermal80'
        ? '80mm auto'
        : 'A4';

  const itemsHtml = data.items
    .map((item) => {
      const qtyLabel = escape(formatReceiptLineQuantity(item));
      const baseHint = formatReceiptLineBaseHint(item);
      const baseHtml = baseHint
        ? `<div class="hint">${escape(baseHint)}</div>`
        : '';
      if (thermal) {
        return `
      <div class="item">
        <div class="name">${escape(item.productName)}</div>
        <div>${qtyLabel}</div>
        <div class="muted">@ ${escape(formatTzs(item.unitPrice))}</div>
        <div class="bold">= ${escape(formatTzs(item.lineTotal))}</div>
        ${baseHtml}
      </div>`;
      }
      return `
      <tr>
        <td>${escape(item.productName)}</td>
        <td>
          <div>${qtyLabel}</div>
          ${baseHtml}
        </td>
        <td>${escape(formatTzs(item.unitPrice))}</td>
        <td class="right">${escape(formatTzs(item.lineTotal))}</td>
      </tr>`;
    })
    .join('');

  const paymentsHtml =
    data.payments.length === 0
      ? `<div class="row"><span>Payment</span><span>—</span></div>`
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
      <div class="row"><span>Cash tendered</span><span>${escape(formatTzs(data.cashReceived))}</span></div>
      ${
        data.changeDue != null && Number(data.changeDue) > 0
          ? `<div class="row bold"><span>Change</span><span>${escape(formatTzs(data.changeDue))}</span></div>`
          : ''
      }`
      : '';

  const bodyItems = thermal
    ? `<div class="items">${itemsHtml}</div>`
    : `<table>
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th class="right">Total</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>`;

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
      padding: ${thermal ? '4mm' : '24px'};
      background: #fff;
    }
    .receipt { max-width: ${maxWidth}; margin: 0 auto; width: 100%; }
    h1 { font-size: ${thermal ? '13px' : '20px'}; margin: 0; text-align: center; line-height: 1.2; }
    .sub { text-align: center; color: #64748b; font-size: ${thermal ? '10px' : '12px'}; margin-top: 4px; }
    .meta { margin-top: 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: ${thermal ? '10px' : '13px'}; }
    .meta dt { color: #64748b; }
    .meta dd { margin: 0; text-align: right; font-weight: 500; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding: 8px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; word-break: break-word; }
    .right { text-align: right; }
    .totals { margin-top: 10px; font-size: ${thermal ? '10px' : '13px'}; }
    .row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .bold { font-weight: 700; }
    .hint { font-size: ${thermal ? '9px' : '10px'}; color: #94a3b8; }
    .muted { color: #64748b; }
    .items { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .item { padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 10px; page-break-inside: avoid; break-inside: avoid; }
    .item .name { font-weight: 600; word-break: break-word; }
    .thanks { margin-top: 16px; text-align: center; font-size: ${thermal ? '9px' : '12px'}; color: #64748b; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print {
      body { padding: ${thermal ? '2mm' : '0'}; }
      @page { margin: ${thermal ? '2mm' : '12mm'}; size: ${pageSize}; }
    }
  </style>
</head>
<body>
  <div class="receipt" data-receipt-layout="${escape(layout)}">
    <h1>BRIE'S HOME &amp; KITCHEN</h1>
    <p class="sub">Sale Receipt</p>
    <dl class="meta">
      <dt>Invoice</dt><dd>${escape(data.invoiceNumber)}</dd>
      <dt>Date</dt><dd>${escape(formatDateTime(data.soldAt))}</dd>
      <dt>Cashier</dt><dd>${escape(data.cashierName)}</dd>
      <dt>Customer</dt><dd>${escape(data.customerName)}</dd>
    </dl>
    ${bodyItems}
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${escape(formatTzs(data.subtotal))}</span></div>
      <div class="row"><span>Discount</span><span>-${escape(formatTzs(data.discountAmount))}</span></div>
      <div class="row bold"><span>Total</span><span>${escape(formatTzs(data.totalAmount))}</span></div>
      ${paymentsHtml}
      <div class="row bold"><span>Paid</span><span>${escape(formatTzs(data.amountPaid))}</span></div>
      <div class="row"><span>Due</span><span>${escape(formatTzs(data.amountDue))}</span></div>
      <div class="row"><span>Status</span><span>${escape(data.paymentStatus)}</span></div>
      ${cashHtml}
    </div>
    <p class="thanks">Thank you for shopping at BRIE'S HOME &amp; KITCHEN.</p>
  </div>
</body>
</html>`);
  w.document.close();

  // Trigger print from the opener after write/close. Do not rely only on
  // window.onload inside the popup — the document may already be complete.
  // Keep the window open; let the browser print dialog control lifecycle.
  w.focus();
  requestAnimationFrame(() => {
    setTimeout(() => {
      w.focus();
      w.print();
    }, 0);
  });
}
