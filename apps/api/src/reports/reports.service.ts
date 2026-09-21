import { Injectable } from '@nestjs/common';
import { DateRangePreset } from '@bries/types';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDateRange } from '../common/utils/date-range';
import { Decimal, formatMoney, money } from '../common/utils/money';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(preset: DateRangePreset = 'today', from?: string, to?: string) {
    const range = resolveDateRange(preset, from, to);
    const sales = await this.prisma.sale.findMany({
      where: { status: 'COMPLETED', soldAt: { gte: range.from, lte: range.to } },
      include: {
        customer: { select: { name: true, phone: true } },
        items: true,
        payments: true,
      },
      orderBy: { soldAt: 'desc' },
    });
    const total = money(
      sales.reduce((s, sale) => s.plus(sale.totalAmount.toString()), new Decimal(0)),
    );
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      total: formatMoney(total),
      count: sales.length,
      rows: sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customer: s.customer?.name ?? 'Walk-in',
        totalAmount: formatMoney(s.totalAmount.toString()),
        totalProfit: formatMoney(s.totalProfit.toString()),
        paymentStatus: s.paymentStatus,
        soldAt: s.soldAt.toISOString(),
      })),
    };
  }

  async profit(preset: DateRangePreset = 'today', from?: string, to?: string) {
    const salesReport = await this.sales(preset, from, to);
    const range = resolveDateRange(preset, from, to);
    const sales = await this.prisma.sale.findMany({
      where: { status: 'COMPLETED', soldAt: { gte: range.from, lte: range.to } },
    });
    const revenue = money(
      sales.reduce((s, sale) => s.plus(sale.totalAmount.toString()), new Decimal(0)),
    );
    const cogs = money(
      sales.reduce((s, sale) => s.plus(sale.totalCost.toString()), new Decimal(0)),
    );
    const grossProfit = money(revenue.minus(cogs));
    return {
      ...salesReport,
      revenue: formatMoney(revenue),
      costOfGoodsSold: formatMoney(cogs),
      grossProfit: formatMoney(grossProfit),
    };
  }

  async expenses(preset: DateRangePreset = 'today', from?: string, to?: string) {
    const range = resolveDateRange(preset, from, to);
    const expenses = await this.prisma.expense.findMany({
      where: { expenseDate: { gte: range.from, lte: range.to } },
      orderBy: { expenseDate: 'desc' },
    });
    const total = money(
      expenses.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0)),
    );
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      total: formatMoney(total),
      rows: expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: formatMoney(e.amount.toString()),
        paymentMethod: e.paymentMethod,
        expenseDate: e.expenseDate.toISOString(),
      })),
    };
  }

  async inventory() {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return {
      rows: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        stockQuantity: p.stockQuantity,
        reorderLevel: p.reorderLevel,
        costPrice: formatMoney(p.costPrice.toString()),
        sellingPrice: formatMoney(p.sellingPrice.toString()),
        stockValue: formatMoney(money(p.costPrice.toString()).mul(p.stockQuantity)),
        stockStatus:
          p.stockQuantity <= 0
            ? 'OUT_OF_STOCK'
            : p.stockQuantity <= p.reorderLevel
              ? 'LOW_STOCK'
              : 'IN_STOCK',
      })),
    };
  }

  async debts() {
    const accounts = await this.prisma.customerAccount.findMany({
      where: { outstandingBalance: { gt: 0 } },
      include: { customer: true },
      orderBy: { outstandingBalance: 'desc' },
    });
    const total = money(
      accounts.reduce((s, a) => s.plus(a.outstandingBalance.toString()), new Decimal(0)),
    );
    return {
      total: formatMoney(total),
      rows: accounts.map((a) => ({
        customerId: a.customerId,
        name: a.customer.name,
        phone: a.customer.phone,
        outstandingBalance: formatMoney(a.outstandingBalance.toString()),
        totalPurchases: formatMoney(a.totalPurchases.toString()),
        totalPaid: formatMoney(a.totalPaid.toString()),
      })),
    };
  }

  async payments(preset: DateRangePreset = 'today', from?: string, to?: string) {
    const range = resolveDateRange(preset, from, to);
    const payments = await this.prisma.payment.findMany({
      where: { paidAt: { gte: range.from, lte: range.to } },
      include: { customer: true, sale: true },
      orderBy: { paidAt: 'desc' },
    });
    const total = money(
      payments.reduce((s, p) => s.plus(p.amount.toString()), new Decimal(0)),
    );
    return {
      total: formatMoney(total),
      rows: payments.map((p) => ({
        id: p.id,
        amount: formatMoney(p.amount.toString()),
        method: p.method,
        customer: p.customer?.name ?? null,
        invoice: p.sale?.invoiceNumber ?? null,
        paidAt: p.paidAt.toISOString(),
      })),
    };
  }

  async purchases(preset: DateRangePreset = 'today', from?: string, to?: string) {
    const range = resolveDateRange(preset, from, to);
    const purchases = await this.prisma.purchase.findMany({
      where: { purchaseDate: { gte: range.from, lte: range.to } },
      include: { supplier: true, items: true },
      orderBy: { purchaseDate: 'desc' },
    });
    const total = money(
      purchases.reduce((s, p) => s.plus(p.totalAmount.toString()), new Decimal(0)),
    );
    return {
      total: formatMoney(total),
      rows: purchases.map((p) => ({
        id: p.id,
        reference: p.reference,
        supplier: p.supplier.name,
        totalAmount: formatMoney(p.totalAmount.toString()),
        status: p.status,
        paymentStatus: p.paymentStatus,
        purchaseDate: p.purchaseDate.toISOString(),
      })),
    };
  }
}
