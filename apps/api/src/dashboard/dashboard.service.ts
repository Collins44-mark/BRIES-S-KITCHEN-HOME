import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { DateRangePreset, DashboardSummary } from '@bries/types';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDateRange } from '../common/utils/date-range';
import { Decimal, formatMoney, money } from '../common/utils/money';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    preset: DateRangePreset = 'today',
    from?: string,
    to?: string,
  ): Promise<DashboardSummary> {
    const range = resolveDateRange(preset, from, to);

    const [
      sales,
      previousSales,
      products,
      categoriesCount,
      debtAccounts,
      expenses,
      purchasesInRange,
      payments,
      saleItems,
    ] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', soldAt: { gte: range.from, lte: range.to } },
        include: { items: true, payments: true },
      }),
      this.prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          soldAt: { gte: range.previousFrom, lte: range.previousTo },
        },
      }),
      this.prisma.product.findMany({ where: { status: 'ACTIVE' } }),
      this.prisma.category.count({ where: { isActive: true } }),
      this.prisma.customerAccount.findMany({
        where: { outstandingBalance: { gt: 0 } },
        include: { customer: true },
        orderBy: { outstandingBalance: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { expenseDate: { gte: range.from, lte: range.to } },
      }),
      this.prisma.purchase.findMany({
        where: {
          status: 'RECEIVED',
          purchaseDate: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          paidAt: { gte: range.from, lte: range.to },
          method: { not: 'CREDIT' },
        },
      }),
      this.prisma.saleItem.findMany({
        where: {
          sale: { status: 'COMPLETED', soldAt: { gte: range.from, lte: range.to } },
        },
      }),
    ]);

    const totalSales = money(
      sales.reduce((s, sale) => s.plus(sale.totalAmount.toString()), new Decimal(0)),
    );
    const totalProfit = money(
      sales.reduce((s, sale) => s.plus(sale.totalProfit.toString()), new Decimal(0)),
    );
    const previousTotalSales = money(
      previousSales.reduce((s, sale) => s.plus(sale.totalAmount.toString()), new Decimal(0)),
    );
    const previousTotalProfit = money(
      previousSales.reduce((s, sale) => s.plus(sale.totalProfit.toString()), new Decimal(0)),
    );

    const creditSales = money(
      sales.reduce((s, sale) => s.plus(sale.amountDue.toString()), new Decimal(0)),
    );
    const amountCollected = money(totalSales.minus(creditSales));

    const salesChangePercent = previousTotalSales.gt(0)
      ? Number(
          totalSales.minus(previousTotalSales).div(previousTotalSales).mul(100).toFixed(0),
        )
      : null;
    const profitChangePercent = previousTotalProfit.gt(0)
      ? Number(
          totalProfit.minus(previousTotalProfit).div(previousTotalProfit).mul(100).toFixed(0),
        )
      : null;

    const collectedPercentOfSales = totalSales.gt(0)
      ? Number(amountCollected.div(totalSales).mul(100).toFixed(0))
      : 0;
    const creditPercentOfSales = totalSales.gt(0)
      ? Number(creditSales.div(totalSales).mul(100).toFixed(0))
      : 0;

    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalStockValue = new Decimal(0);
    for (const p of products) {
      if (p.stockQuantity <= 0) outOfStock += 1;
      else if (p.stockQuantity <= p.reorderLevel) lowStock += 1;
      else inStock += 1;
      totalStockValue = totalStockValue.plus(
        money(p.costPrice.toString()).mul(p.stockQuantity),
      );
    }

    const outstandingDebts = money(
      debtAccounts.reduce(
        (s, a) => s.plus(a.outstandingBalance.toString()),
        new Decimal(0),
      ),
    );

    const expensesTotal = money(
      expenses.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0)),
    );
    const purchasesStock = money(
      purchasesInRange.reduce((s, p) => s.plus(p.totalAmount.toString()), new Decimal(0)),
    );

    const itemsSold = saleItems.reduce((s, i) => s + i.quantity, 0);

    // Top selling products
    const productAgg = new Map<
      string,
      { productId: string; productName: string; qty: number; revenue: Decimal; profit: Decimal }
    >();
    for (const item of saleItems) {
      const existing = productAgg.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        qty: 0,
        revenue: new Decimal(0),
        profit: new Decimal(0),
      };
      existing.qty += item.quantity;
      existing.revenue = existing.revenue.plus(item.lineTotal.toString());
      existing.profit = existing.profit.plus(item.lineProfit.toString());
      productAgg.set(item.productId, existing);
    }
    const topSellingProducts = Array.from(productAgg.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((p, index) => ({
        rank: index + 1,
        productId: p.productId,
        productName: p.productName,
        quantitySold: p.qty,
        revenue: formatMoney(p.revenue),
        profit: formatMoney(p.profit),
      }));

    // Payment methods — include credit from amountDue on sales
    const methodTotals: Record<string, Decimal> = {
      CASH: new Decimal(0),
      MPESA: new Decimal(0),
      BANK: new Decimal(0),
      CREDIT: creditSales,
    };
    for (const payment of payments) {
      methodTotals[payment.method] = (methodTotals[payment.method] ?? new Decimal(0)).plus(
        payment.amount.toString(),
      );
    }
    // Also count sale payments in range that aren't double-counted if we queried Payment table
    // Credit already from amountDue. Collected methods from Payment table.
    const methodSum = Object.values(methodTotals).reduce((s, v) => s.plus(v), new Decimal(0));
    const paymentMethods = (Object.keys(methodTotals) as PaymentMethod[]).map((method) => {
      const amount = money(methodTotals[method]);
      const percent = methodSum.gt(0)
        ? Number(amount.div(methodSum).mul(100).toFixed(0))
        : 0;
      return { method, amount: formatMoney(amount), percent };
    });

    const topDebtors = debtAccounts.slice(0, 5).map((a, index) => ({
      rank: index + 1,
      customerId: a.customerId,
      name: a.customer.name,
      outstandingBalance: formatMoney(a.outstandingBalance.toString()),
    }));

    return {
      totalSales: formatMoney(totalSales),
      totalProfit: formatMoney(totalProfit),
      amountCollected: formatMoney(amountCollected),
      creditSales: formatMoney(creditSales),
      salesChangePercent,
      profitChangePercent,
      collectedPercentOfSales,
      creditPercentOfSales,
      totalProducts: products.length,
      categoryCount: categoriesCount,
      lowStockItems: lowStock,
      outOfStockItems: outOfStock,
      outstandingDebts: formatMoney(outstandingDebts),
      debtorsCount: debtAccounts.length,
      expensesTotal: formatMoney(expensesTotal),
      expensesCount: expenses.length,
      itemsSold,
      topSellingProducts,
      stockStatus: {
        inStock,
        lowStock,
        outOfStock,
        totalStockValue: formatMoney(totalStockValue),
      },
      paymentMethods,
      expensesSummary: {
        totalExpenses: formatMoney(expensesTotal),
        purchasesStock: formatMoney(purchasesStock),
        otherExpenses: formatMoney(expensesTotal),
      },
      topDebtors,
    };
  }
}
