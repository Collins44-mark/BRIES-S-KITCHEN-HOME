import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal, formatMoney, money } from '../common/utils/money';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto) {
    if (!dto.customerId && !dto.saleId) {
      throw new BadRequestException('Payment requires customerId or saleId');
    }
    if (dto.method === PaymentMethod.CREDIT) {
      throw new BadRequestException('Cannot record CREDIT as a receipt payment');
    }

    return this.prisma.$transaction(async (tx) => {
      const amount = money(dto.amount);
      const payment = await tx.payment.create({
        data: {
          customerId: dto.customerId,
          saleId: dto.saleId,
          amount: amount.toFixed(2),
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
        },
      });

      if (dto.saleId) {
        const sale = await tx.sale.findUnique({ where: { id: dto.saleId } });
        if (!sale) throw new NotFoundException('Sale not found');
        const newPaid = money(sale.amountPaid.toString()).plus(amount);
        const newDue = money(sale.totalAmount.toString()).minus(newPaid);
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            amountPaid: newPaid.toFixed(2),
            amountDue: Decimal.max(newDue, 0).toFixed(2),
            paymentStatus: newDue.lte(0) ? 'PAID' : 'PARTIAL',
          },
        });
      }

      if (dto.customerId) {
        await this.applyCustomerPayment(tx, {
          customerId: dto.customerId,
          paymentId: payment.id,
          amount,
          reference: dto.reference,
        });
      }

      return {
        id: payment.id,
        amount: formatMoney(payment.amount.toString()),
        method: payment.method,
        paidAt: payment.paidAt.toISOString(),
      };
    });
  }

  private async applyCustomerPayment(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      paymentId: string;
      amount: Decimal;
      reference?: string;
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

    const balance = money(account.outstandingBalance.toString()).minus(params.amount);
    const totalPaid = money(account.totalPaid.toString()).plus(params.amount);

    await tx.customerTransaction.create({
      data: {
        customerId: params.customerId,
        type: 'PAYMENT',
        amount: params.amount.neg().toFixed(2),
        balanceAfter: Decimal.max(balance, 0).toFixed(2),
        paymentId: params.paymentId,
        reference: params.reference,
        notes: 'Debt payment',
      },
    });

    await tx.customerAccount.update({
      where: { customerId: params.customerId },
      data: {
        totalPaid: totalPaid.toFixed(2),
        outstandingBalance: Decimal.max(balance, 0).toFixed(2),
      },
    });
  }
}
