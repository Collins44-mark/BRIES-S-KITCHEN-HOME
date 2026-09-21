import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { calculateSaleTotals } from '../common/utils/sale-calculator';
import { Decimal, formatMoney, money } from '../common/utils/money';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async findAll() {
    const sales = await this.prisma.sale.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        cashier: { select: { id: true, firstName: true, lastName: true } },
        items: true,
        payments: true,
      },
      orderBy: { soldAt: 'desc' },
      take: 100,
    });
    return sales.map((s) => this.mapSale(s));
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        cashier: { select: { id: true, firstName: true, lastName: true } },
        items: true,
        payments: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return this.mapSale(sale);
  }

  async create(cashierId: string, dto: CreateSaleDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Sale requires at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const productIds = dto.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, status: 'ACTIVE' },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException('One or more products not found');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      const lineInputs = dto.items.map((item) => {
        const product = productMap.get(item.productId)!;
        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${product.name}`);
        }
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.sellingPrice.toString(),
          unitCost: product.costPrice.toString(),
        };
      });

      const discountType = (dto.discountType ?? 'NONE') as DiscountType;
      const calc = calculateSaleTotals(lineInputs, {
        type: discountType,
        value: dto.discountValue ?? 0,
      });

      const payments = dto.payments ?? [];
      const totalPaid = money(
        payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0)),
      );
      const creditPayment = payments
        .filter((p) => p.method === 'CREDIT')
        .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));

      if (totalPaid.lt(calc.totalAmount) && creditPayment.eq(0) && !dto.customerId) {
        throw new BadRequestException('Incomplete payment requires a registered customer for credit');
      }

      if (totalPaid.lt(calc.totalAmount) && !dto.customerId) {
        throw new BadRequestException('Credit sales require a registered customer');
      }

      const amountDue = money(calc.totalAmount.minus(totalPaid));
      if (amountDue.gt(0) && !dto.customerId) {
        throw new BadRequestException('Outstanding balance requires a customer');
      }

      let paymentStatus: PaymentStatus = PaymentStatus.PAID;
      if (amountDue.gt(0) && totalPaid.gt(0)) paymentStatus = PaymentStatus.PARTIAL;
      if (amountDue.eq(calc.totalAmount)) paymentStatus = PaymentStatus.PENDING;
      if (amountDue.lte(0)) paymentStatus = PaymentStatus.PAID;

      const invoiceNumber = await this.nextInvoiceNumber(tx);

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: dto.customerId || null,
          cashierId,
          status: 'COMPLETED',
          subtotal: calc.subtotal.toFixed(2),
          discountType,
          discountValue: money(dto.discountValue ?? 0).toFixed(2),
          discountAmount: calc.discountAmount.toFixed(2),
          totalAmount: calc.totalAmount.toFixed(2),
          totalCost: calc.totalCost.toFixed(2),
          totalProfit: calc.totalProfit.toFixed(2),
          amountPaid: totalPaid.toFixed(2),
          amountDue: Decimal.max(amountDue, 0).toFixed(2),
          paymentStatus,
          notes: dto.notes,
          items: {
            create: calc.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              unitCost: item.unitCost.toFixed(2),
              lineSubtotal: item.lineSubtotal.toFixed(2),
              discountAmount: item.discountAmount.toFixed(2),
              lineTotal: item.lineTotal.toFixed(2),
              lineCost: item.lineCost.toFixed(2),
              lineProfit: item.lineProfit.toFixed(2),
            })),
          },
          payments: {
            create: payments.map((p) => ({
              customerId: dto.customerId || null,
              amount: money(p.amount).toFixed(2),
              method: p.method as PaymentMethod,
              reference: p.reference,
            })),
          },
        },
        include: { items: true, payments: true, customer: true },
      });

      for (const item of calc.items) {
        await this.inventory.applyMovement(tx, {
          productId: item.productId,
          type: 'SALE',
          quantityDelta: -item.quantity,
          unitCost: item.unitCost.toFixed(2),
          reference: invoiceNumber,
          notes: `Sale ${invoiceNumber}`,
        });
      }

      if (dto.customerId) {
        await this.updateCustomerLedgerForSale(tx, {
          customerId: dto.customerId,
          saleId: sale.id,
          invoiceNumber,
          saleTotal: calc.totalAmount,
          amountPaid: totalPaid,
        });
      }

      return this.mapSale(sale);
    });
  }

  private async updateCustomerLedgerForSale(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      saleId: string;
      invoiceNumber: string;
      saleTotal: Decimal;
      amountPaid: Decimal;
    },
  ) {
    let account = await tx.customerAccount.findUnique({
      where: { customerId: params.customerId },
    });
    if (!account) {
      account = await tx.customerAccount.create({
        data: { customerId: params.customerId },
      });
    }

    let balance = money(account.outstandingBalance.toString());
    const totalPurchases = money(account.totalPurchases.toString()).plus(params.saleTotal);
    let totalPaid = money(account.totalPaid.toString());

    // SALE increases outstanding balance
    balance = money(balance.plus(params.saleTotal));
    await tx.customerTransaction.create({
      data: {
        customerId: params.customerId,
        type: 'SALE',
        amount: params.saleTotal.toFixed(2),
        balanceAfter: balance.toFixed(2),
        reference: params.invoiceNumber,
        saleId: params.saleId,
        notes: `Credit/sale ${params.invoiceNumber}`,
      },
    });

    // Non-credit portion of payment reduces balance
    if (params.amountPaid.gt(0)) {
      balance = money(balance.minus(params.amountPaid));
      totalPaid = money(totalPaid.plus(params.amountPaid));
      await tx.customerTransaction.create({
        data: {
          customerId: params.customerId,
          type: 'PAYMENT',
          amount: params.amountPaid.neg().toFixed(2),
          balanceAfter: balance.toFixed(2),
          reference: params.invoiceNumber,
          saleId: params.saleId,
          notes: `Payment on ${params.invoiceNumber}`,
        },
      });
    }

    await tx.customerAccount.update({
      where: { customerId: params.customerId },
      data: {
        totalPurchases: totalPurchases.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        outstandingBalance: Decimal.max(balance, 0).toFixed(2),
      },
    });
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient) {
    const count = await tx.sale.count();
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `INV-${ymd}-${String(count + 1).padStart(5, '0')}`;
  }

  private mapSale(sale: {
    id: string;
    invoiceNumber: string;
    customerId: string | null;
    status: string;
    subtotal: { toString(): string };
    discountType: string;
    discountValue: { toString(): string };
    discountAmount: { toString(): string };
    totalAmount: { toString(): string };
    totalCost: { toString(): string };
    totalProfit: { toString(): string };
    amountPaid: { toString(): string };
    amountDue: { toString(): string };
    paymentStatus: string;
    soldAt: Date;
    notes: string | null;
    items?: Array<Record<string, unknown>>;
    payments?: Array<Record<string, unknown>>;
    customer?: { id: string; name: string; phone: string | null } | null;
    cashier?: { id: string; firstName: string; lastName: string } | null;
  }) {
    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerId: sale.customerId,
      customer: sale.customer ?? null,
      cashier: sale.cashier ?? null,
      status: sale.status,
      subtotal: formatMoney(sale.subtotal.toString()),
      discountType: sale.discountType,
      discountValue: formatMoney(sale.discountValue.toString()),
      discountAmount: formatMoney(sale.discountAmount.toString()),
      totalAmount: formatMoney(sale.totalAmount.toString()),
      totalCost: formatMoney(sale.totalCost.toString()),
      totalProfit: formatMoney(sale.totalProfit.toString()),
      amountPaid: formatMoney(sale.amountPaid.toString()),
      amountDue: formatMoney(sale.amountDue.toString()),
      paymentStatus: sale.paymentStatus,
      soldAt: sale.soldAt.toISOString(),
      notes: sale.notes,
      items: sale.items,
      payments: sale.payments,
    };
  }
}
