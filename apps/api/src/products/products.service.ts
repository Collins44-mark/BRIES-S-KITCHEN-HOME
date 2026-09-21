import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney } from '../common/utils/money';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapProduct<T extends {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    categoryId: string;
    costPrice: Prisma.Decimal;
    sellingPrice: Prisma.Decimal;
    stockQuantity: number;
    reorderLevel: number;
    unit: string;
    status: string;
    category?: { name: string };
  }>(product: T) {
    let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
    if (product.stockQuantity <= 0) stockStatus = 'OUT_OF_STOCK';
    else if (product.stockQuantity <= product.reorderLevel) stockStatus = 'LOW_STOCK';

    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: product.category?.name,
      costPrice: formatMoney(product.costPrice.toString()),
      sellingPrice: formatMoney(product.sellingPrice.toString()),
      stockQuantity: product.stockQuantity,
      reorderLevel: product.reorderLevel,
      unit: product.unit,
      status: product.status,
      stockStatus,
    };
  }

  async findAll(search?: string, categoryId?: string) {
    const products = await this.prisma.product.findMany({
      where: {
        status: { not: 'DISCONTINUED' },
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => this.mapProduct(p));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.mapProduct(product);
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        stockQuantity: dto.stockQuantity ?? 0,
        reorderLevel: dto.reorderLevel ?? 10,
        unit: dto.unit ?? 'pcs',
      },
      include: { category: true },
    });
    return this.mapProduct(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        costPrice: dto.costPrice !== undefined ? dto.costPrice : undefined,
        sellingPrice: dto.sellingPrice !== undefined ? dto.sellingPrice : undefined,
      },
      include: { category: true },
    });
    return this.mapProduct(product);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { status: 'DISCONTINUED' },
    });
    return { success: true };
  }
}
