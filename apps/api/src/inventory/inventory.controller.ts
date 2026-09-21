import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  overview() {
    return this.inventory.getOverview();
  }

  @Get('movements')
  movements(@Query('productId') productId?: string) {
    return this.inventory.getMovements(productId);
  }

  @Post('adjust')
  adjust(@Body() dto: AdjustInventoryDto) {
    return this.inventory.adjust(dto);
  }
}
