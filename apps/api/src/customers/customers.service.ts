import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney } from '../common/utils/money';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapCustomer(customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    isWalkIn: boolean;
    account: {
      totalPurchases: { toString(): string };
      totalPaid: { toString(): string };
      outstandingBalance: { toString(): string };
    } | null;
  }) {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      isWalkIn: customer.isWalkIn,
      totalPurchases: formatMoney(customer.account?.totalPurchases.toString() ?? '0'),
      totalPaid: formatMoney(customer.account?.totalPaid.toString() ?? '0'),
      outstandingBalance: formatMoney(customer.account?.outstandingBalance.toString() ?? '0'),
    };
  }

  async findAll(search?: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        isActive: true,
        isWalkIn: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { account: true },
      orderBy: { name: 'asc' },
    });
    return customers.map((c) => this.mapCustomer(c));
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { phone, isActive: true },
      include: { account: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.mapCustomer(customer);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.mapCustomer(customer);
  }

  async create(dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
        isWalkIn: dto.isWalkIn ?? false,
        account: { create: {} },
      },
      include: { account: true },
    });
    return this.mapCustomer(customer);
  }

  async getLedger(customerId: string) {
    await this.findOne(customerId);
    const [account, transactions, sales, payments] = await Promise.all([
      this.prisma.customerAccount.findUnique({ where: { customerId } }),
      this.prisma.customerTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.findMany({
        where: { customerId, status: 'COMPLETED' },
        orderBy: { soldAt: 'desc' },
        take: 50,
      }),
      this.prisma.payment.findMany({
        where: { customerId },
        orderBy: { paidAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      account: {
        totalPurchases: formatMoney(account?.totalPurchases.toString() ?? '0'),
        totalPaid: formatMoney(account?.totalPaid.toString() ?? '0'),
        outstandingBalance: formatMoney(account?.outstandingBalance.toString() ?? '0'),
      },
      ledger: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: formatMoney(t.amount.toString()),
        balanceAfter: formatMoney(t.balanceAfter.toString()),
        reference: t.reference,
        notes: t.notes,
        createdAt: t.createdAt.toISOString(),
      })),
      sales,
      payments,
    };
  }
}
