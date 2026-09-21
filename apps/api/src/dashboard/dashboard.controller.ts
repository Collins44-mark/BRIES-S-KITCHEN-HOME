import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DateRangePreset } from '@bries/types';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(
    @Query('preset') preset?: DateRangePreset,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.getSummary(preset ?? 'today', from, to);
  }
}
