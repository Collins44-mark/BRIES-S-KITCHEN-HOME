import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DateRangePreset } from '@bries/types';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthRequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expenses.findAll(preset, from, to);
  }

  @Post()
  create(@CurrentUser() user: AuthRequestUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.id, dto);
  }
}
