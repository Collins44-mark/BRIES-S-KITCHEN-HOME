import { jsPDF } from 'jspdf';
import { formatTzs } from '@/lib/utils';
import {
  purchaseReceiptFilename,
  type PurchaseReceiptData,
} from '@/lib/receipt/purchase-types';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Client-side A4 PDF from stored purchase values only.
 */
export async function downloadPurchaseReceiptPdf(
  data: PurchaseReceiptData,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginX = 18;
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;
  const L = data.labels;

  const line = (
    text: string,
    opts?: { bold?: boolean; size?: number; color?: [number, number, number]; align?: 'left' | 'center' },
  ) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 10);
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(30, 41, 59);
    const x = opts?.align === 'center' ? pageWidth / 2 : marginX;
    doc.text(text, x, y, opts?.align === 'center' ? { align: 'center' } : undefined);
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

  line(data.businessName, { bold: true, size: 16, align: 'center' });
  if (data.tagline) {
    line(data.tagline, { size: 10, color: [100, 116, 139], align: 'center' });
  }
  if (data.businessPhone || data.businessAddress) {
    const meta = [data.businessPhone, data.businessAddress].filter(Boolean).join(' · ');
    line(meta, { size: 9, color: [100, 116, 139], align: 'center' });
  }
  y += 2;
  line(L.documentTitle, { bold: true, size: 12, align: 'center' });

  if (data.isCancelled) {
    y += 2;
    doc.setDrawColor(190, 18, 60);
    doc.setTextColor(190, 18, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(L.cancelledBanner, pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  row(L.purchaseReference, data.reference, true);
  row(L.date, formatDateTime(data.purchaseDate));
  row(L.supplier, data.supplierName);
  if (data.supplierPhone) row('', data.supplierPhone);
  if (data.supplierEmail) row('', data.supplierEmail);
  if (data.supplierAddress) {
    const addrLines = doc.splitTextToSize(data.supplierAddress, contentWidth * 0.55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(addrLines, pageWidth - marginX, y, { align: 'right' });
    y += Math.max(6, addrLines.length * 5);
  }
  row(L.statusHeading, data.statusLabel);
  row(L.paymentStatusHeading, data.paymentStatusLabel);
  y += 2;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(L.product, marginX, y);
  doc.text(L.quantity, marginX + contentWidth * 0.42, y);
  doc.text(L.unitCost, marginX + contentWidth * 0.58, y);
  doc.text(L.lineTotal, pageWidth - marginX, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(241, 245, 249);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  for (const item of data.items) {
    ensureSpace(18);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(item.productName, contentWidth * 0.4);
    doc.text(nameLines, marginX, y);

    doc.setFont('helvetica', 'normal');
    doc.text(`${item.quantity} ${item.unitLabel}`, marginX + contentWidth * 0.42, y);
    doc.text(formatTzs(item.unitCost), marginX + contentWidth * 0.58, y);
    doc.text(formatTzs(item.lineTotal), pageWidth - marginX, y, { align: 'right' });
    y += Math.max(nameLines.length * 5, 6) + 3;
    doc.setDrawColor(248, 250, 252);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  }

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  row(L.subtotal, formatTzs(data.subtotal));
  row(L.total, formatTzs(data.totalAmount), true);
  row(L.amountPaid, formatTzs(data.amountPaid));
  row(L.amountDue, formatTzs(data.amountDue), true);

  if (data.payments.length > 0) {
    y += 4;
    ensureSpace(20);
    line(L.paymentHistory, { bold: true, size: 11, color: [100, 116, 139] });
    y += 2;
    for (const p of data.payments) {
      ensureSpace(10);
      row(
        `${formatDateTime(p.paidAt)} — ${p.methodLabel}`,
        formatTzs(p.amount),
      );
    }
  }

  doc.save(purchaseReceiptFilename(data.reference));
}
