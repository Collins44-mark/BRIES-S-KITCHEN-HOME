/**
 * Production bootstrap seed — clears transactional data and creates only:
 * - One admin user (from env)
 * - Permission catalog + admin grants
 * - Walk-in customer (required for POS)
 *
 * Does NOT create fake products, sales, debts, expenses, or suppliers.
 *
 * Required env:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD  (min 8 chars)
 * Optional:
 *   SEED_ADMIN_USERNAME (default: admin)
 *   SEED_ADMIN_FIRST_NAME (default: Admin)
 *   SEED_ADMIN_LAST_NAME (default: User)
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || 'admin';
  const firstName = process.env.SEED_ADMIN_FIRST_NAME?.trim() || 'Admin';
  const lastName = process.env.SEED_ADMIN_LAST_NAME?.trim() || 'User';
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

  if (!email || !password) {
    throw new Error(
      'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running the seed.',
    );
  }
  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
  }

  console.log("Bootstrapping BRIE'S HOME & KITCHEN (production-ready, no mock data)...");

  await prisma.$transaction([
    prisma.customerTransaction.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchase.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.customerAccount.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(password, rounds);

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      firstName,
      lastName,
      role: UserRole.ADMIN,
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

  await prisma.customer.create({
    data: {
      name: 'Walk-in Customer',
      isWalkIn: true,
      account: { create: {} },
    },
  });

  console.log('Bootstrap complete. Database is empty of operational mock data.');
  console.log(`Admin: ${email} / ${username}`);
  console.log('Add real categories, products, customers, and sales from the app.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
