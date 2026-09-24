export type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY_MANAGER';

export type PaymentMethod = 'CASH' | 'MPESA' | 'BANK' | 'CREDIT';

export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';

export interface DateRangeParams {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface DashboardSummary {
  totalSales: string;
  totalProfit: string;
  amountCollected: string;
  creditSales: string;
  salesChangePercent: number | null;
  profitChangePercent: number | null;
  collectedPercentOfSales: number;
  creditPercentOfSales: number;
  totalProducts: number;
  categoryCount: number;
  lowStockItems: number;
  outOfStockItems: number;
  outstandingDebts: string;
  debtorsCount: number;
  expensesTotal: string;
  expensesCount: number;
  /**
   * Physical base units sold in range:
   * SUM(COALESCE(sale_items.base_quantity, sale_items.quantity)).
   */
  itemsSold: number;
  topSellingProducts: TopSellingProduct[];
  stockStatus: StockStatusSummary;
  paymentMethods: PaymentMethodSummary[];
  expensesSummary: ExpensesSummary;
  topDebtors: TopDebtor[];
}

export interface TopSellingProduct {
  rank: number;
  productId: string;
  productName: string;
  /**
   * Physical base units sold in range:
   * SUM(COALESCE(sale_items.base_quantity, sale_items.quantity)).
   * Not mixed selling-unit quantities (SET + PCS).
   */
  quantitySold: number;
  revenue: string;
  profit: string;
}

export interface StockStatusSummary {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalStockValue: string;
}

export interface PaymentMethodSummary {
  method: PaymentMethod;
  amount: string;
  percent: number;
}

export interface ExpensesSummary {
  totalExpenses: string;
  purchasesStock: string;
  otherExpenses: string;
}

export interface TopDebtor {
  rank: number;
  customerId: string;
  name: string;
  outstandingBalance: string;
}

export interface ProductDto {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName?: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: number;
  reorderLevel: number;
  unit: string;
  status: string;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isWalkIn: boolean;
  totalPurchases: string;
  totalPaid: string;
  outstandingBalance: string;
}

export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  customerId?: string | null;
  items: CreateSaleItemInput[];
  discountType?: DiscountType;
  discountValue?: number;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
  }>;
  notes?: string;
}

export interface LedgerEntry {
  id: string;
  type: 'SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';
  amount: string;
  balanceAfter: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}
