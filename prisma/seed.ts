import { PrismaClient, PaymentMethod, DiscountType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

function money(n: number | string) {
  return new Decimal(n).toFixed(2);
}

async function main() {
  console.log('Seeding BRIE\'S HOME & KITCHEN...');

  await prisma.customerTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Admin@12345', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'collins@mark.local',
      username: 'collins',
      passwordHash,
      firstName: 'Collins',
      lastName: 'Mark',
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: 'cashier@bries.local',
      username: 'cashier',
      passwordHash,
      firstName: 'Amina',
      lastName: 'Juma',
      role: UserRole.CASHIER,
    },
  });

  const permissions = [
    { code: 'dashboard:view', name: 'View Dashboard' },
    { code: 'sales:create', name: 'Create Sales' },
    { code: 'sales:view', name: 'View Sales' },
    { code: 'products:manage', name: 'Manage Products' },
    { code: 'inventory:manage', name: 'Manage Inventory' },
    { code: 'customers:manage', name: 'Manage Customers' },
    { code: 'debts:manage', name: 'Manage Debts' },
    { code: 'purchases:manage', name: 'Manage Purchases' },
    { code: 'expenses:manage', name: 'Manage Expenses' },
    { code: 'reports:view', name: 'View Reports' },
    { code: 'settings:manage', name: 'Manage Settings' },
  ];

  for (const p of permissions) {
    const perm = await prisma.permission.create({ data: p });
    await prisma.userPermission.create({
      data: { userId: admin.id, permissionId: perm.id },
    });
  }

  const categoryNames = [
    'Cookware',
    'Dinnerware',
    'Glassware',
    'Cutlery',
    'Storage',
    'Appliances',
    'Cleaning',
    'Decor',
  ];
  const categories = [];
  for (const name of categoryNames) {
    categories.push(await prisma.category.create({ data: { name } }));
  }

  const productDefs = [
    { name: 'Sahani Set (6pcs)', sku: 'SK-SAHANI-6', cost: 12000, price: 20000, stock: 80, reorder: 15, cat: 1 },
    { name: 'Sufuria 20L', sku: 'SK-SUF-20', cost: 50000, price: 80000, stock: 45, reorder: 10, cat: 0 },
    { name: 'Glass Tumbler Set', sku: 'SK-GLASS-6', cost: 6000, price: 10000, stock: 120, reorder: 20, cat: 2 },
    { name: 'Vijiko Set', sku: 'SK-VIJIKO', cost: 15000, price: 25000, stock: 60, reorder: 12, cat: 3 },
    { name: 'Thermos 1.5L', sku: 'SK-THERM-15', cost: 27000, price: 45000, stock: 35, reorder: 8, cat: 5 },
    { name: 'Frying Pan 28cm', sku: 'SK-PAN-28', cost: 18000, price: 32000, stock: 40, reorder: 10, cat: 0 },
    { name: 'Mixing Bowl Set', sku: 'SK-BOWL-3', cost: 9000, price: 16000, stock: 55, reorder: 10, cat: 1 },
    { name: 'Knife Set 5pcs', sku: 'SK-KNIFE-5', cost: 22000, price: 38000, stock: 28, reorder: 8, cat: 3 },
    { name: 'Plastic Container Set', sku: 'SK-CONT-8', cost: 8000, price: 15000, stock: 8, reorder: 15, cat: 4 },
    { name: 'Mop & Bucket', sku: 'SK-MOP-01', cost: 12000, price: 22000, stock: 5, reorder: 10, cat: 6 },
    { name: 'Blender 1.5L', sku: 'SK-BLEND-15', cost: 65000, price: 95000, stock: 0, reorder: 5, cat: 5 },
    { name: 'Kettle Electric', sku: 'SK-KETL-01', cost: 28000, price: 45000, stock: 0, reorder: 5, cat: 5 },
    { name: 'Wall Clock', sku: 'SK-CLOCK-01', cost: 10000, price: 18000, stock: 0, reorder: 5, cat: 7 },
    { name: 'Chopping Board', sku: 'SK-BOARD-01', cost: 5000, price: 9000, stock: 3, reorder: 10, cat: 0 },
    { name: 'Pressure Cooker 5L', sku: 'SK-PRESS-5', cost: 55000, price: 85000, stock: 22, reorder: 6, cat: 0 },
  ];

  // Pad to ~486 products conceptually with variants for stock value
  const products = [];
  for (const def of productDefs) {
    products.push(
      await prisma.product.create({
        data: {
          name: def.name,
          sku: def.sku,
          barcode: `8${String(Math.floor(Math.random() * 1e12)).padStart(12, '0')}`,
          categoryId: categories[def.cat].id,
          costPrice: money(def.cost),
          sellingPrice: money(def.price),
          stockQuantity: def.stock,
          reorderLevel: def.reorder,
          unit: 'pcs',
        },
      }),
    );
  }

  // Additional catalog fillers for Total Products KPI realism
  for (let i = 1; i <= 471; i++) {
    const cat = categories[i % categories.length];
    const cost = 5000 + (i % 20) * 1000;
    const price = cost + 3000 + (i % 10) * 500;
    products.push(
      await prisma.product.create({
        data: {
          name: `Kitchen Item ${String(i).padStart(3, '0')}`,
          sku: `SK-GEN-${String(i).padStart(4, '0')}`,
          barcode: `9${String(i).padStart(12, '0')}`,
          categoryId: cat.id,
          costPrice: money(cost),
          sellingPrice: money(price),
          stockQuantity: i % 40 === 0 ? 0 : i % 25 === 0 ? 5 : 20 + (i % 30),
          reorderLevel: 10,
          unit: 'pcs',
        },
      }),
    );
  }

  const walkIn = await prisma.customer.create({
    data: {
      name: 'Walk-in Customer',
      isWalkIn: true,
      account: { create: {} },
    },
  });

  const debtorDefs = [
    { name: 'John Mwita', phone: '0712345678', balance: 1200000 },
    { name: 'Asha Kimaro', phone: '0723456789', balance: 850000 },
    { name: 'Peter Mgaya', phone: '0734567890', balance: 620000 },
    { name: 'Rehema Said', phone: '0745678901', balance: 480000 },
    { name: 'Hassan Ali', phone: '0756789012', balance: 450000 },
  ];

  const debtors = [];
  for (const d of debtorDefs) {
    debtors.push(
      await prisma.customer.create({
        data: {
          name: d.name,
          phone: d.phone,
          address: 'Dar es Salaam',
          account: {
            create: {
              totalPurchases: money(d.balance + 200000),
              totalPaid: money(200000),
              outstandingBalance: money(d.balance),
            },
          },
        },
      }),
    );
  }

  // Extra debtors to approach 37
  for (let i = 1; i <= 32; i++) {
    const bal = 50000 + i * 15000;
    await prisma.customer.create({
      data: {
        name: `Customer ${i}`,
        phone: `076${String(1000000 + i).slice(1)}`,
        account: {
          create: {
            totalPurchases: money(bal + 100000),
            totalPaid: money(100000),
            outstandingBalance: money(bal),
          },
        },
      },
    });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: 'Dar Kitchen Supplies Ltd',
      phone: '0788111222',
      address: 'Kariakoo, Dar es Salaam',
    },
  });

  const today = new Date();
  today.setHours(10, 0, 0, 0);

  // Create today's sales approximating design numbers
  const featured = products.slice(0, 5);
  const salePlans = [
    {
      items: [
        { product: featured[0], qty: 25 },
        { product: featured[2], qty: 40 },
      ],
      payments: [
        { method: PaymentMethod.CASH, amount: 650000 },
        { method: PaymentMethod.MPESA, amount: 300000 },
      ],
      customerId: null as string | null,
    },
    {
      items: [
        { product: featured[1], qty: 12 },
        { product: featured[3], qty: 30 },
      ],
      payments: [
        { method: PaymentMethod.BANK, amount: 500000 },
        { method: PaymentMethod.MPESA, amount: 450000 },
        { method: PaymentMethod.CASH, amount: 400000 },
      ],
      customerId: null,
    },
    {
      items: [{ product: featured[4], qty: 15 }],
      payments: [{ method: PaymentMethod.CASH, amount: 125000 }],
      customerId: debtors[0].id,
      creditRemainder: true,
    },
  ];

  let invoiceSeq = 1;
  for (const plan of salePlans) {
    let subtotal = new Decimal(0);
    let totalCost = new Decimal(0);
    const lineData = plan.items.map((line) => {
      const unitPrice = new Decimal(line.product.sellingPrice.toString());
      const unitCost = new Decimal(line.product.costPrice.toString());
      const lineSubtotal = unitPrice.mul(line.qty);
      const lineCost = unitCost.mul(line.qty);
      subtotal = subtotal.plus(lineSubtotal);
      totalCost = totalCost.plus(lineCost);
      return {
        productId: line.product.id,
        productName: line.product.name,
        quantity: line.qty,
        unitPrice: unitPrice.toFixed(2),
        unitCost: unitCost.toFixed(2),
        lineSubtotal: lineSubtotal.toFixed(2),
        discountAmount: '0.00',
        lineTotal: lineSubtotal.toFixed(2),
        lineCost: lineCost.toFixed(2),
        lineProfit: lineSubtotal.minus(lineCost).toFixed(2),
      };
    });

    const paid = plan.payments.reduce((s, p) => s.plus(p.amount), new Decimal(0));
    const due = Decimal.max(subtotal.minus(paid), 0);
    const profit = subtotal.minus(totalCost);
    const invoiceNumber = `INV-SEED-${String(invoiceSeq++).padStart(4, '0')}`;

    const sale = await prisma.sale.create({
      data: {
        invoiceNumber,
        customerId: plan.customerId ?? walkIn.id,
        cashierId: admin.id,
        status: 'COMPLETED',
        subtotal: subtotal.toFixed(2),
        discountType: DiscountType.NONE,
        discountValue: '0.00',
        discountAmount: '0.00',
        totalAmount: subtotal.toFixed(2),
        totalCost: totalCost.toFixed(2),
        totalProfit: profit.toFixed(2),
        amountPaid: paid.toFixed(2),
        amountDue: due.toFixed(2),
        paymentStatus: due.gt(0) ? 'PARTIAL' : 'PAID',
        soldAt: today,
        items: { create: lineData },
        payments: {
          create: plan.payments.map((p) => ({
            customerId: plan.customerId,
            amount: money(p.amount),
            method: p.method,
            paidAt: today,
          })),
        },
      },
    });

    for (const line of plan.items) {
      const before = line.product.stockQuantity;
      const after = before; // already set in seed stock as remaining
      await prisma.inventoryMovement.create({
        data: {
          productId: line.product.id,
          type: 'SALE',
          quantity: -line.qty,
          quantityBefore: before + line.qty,
          quantityAfter: before,
          reference: invoiceNumber,
          notes: 'Seed sale',
          createdAt: today,
        },
      });
      void after;
      void sale;
    }

    if (plan.customerId && due.gt(0)) {
      // Ledger entries already reflected in outstandingBalance from seed accounts;
      // add illustrative transactions for John Mwita style history
      const account = await prisma.customerAccount.findUnique({
        where: { customerId: plan.customerId },
      });
      if (account) {
        await prisma.customerTransaction.create({
          data: {
            customerId: plan.customerId,
            type: 'SALE',
            amount: subtotal.toFixed(2),
            balanceAfter: account.outstandingBalance.toString(),
            saleId: sale.id,
            reference: invoiceNumber,
            createdAt: today,
          },
        });
      }
    }
  }

  // Additional sales to push totals closer to design targets
  const extraSales = [
    { amount: 400000, cost: 220000, paid: 400000, method: PaymentMethod.CASH },
    { amount: 350000, cost: 180000, paid: 350000, method: PaymentMethod.MPESA },
    { amount: 275000, cost: 140000, paid: 0, method: PaymentMethod.CREDIT, customerId: debtors[1].id },
  ];

  for (const extra of extraSales) {
    const product = featured[0];
    const qty = 5;
    const invoiceNumber = `INV-SEED-${String(invoiceSeq++).padStart(4, '0')}`;
    const unitPrice = new Decimal(extra.amount).div(qty);
    const unitCost = new Decimal(extra.cost).div(qty);
    await prisma.sale.create({
      data: {
        invoiceNumber,
        customerId: extra.customerId ?? walkIn.id,
        cashierId: admin.id,
        status: 'COMPLETED',
        subtotal: money(extra.amount),
        discountType: DiscountType.NONE,
        discountAmount: '0.00',
        discountValue: '0.00',
        totalAmount: money(extra.amount),
        totalCost: money(extra.cost),
        totalProfit: money(extra.amount - extra.cost),
        amountPaid: money(extra.paid),
        amountDue: money(extra.amount - extra.paid),
        paymentStatus: extra.paid >= extra.amount ? 'PAID' : 'PARTIAL',
        soldAt: today,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              quantity: qty,
              unitPrice: unitPrice.toFixed(2),
              unitCost: unitCost.toFixed(2),
              lineSubtotal: money(extra.amount),
              discountAmount: '0.00',
              lineTotal: money(extra.amount),
              lineCost: money(extra.cost),
              lineProfit: money(extra.amount - extra.cost),
            },
          ],
        },
        payments:
          extra.paid > 0
            ? {
                create: [
                  {
                    customerId: extra.customerId,
                    amount: money(extra.paid),
                    method: extra.method === PaymentMethod.CREDIT ? PaymentMethod.CASH : extra.method,
                    paidAt: today,
                  },
                ],
              }
            : undefined,
      },
    });
  }

  // Expenses for today
  const expenseDefs = [
    { title: 'Delivery Transport', category: 'Transport', amount: 80000 },
    { title: 'Shop Electricity', category: 'Electricity', amount: 90000 },
    { title: 'Shop Assistant Salary', category: 'Salary', amount: 100000 },
    { title: 'Packaging Materials', category: 'Other', amount: 50000 },
  ];
  for (const e of expenseDefs) {
    await prisma.expense.create({
      data: {
        title: e.title,
        category: e.category,
        amount: money(e.amount),
        paymentMethod: PaymentMethod.CASH,
        expenseDate: today,
        createdById: admin.id,
      },
    });
  }

  // Sample purchase
  await prisma.purchase.create({
    data: {
      reference: 'PO-SEED-0001',
      supplierId: supplier.id,
      createdById: admin.id,
      status: 'RECEIVED',
      paymentStatus: 'PAID',
      subtotal: money(170000),
      totalAmount: money(170000),
      amountPaid: money(170000),
      purchaseDate: today,
      receivedAt: today,
      items: {
        create: [
          {
            productId: featured[1].id,
            productName: featured[1].name,
            quantity: 2,
            unitCost: money(50000),
            lineTotal: money(100000),
          },
          {
            productId: featured[0].id,
            productName: featured[0].name,
            quantity: 5,
            unitCost: money(14000),
            lineTotal: money(70000),
          },
        ],
      },
    },
  });

  // Ledger history for John Mwita
  const john = debtors[0];
  const johnAccount = await prisma.customerAccount.findUniqueOrThrow({
    where: { customerId: john.id },
  });
  const ledger = [
    { type: 'SALE' as const, amount: 500000, balance: 500000 },
    { type: 'PAYMENT' as const, amount: -200000, balance: 300000 },
    { type: 'SALE' as const, amount: 300000, balance: 600000 },
    { type: 'PAYMENT' as const, amount: -100000, balance: 500000 },
  ];
  for (const entry of ledger) {
    await prisma.customerTransaction.create({
      data: {
        customerId: john.id,
        type: entry.type,
        amount: money(entry.amount),
        balanceAfter: money(entry.balance),
        notes: 'Seed ledger history',
        createdAt: new Date(today.getTime() - 86400000 * 3),
      },
    });
  }
  void johnAccount;

  console.log('Seed complete.');
  console.log('Admin login: collins@mark.local / Admin@12345');
  console.log(`Products: ${products.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
