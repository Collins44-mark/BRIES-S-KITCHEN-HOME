import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney } from '../common/utils/money';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { resolveDateRange } from '../common/utils/date-range';
import { DateRangePreset } from '@bries/types';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(preset: DateRangePreset = 'this_month', from?: string, to?: string) {
    const range = resolveDateRange(preset, from, to);
    const expenses = await this.prisma.expense.findMany({
      where: { expenseDate: { gte: range.from, lte: range.to } },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { expenseDate: 'desc' },
    });
    return expenses.map((e) => ({
      ...e,
      amount: formatMoney(e.amount.toString()),
    }));
  }

  async create(userId: string, dto: CreateExpenseDto) {
    const expense = await this.prisma.expense.create({
      data: {
        title: dto.title,
        category: dto.category,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod ?? 'CASH',
        description: dto.description,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        createdById: userId,
      },
    });
    return { ...expense, amount: formatMoney(expense.amount.toString()) };
  }
}
