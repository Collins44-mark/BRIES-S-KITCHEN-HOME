import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DateRangePreset } from '@bries/types';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.sales(preset, from, to);
  }

  @Get('profit')
  profit(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.profit(preset, from, to);
  }

  @Get('expenses')
  expenses(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.expenses(preset, from, to);
  }

  @Get('inventory')
  inventory() {
    return this.reports.inventory();
  }

  @Get('debts')
  debts() {
    return this.reports.debts();
  }

  @Get('payments')
  payments(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.payments(preset, from, to);
  }

  @Get('purchases')
  purchases(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.purchases(preset, from, to);
  }
}
