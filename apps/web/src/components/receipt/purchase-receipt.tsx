'use client';

import { formatTzs } from '@/lib/utils';
import type { PurchaseReceiptData } from '@/lib/receipt/purchase-types';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Open a print-only A4 window for a purchase receipt.
 * Same pattern as printSaleReceipt — do not use noopener/noreferrer.
 */
export function printPurchaseReceipt(data: PurchaseReceiptData): void {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) {
    throw new Error(
      'Unable to open print window. Please allow pop-ups for this site.',
    );
  }

  const L = data.labels;
  const e = escapeHtml;

  const supplierContact = [
    data.supplierPhone,
    data.supplierEmail,
    data.supplierAddress,
  ]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => e(v))
    .join('<br/>');

  const businessMeta = [
    data.tagline,
    data.businessPhone,
    data.businessAddress,
  ]
    .filter((v) => Boolean(v?.trim()))
    .map((v) => e(v))
    .join(' · ');

  const cancelledBanner = data.isCancelled
    ? `<div class="cancelled">${e(L.cancelledBanner)}</div>`
    : '';

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td>${e(item.productName)}</td>
        <td>${e(String(item.quantity))}</td>
        <td>${e(item.unitLabel)}</td>
        <td>${e(formatTzs(item.unitCost))}</td>
        <td class="right">${e(formatTzs(item.lineTotal))}</td>
      </tr>`,
    )
    .join('');

  const paymentsHtml =
    data.payments.length === 0
      ? ''
      : `
    <h2 class="section">${e(L.paymentHistory)}</h2>
    <table>
      <thead>
        <tr>
          <th>${e(L.date)}</th>
          <th>${e(L.paymentMethod)}</th>
          <th class="right">${e(L.amountPaid)}</th>
        </tr>
      </thead>
      <tbody>
        ${data.payments
          .map(
            (p) => `
          <tr>
            <td>${e(formatDateTime(p.paidAt))}</td>
            <td>${e(p.methodLabel)}</td>
            <td class="right">${e(formatTzs(p.amount))}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${e(L.documentTitle)} ${e(data.reference)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    .doc { max-width: 720px; margin: 0 auto; width: 100%; }
    h1 { font-size: 20px; margin: 0; text-align: center; line-height: 1.2; }
    .sub { text-align: center; color: #64748b; font-size: 12px; margin-top: 4px; }
    .title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; margin: 14px 0 0; color: #0f172a; }
    .cancelled {
      margin-top: 12px; text-align: center; font-size: 18px; font-weight: 800;
      letter-spacing: 0.12em; color: #be123c;
      border: 2px solid #be123c; padding: 8px; border-radius: 6px;
    }
    .meta { margin-top: 14px; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 13px; }
    .meta dt { color: #64748b; }
    .meta dd { margin: 0; text-align: right; font-weight: 500; word-break: break-word; }
    .section { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
      color: #94a3b8; margin: 18px 0 8px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8;
      border-bottom: 1px solid #e2e8f0; padding: 8px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; word-break: break-word; }
    .right { text-align: right; }
    .totals { margin-top: 12px; font-size: 13px; }
    .row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
    .bold { font-weight: 700; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <h1>${e(data.businessName)}</h1>
    ${businessMeta ? `<p class="sub">${businessMeta}</p>` : ''}
    <p class="title">${e(L.documentTitle)}</p>
    ${cancelledBanner}
    <dl class="meta">
      <dt>${e(L.purchaseReference)}</dt><dd>${e(data.reference)}</dd>
      <dt>${e(L.date)}</dt><dd>${e(formatDateTime(data.purchaseDate))}</dd>
      <dt>${e(L.supplier)}</dt><dd>${e(data.supplierName)}${
        supplierContact ? `<div class="sub" style="text-align:right;margin-top:2px">${supplierContact}</div>` : ''
      }</dd>
      <dt>${e(L.statusHeading)}</dt><dd>${e(data.statusLabel)}</dd>
      <dt>${e(L.paymentStatusHeading)}</dt><dd>${e(data.paymentStatusLabel)}</dd>
    </dl>
    <h2 class="section">${e(L.items)}</h2>
    <table>
      <thead>
        <tr>
          <th>${e(L.product)}</th>
          <th>${e(L.quantity)}</th>
          <th>${e(L.unit)}</th>
          <th>${e(L.unitCost)}</th>
          <th class="right">${e(L.lineTotal)}</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>${e(L.subtotal)}</span><span>${e(formatTzs(data.subtotal))}</span></div>
      <div class="row bold"><span>${e(L.total)}</span><span>${e(formatTzs(data.totalAmount))}</span></div>
      <div class="row"><span>${e(L.amountPaid)}</span><span>${e(formatTzs(data.amountPaid))}</span></div>
      <div class="row bold"><span>${e(L.amountDue)}</span><span>${e(formatTzs(data.amountDue))}</span></div>
    </div>
    ${paymentsHtml}
  </div>
</body>
</html>`);
  w.document.close();

  w.focus();
  requestAnimationFrame(() => {
    setTimeout(() => {
      w.focus();
      w.print();
    }, 0);
  });
}
