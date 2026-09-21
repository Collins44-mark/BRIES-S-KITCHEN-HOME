import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney } from '../common/utils/money';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
    });

    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalStockValue = new Prisma.Decimal(0);

    for (const p of products) {
      if (p.stockQuantity <= 0) outOfStock += 1;
      else if (p.stockQuantity <= p.reorderLevel) lowStock += 1;
      else inStock += 1;
      totalStockValue = totalStockValue.add(p.costPrice.mul(p.stockQuantity));
    }

    return {
      inStock,
      lowStock,
      outOfStock,
      totalStockValue: formatMoney(totalStockValue.toString()),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stockQuantity: p.stockQuantity,
        reorderLevel: p.reorderLevel,
        stockStatus:
          p.stockQuantity <= 0
            ? 'OUT_OF_STOCK'
            : p.stockQuantity <= p.reorderLevel
              ? 'LOW_STOCK'
              : 'IN_STOCK',
      })),
    };
  }

  getMovements(productId?: string) {
    return this.prisma.inventoryMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async adjust(dto: AdjustInventoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new BadRequestException('Product not found');

      const nextQty = product.stockQuantity + dto.quantity;
      if (nextQty < 0) throw new BadRequestException('Insufficient stock for adjustment');

      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: nextQty },
      });

      return tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: dto.type,
          quantity: dto.quantity,
          quantityBefore: product.stockQuantity,
          quantityAfter: nextQty,
          notes: dto.notes,
          reference: dto.reference,
        },
      });
    });
  }

  async applyMovement(
    tx: Prisma.TransactionClient,
    params: {
      productId: string;
      type: InventoryMovementType;
      quantityDelta: number;
      unitCost?: Prisma.Decimal | string | number;
      reference?: string;
      notes?: string;
    },
  ) {
    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) throw new BadRequestException('Product not found');

    const nextQty = product.stockQuantity + params.quantityDelta;
    if (nextQty < 0) {
      throw new BadRequestException(`Insufficient stock for ${product.name}`);
    }

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: nextQty },
    });

    return tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: params.type,
        quantity: params.quantityDelta,
        quantityBefore: product.stockQuantity,
        quantityAfter: nextQty,
        unitCost: params.unitCost !== undefined ? params.unitCost : undefined,
        reference: params.reference,
        notes: params.notes,
      },
    });
  }
}
