import { jsPDF } from 'jspdf';
import {
  REPORT_COLUMNS,
  REPORT_TITLES,
  formatReportCell,
  type ReportKey,
  type ReportSummaryItem,
} from '@/lib/reports/report-presentation';

type DownloadReportPdfInput = {
  tab: ReportKey;
  periodLabel: string;
  summaries: ReportSummaryItem[];
  rows: Array<Record<string, unknown>>;
};

function safeFilename(tab: ReportKey, periodLabel: string): string {
  const period = periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `BRIES-${tab}-report${period ? `-${period}` : ''}.pdf`;
}

/**
 * Client-side business PDF for the currently selected report + period.
 * Uses existing row data only — no recalculation.
 */
export async function downloadReportPdf(input: DownloadReportPdfInput): Promise<void> {
  const columns = REPORT_COLUMNS[input.tab];
  const wide = columns.length >= 6;
  const doc = new jsPDF({
    orientation: wide ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = 16;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      doc.addPage();
      y = 16;
      drawTableHeader();
    }
  };

  // Equal-ish column widths with a slight bias to text columns
  const colWidths = columns.map((col) => {
    if (col.kind === 'money') return 1.15;
    if (col.kind === 'datetime' || col.kind === 'date') return 1.25;
    if (col.kind === 'status' || col.kind === 'method') return 0.95;
    if (col.key === 'invoiceNumber' || col.key === 'invoice' || col.key === 'reference' || col.key === 'sku') {
      return 0.9;
    }
    return 1.2;
  });
  const weightSum = colWidths.reduce((a, b) => a + b, 0);
  const widths = colWidths.map((w) => (w / weightSum) * contentWidth);

  const drawTableHeader = () => {
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, y - 4, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let x = marginX;
    columns.forEach((col, i) => {
      const align = col.kind === 'money' || col.kind === 'number' ? 'right' : 'left';
      const textX = align === 'right' ? x + widths[i]! - 1 : x + 1;
      doc.text(col.label, textX, y, { align });
      x += widths[i]!;
    });
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("BRIE'S HOME & KITCHEN", marginX, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(REPORT_TITLES[input.tab], marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${input.periodLabel}`, marginX, y);
  y += 5;

  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // Summaries
  if (input.summaries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Summary', marginX, y);
    y += 5;

    const perRow = wide ? 3 : 2;
    for (let i = 0; i < input.summaries.length; i += perRow) {
      ensureSpace(8);
      const slice = input.summaries.slice(i, i + perRow);
      const cellW = contentWidth / perRow;
      slice.forEach((item, idx) => {
        const x = marginX + idx * cellW;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, x, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(item.value, x, y + 4);
      });
      y += 10;
    }
    y += 2;
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  }

  if (input.rows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No data available for this period.', marginX, y);
  } else {
    drawTableHeader();

    input.rows.forEach((row) => {
      ensureSpace(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      let x = marginX;
      let rowHeight = 5;
      const cells = columns.map((col, i) => {
        const text = formatReportCell(col.kind, row[col.key]);
        const maxW = widths[i]! - 2;
        const lines = doc.splitTextToSize(text, maxW) as string[];
        rowHeight = Math.max(rowHeight, lines.length * 3.4);
        return { lines, align: col.kind === 'money' || col.kind === 'number' ? 'right' : 'left' };
      });

      ensureSpace(rowHeight + 2);

      cells.forEach((cell, i) => {
        const textX = cell.align === 'right' ? x + widths[i]! - 1 : x + 1;
        doc.text(cell.lines, textX, y, { align: cell.align as 'left' | 'right' });
        x += widths[i]!;
      });

      y += rowHeight + 1.5;
      doc.setDrawColor(248, 250, 252);
      doc.line(marginX, y - 1, pageWidth - marginX, y - 1);
    });
  }

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  doc.save(safeFilename(input.tab, input.periodLabel));
}
