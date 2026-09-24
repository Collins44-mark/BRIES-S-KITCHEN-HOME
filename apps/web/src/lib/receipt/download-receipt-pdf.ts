import { jsPDF } from 'jspdf';
import { formatTzs } from '@/lib/utils';
import {
  formatReceiptLineBaseHint,
  formatReceiptLineQuantity,
  paymentMethodLabel,
  receiptFilename,
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

/**
 * Client-side A4 PDF from stored receipt values only.
 * Line qty/unit come from sale_items historical snapshots.
 */
export async function downloadSaleReceiptPdf(data: SaleReceiptData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginX = 18;
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;

  const line = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 10);
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(30, 41, 59);
    doc.text(text, marginX, y);
    y += (opts?.size ?? 10) * 0.45 + 2;
  };

  const row = (left: string, right: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(left, marginX, y);
    doc.text(right, pageWidth - marginX, y, { align: 'right' });
    y += 6;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  line("BRIE'S HOME & KITCHEN", { bold: true, size: 16 });
  line('Sale Receipt', { size: 11, color: [100, 116, 139] });
  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  row('Invoice', data.invoiceNumber, true);
  row('Date', formatDateTime(data.soldAt));
  row('Cashier', data.cashierName);
  row('Customer', data.customerName);
  y += 2;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Item', marginX, y);
  doc.text('Qty / Price', marginX + contentWidth * 0.48, y);
  doc.text('Total', pageWidth - marginX, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(241, 245, 249);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  for (const item of data.items) {
    ensureSpace(22);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(item.productName, contentWidth * 0.46);
    doc.text(nameLines, marginX, y);

    const qtyLabel = formatReceiptLineQuantity(item);
    const baseHint = formatReceiptLineBaseHint(item);
    const midX = marginX + contentWidth * 0.48;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(qtyLabel, midX, y);
    doc.text(formatTzs(item.lineTotal), pageWidth - marginX, y, { align: 'right' });

    let blockH = Math.max(nameLines.length * 5, 5);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`@ ${formatTzs(item.unitPrice)}`, midX, y);
    blockH += 4;
    y += 4;
    if (baseHint) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(baseHint, midX, y);
      blockH += 4;
      y += 4;
    }
    y += Math.max(2, 6 - (blockH > 10 ? 0 : 2));
    doc.setDrawColor(248, 250, 252);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  }

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  row('Subtotal', formatTzs(data.subtotal));
  row('Discount', `-${formatTzs(data.discountAmount)}`);
  row('Total', formatTzs(data.totalAmount), true);
  y += 2;

  if (data.payments.length === 0) {
    row('Payment', '—');
  } else {
    for (const p of data.payments) {
      const label = paymentMethodLabel(p.method);
      const ref = p.reference ? ` (${p.reference})` : '';
      row(label + ref, formatTzs(p.amount));
    }
  }

  row('Paid', formatTzs(data.amountPaid), true);
  row('Due', formatTzs(data.amountDue));
  row('Status', data.paymentStatus);

  if (data.cashReceived != null && Number(data.cashReceived) > 0) {
    y += 2;
    row('Cash tendered', formatTzs(data.cashReceived));
    if (data.changeDue != null && Number(data.changeDue) > 0) {
      row('Change', formatTzs(data.changeDue), true);
    }
  }

  y += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Thank you for shopping at BRIE'S HOME & KITCHEN.", pageWidth / 2, y, {
    align: 'center',
  });

  doc.save(receiptFilename(data.invoiceNumber));
}
