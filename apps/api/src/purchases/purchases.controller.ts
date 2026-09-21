import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthRequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get('suppliers')
  suppliers() {
    return this.purchases.listSuppliers();
  }

  @Post('suppliers')
  createSupplier(@Body() body: { name: string; phone?: string; email?: string; address?: string }) {
    return this.purchases.createSupplier(body);
  }

  @Get()
  findAll() {
    return this.purchases.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthRequestUser, @Body() dto: CreatePurchaseDto) {
    return this.purchases.create(user.id, dto);
  }
}
