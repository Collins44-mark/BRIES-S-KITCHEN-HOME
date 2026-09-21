import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { Decimal, formatMoney, money } from '../common/utils/money';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  findAll() {
    return this.prisma.purchase.findMany({
      include: {
        supplier: true,
        items: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { purchaseDate: 'desc' },
    });
  }

  async create(userId: string, dto: CreatePurchaseDto) {
    if (!dto.items?.length) throw new BadRequestException('Purchase needs items');

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: dto.items.map((i) => i.productId) } },
      });
      if (products.length !== dto.items.length) {
        throw new BadRequestException('Invalid products in purchase');
      }
      const map = new Map(products.map((p) => [p.id, p]));

      const lines = dto.items.map((item) => {
        const product = map.get(item.productId)!;
        const unitCost = money(item.unitCost);
        const lineTotal = money(unitCost.mul(item.quantity));
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitCost,
          lineTotal,
        };
      });

      const totalAmount = money(lines.reduce((s, l) => s.plus(l.lineTotal), new Decimal(0)));
      const count = await tx.purchase.count();
      const reference = dto.reference || `PO-${Date.now()}-${count + 1}`;

      const purchase = await tx.purchase.create({
        data: {
          reference,
          supplierId: dto.supplierId,
          createdById: userId,
          status: 'RECEIVED',
          paymentStatus: dto.paymentStatus ?? 'PAID',
          subtotal: totalAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          amountPaid: money(dto.amountPaid ?? totalAmount.toNumber()).toFixed(2),
          notes: dto.notes,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
          receivedAt: new Date(),
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              quantity: l.quantity,
              unitCost: l.unitCost.toFixed(2),
              lineTotal: l.lineTotal.toFixed(2),
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      for (const line of lines) {
        await this.inventory.applyMovement(tx, {
          productId: line.productId,
          type: 'PURCHASE',
          quantityDelta: line.quantity,
          unitCost: line.unitCost.toFixed(2),
          reference,
          notes: `Purchase ${reference}`,
        });

        await tx.product.update({
          where: { id: line.productId },
          data: { costPrice: line.unitCost.toFixed(2) },
        });
      }

      return {
        ...purchase,
        totalAmount: formatMoney(purchase.totalAmount.toString()),
      };
    });
  }

  listSuppliers() {
    return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  createSupplier(data: { name: string; phone?: string; email?: string; address?: string }) {
    return this.prisma.supplier.create({ data });
  }
}
