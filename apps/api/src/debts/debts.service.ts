import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney } from '../common/utils/money';

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const accounts = await this.prisma.customerAccount.findMany({
      where: { outstandingBalance: { gt: 0 } },
      include: { customer: true },
      orderBy: { outstandingBalance: 'desc' },
    });

    const total = accounts.reduce(
      (sum, a) => sum + Number(a.outstandingBalance.toString()),
      0,
    );

    return {
      totalOutstanding: formatMoney(total),
      debtorsCount: accounts.length,
      debtors: accounts.map((a, index) => ({
        rank: index + 1,
        customerId: a.customerId,
        name: a.customer.name,
        phone: a.customer.phone,
        outstandingBalance: formatMoney(a.outstandingBalance.toString()),
        totalPurchases: formatMoney(a.totalPurchases.toString()),
        totalPaid: formatMoney(a.totalPaid.toString()),
      })),
    };
  }
}
