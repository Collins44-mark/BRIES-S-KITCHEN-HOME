import { api } from './api';
import type {
  AuthUser,
  CreateSaleInput,
  CustomerDto,
  DashboardSummary,
  DateRangePreset,
  LoginResponse,
  ProductDto,
} from '@bries/types';

export const authApi = {
  login: async (emailOrUsername: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      emailOrUsername,
      password,
    });
    return data;
  },
  logout: async (refreshToken: string) => {
    await api.post('/auth/logout', { refreshToken });
  },
  me: async () => {
    const { data } = await api.get<AuthUser>('/users/me');
    return data;
  },
};

export const dashboardApi = {
  summary: async (preset: DateRangePreset, from?: string, to?: string) => {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary', {
      params: { preset, from, to },
    });
    return data;
  },
};

export const productsApi = {
  list: async (search?: string, categoryId?: string) => {
    const { data } = await api.get<ProductDto[]>('/products', {
      params: { search, categoryId },
    });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/products', payload);
    return data;
  },
};

export const categoriesApi = {
  list: async () => {
    const { data } = await api.get('/categories');
    return data;
  },
};

export const customersApi = {
  list: async (search?: string) => {
    const { data } = await api.get<CustomerDto[]>('/customers', { params: { search } });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/customers', payload);
    return data;
  },
  byPhone: async (phone: string) => {
    const { data } = await api.get<CustomerDto>(`/customers/by-phone/${phone}`);
    return data;
  },
  ledger: async (id: string) => {
    const { data } = await api.get(`/customers/${id}/ledger`);
    return data;
  },
};

export const salesApi = {
  create: async (payload: CreateSaleInput) => {
    const { data } = await api.post('/sales', payload);
    return data;
  },
  list: async () => {
    const { data } = await api.get('/sales');
    return data;
  },
};

export const expensesApi = {
  list: async (preset?: DateRangePreset) => {
    const { data } = await api.get('/expenses', { params: { preset } });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/expenses', payload);
    return data;
  },
};

export const inventoryApi = {
  overview: async () => {
    const { data } = await api.get('/inventory');
    return data;
  },
  movements: async () => {
    const { data } = await api.get('/inventory/movements');
    return data;
  },
};

export const purchasesApi = {
  list: async () => {
    const { data } = await api.get('/purchases');
    return data;
  },
  suppliers: async () => {
    const { data } = await api.get('/purchases/suppliers');
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/purchases', payload);
    return data;
  },
};

export const debtsApi = {
  summary: async () => {
    const { data } = await api.get('/debts');
    return data;
  },
};

export const reportsApi = {
  sales: async (preset: DateRangePreset) => {
    const { data } = await api.get('/reports/sales', { params: { preset } });
    return data;
  },
  profit: async (preset: DateRangePreset) => {
    const { data } = await api.get('/reports/profit', { params: { preset } });
    return data;
  },
  expenses: async (preset: DateRangePreset) => {
    const { data } = await api.get('/reports/expenses', { params: { preset } });
    return data;
  },
  inventory: async () => {
    const { data } = await api.get('/reports/inventory');
    return data;
  },
  debts: async () => {
    const { data } = await api.get('/reports/debts');
    return data;
  },
  payments: async (preset: DateRangePreset) => {
    const { data } = await api.get('/reports/payments', { params: { preset } });
    return data;
  },
  purchases: async (preset: DateRangePreset) => {
    const { data } = await api.get('/reports/purchases', { params: { preset } });
    return data;
  },
};

export const paymentsApi = {
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/payments', payload);
    return data;
  },
};
