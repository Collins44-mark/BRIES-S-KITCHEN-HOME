-- =============================================================================
-- BRIE'S HOME & KITCHEN — Supabase PostgreSQL initial schema (v1)
-- =============================================================================
-- Single business. No business_id.
-- Auth: Supabase auth.users → public.profiles
-- Invoice counter timezone: Africa/Dar_es_Salaam (EAT, UTC+3)
-- Money: numeric(18,2) only — never floating point.
-- This file is for manual review; do not auto-apply without approval.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
CREATE TYPE public.staff_role AS ENUM (
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'INVENTORY_MANAGER'
);

CREATE TYPE public.product_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'DISCONTINUED'
);

CREATE TYPE public.payment_method AS ENUM (
  'CASH',
  'MPESA',
  'BANK',
  'CREDIT'
);

CREATE TYPE public.payment_status AS ENUM (
  'PENDING',
  'PARTIAL',
  'PAID',
  'CANCELLED'
);

CREATE TYPE public.sale_status AS ENUM (
  'DRAFT',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TYPE public.discount_type AS ENUM (
  'NONE',
  'PERCENTAGE',
  'FIXED'
);

CREATE TYPE public.inventory_movement_type AS ENUM (
  'PURCHASE',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'DAMAGE',
  'LOSS'
);

CREATE TYPE public.customer_transaction_type AS ENUM (
  'SALE',
  'PAYMENT',
  'ADJUSTMENT',
  'REFUND'
);

CREATE TYPE public.purchase_status AS ENUM (
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'CANCELLED'
);

-- -----------------------------------------------------------------------------
-- 3. profiles (linked to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  -- ON DELETE RESTRICT: never remove auth users/profiles that may own history.
  -- Deactivate with is_active = false instead of deleting staff.
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
  email text NOT NULL,
  username text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role public.staff_role NOT NULL DEFAULT 'CASHIER',
  is_active boolean NOT NULL DEFAULT true,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_unique UNIQUE (email),
  CONSTRAINT profiles_username_unique UNIQUE (username)
);

-- -----------------------------------------------------------------------------
-- 4. categories
-- -----------------------------------------------------------------------------
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_unique UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- 5. products
-- -----------------------------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  barcode text,
  name text NOT NULL,
  description text,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  cost_price numeric(18, 2) NOT NULL,
  selling_price numeric(18, 2) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 10,
  unit text NOT NULL DEFAULT 'pcs',
  status public.product_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_sku_unique UNIQUE (sku),
  CONSTRAINT products_cost_price_nonneg CHECK (cost_price >= 0),
  CONSTRAINT products_selling_price_nonneg CHECK (selling_price >= 0),
  CONSTRAINT products_stock_nonneg CHECK (stock_quantity >= 0),
  CONSTRAINT products_reorder_nonneg CHECK (reorder_level >= 0)
);

CREATE UNIQUE INDEX products_barcode_unique
  ON public.products (barcode)
  WHERE barcode IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. customers
-- -----------------------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  is_walk_in boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_phone_unique
  ON public.customers (phone)
  WHERE phone IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 7. customer_accounts
-- -----------------------------------------------------------------------------
CREATE TABLE public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  total_purchases numeric(18, 2) NOT NULL DEFAULT 0,
  total_paid numeric(18, 2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(18, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_accounts_customer_unique UNIQUE (customer_id),
  CONSTRAINT customer_accounts_purchases_nonneg CHECK (total_purchases >= 0),
  CONSTRAINT customer_accounts_paid_nonneg CHECK (total_paid >= 0),
  CONSTRAINT customer_accounts_balance_nonneg CHECK (outstanding_balance >= 0)
);

-- -----------------------------------------------------------------------------
-- 8. suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. sales
-- -----------------------------------------------------------------------------
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  customer_id uuid REFERENCES public.customers (id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.sale_status NOT NULL DEFAULT 'COMPLETED',
  subtotal numeric(18, 2) NOT NULL,
  discount_type public.discount_type NOT NULL DEFAULT 'NONE',
  discount_value numeric(18, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
  total_amount numeric(18, 2) NOT NULL,
  total_cost numeric(18, 2) NOT NULL,
  total_profit numeric(18, 2) NOT NULL,
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0,
  amount_due numeric(18, 2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  notes text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoice_unique UNIQUE (invoice_number),
  CONSTRAINT sales_subtotal_nonneg CHECK (subtotal >= 0),
  CONSTRAINT sales_discount_value_nonneg CHECK (discount_value >= 0),
  CONSTRAINT sales_discount_amount_nonneg CHECK (discount_amount >= 0),
  CONSTRAINT sales_discount_lte_subtotal CHECK (discount_amount <= subtotal),
  CONSTRAINT sales_total_amount_nonneg CHECK (total_amount >= 0),
  CONSTRAINT sales_total_cost_nonneg CHECK (total_cost >= 0),
  CONSTRAINT sales_amount_paid_nonneg CHECK (amount_paid >= 0),
  CONSTRAINT sales_amount_due_nonneg CHECK (amount_due >= 0),
  CONSTRAINT sales_paid_due_match_total CHECK (amount_paid + amount_due = total_amount),
  CONSTRAINT sales_credit_requires_customer CHECK (amount_due = 0 OR customer_id IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- 10. sale_items
-- -----------------------------------------------------------------------------
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(18, 2) NOT NULL,
  unit_cost numeric(18, 2) NOT NULL,
  line_subtotal numeric(18, 2) NOT NULL,
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
  line_total numeric(18, 2) NOT NULL,
  line_cost numeric(18, 2) NOT NULL,
  line_profit numeric(18, 2) NOT NULL,
  CONSTRAINT sale_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT sale_items_unit_price_nonneg CHECK (unit_price >= 0),
  CONSTRAINT sale_items_unit_cost_nonneg CHECK (unit_cost >= 0),
  CONSTRAINT sale_items_line_subtotal_nonneg CHECK (line_subtotal >= 0),
  CONSTRAINT sale_items_discount_nonneg CHECK (discount_amount >= 0),
  CONSTRAINT sale_items_line_total_nonneg CHECK (line_total >= 0),
  CONSTRAINT sale_items_line_cost_nonneg CHECK (line_cost >= 0)
);

-- -----------------------------------------------------------------------------
-- 11. purchases
-- -----------------------------------------------------------------------------
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  created_by_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.purchase_status NOT NULL DEFAULT 'RECEIVED',
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  subtotal numeric(18, 2) NOT NULL,
  total_amount numeric(18, 2) NOT NULL,
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0,
  notes text,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchases_reference_unique UNIQUE (reference),
  CONSTRAINT purchases_subtotal_nonneg CHECK (subtotal >= 0),
  CONSTRAINT purchases_total_nonneg CHECK (total_amount >= 0),
  CONSTRAINT purchases_paid_nonneg CHECK (amount_paid >= 0),
  CONSTRAINT purchases_paid_lte_total CHECK (amount_paid <= total_amount)
);

-- -----------------------------------------------------------------------------
-- 12. purchase_items
-- -----------------------------------------------------------------------------
CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric(18, 2) NOT NULL,
  line_total numeric(18, 2) NOT NULL,
  CONSTRAINT purchase_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT purchase_items_unit_cost_nonneg CHECK (unit_cost >= 0),
  CONSTRAINT purchase_items_line_total_nonneg CHECK (line_total >= 0)
);

-- -----------------------------------------------------------------------------
-- 13. payments
-- -----------------------------------------------------------------------------
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales (id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers (id) ON DELETE RESTRICT,
  amount numeric(18, 2) NOT NULL,
  method public.payment_method NOT NULL,
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT payments_amount_positive CHECK (amount > 0),
  CONSTRAINT payments_requires_sale_or_customer CHECK (
    sale_id IS NOT NULL OR customer_id IS NOT NULL
  ),
  CONSTRAINT payments_debt_repay_not_credit CHECK (
    NOT (sale_id IS NULL AND customer_id IS NOT NULL AND method = 'CREDIT')
  )
);

-- -----------------------------------------------------------------------------
-- 14. customer_transactions (append-only ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE public.customer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  type public.customer_transaction_type NOT NULL,
  amount numeric(18, 2) NOT NULL,
  balance_after numeric(18, 2) NOT NULL,
  reference text,
  sale_id uuid,
  payment_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_transactions_balance_nonneg CHECK (balance_after >= 0)
);

-- -----------------------------------------------------------------------------
-- 15. inventory_movements (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  type public.inventory_movement_type NOT NULL,
  quantity integer NOT NULL,
  quantity_before integer NOT NULL,
  quantity_after integer NOT NULL,
  unit_cost numeric(18, 2),
  reference text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_before_nonneg CHECK (quantity_before >= 0),
  CONSTRAINT inventory_movements_after_nonneg CHECK (quantity_after >= 0),
  CONSTRAINT inventory_movements_qty_identity CHECK (
    quantity_after = quantity_before + quantity
  )
);

-- -----------------------------------------------------------------------------
-- 16. expenses
-- -----------------------------------------------------------------------------
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  amount numeric(18, 2) NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'CASH',
  description text,
  expense_date timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT expenses_method_not_credit CHECK (payment_method <> 'CREDIT')
);

-- -----------------------------------------------------------------------------
-- 17. audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 18. invoice_counters (concurrency-safe)
-- counter_date uses Africa/Dar_es_Salaam calendar day (see next_invoice_number).
-- -----------------------------------------------------------------------------
CREATE TABLE public.invoice_counters (
  counter_date date PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  CONSTRAINT invoice_counters_last_value_nonneg CHECK (last_value >= 0)
);

-- -----------------------------------------------------------------------------
-- 19. Deferred foreign keys
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer_transactions
  ADD CONSTRAINT customer_transactions_sale_fk
    FOREIGN KEY (sale_id) REFERENCES public.sales (id) ON DELETE SET NULL,
  ADD CONSTRAINT customer_transactions_payment_fk
    FOREIGN KEY (payment_id) REFERENCES public.payments (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 20. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX profiles_role_idx ON public.profiles (role);
CREATE INDEX profiles_is_active_idx ON public.profiles (is_active);

CREATE INDEX categories_is_active_idx ON public.categories (is_active);

CREATE INDEX products_category_id_idx ON public.products (category_id);
CREATE INDEX products_status_idx ON public.products (status);
CREATE INDEX products_stock_quantity_idx ON public.products (stock_quantity);
CREATE INDEX products_name_idx ON public.products (name);

CREATE INDEX customers_name_idx ON public.customers (name);
CREATE INDEX customers_is_active_idx ON public.customers (is_active);
CREATE INDEX customers_is_walk_in_idx ON public.customers (is_walk_in);

CREATE INDEX customer_accounts_outstanding_positive_idx
  ON public.customer_accounts (outstanding_balance DESC)
  WHERE outstanding_balance > 0;

CREATE INDEX suppliers_name_idx ON public.suppliers (name);
CREATE INDEX suppliers_is_active_idx ON public.suppliers (is_active);

CREATE INDEX sales_sold_at_idx ON public.sales (sold_at DESC);
CREATE INDEX sales_customer_id_idx ON public.sales (customer_id);
CREATE INDEX sales_cashier_id_idx ON public.sales (cashier_id);
CREATE INDEX sales_status_idx ON public.sales (status);
CREATE INDEX sales_payment_status_idx ON public.sales (payment_status);

CREATE INDEX sale_items_sale_id_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_product_id_idx ON public.sale_items (product_id);

CREATE INDEX purchases_purchase_date_idx ON public.purchases (purchase_date DESC);
CREATE INDEX purchases_supplier_id_idx ON public.purchases (supplier_id);
CREATE INDEX purchases_status_idx ON public.purchases (status);

CREATE INDEX purchase_items_purchase_id_idx ON public.purchase_items (purchase_id);
CREATE INDEX purchase_items_product_id_idx ON public.purchase_items (product_id);

CREATE INDEX payments_sale_id_idx ON public.payments (sale_id);
CREATE INDEX payments_customer_id_idx ON public.payments (customer_id);
CREATE INDEX payments_paid_at_idx ON public.payments (paid_at DESC);
CREATE INDEX payments_method_idx ON public.payments (method);

CREATE INDEX customer_transactions_customer_created_idx
  ON public.customer_transactions (customer_id, created_at DESC);
CREATE INDEX customer_transactions_type_idx ON public.customer_transactions (type);
CREATE INDEX customer_transactions_sale_id_idx ON public.customer_transactions (sale_id);
CREATE INDEX customer_transactions_payment_id_idx ON public.customer_transactions (payment_id);

CREATE INDEX inventory_movements_product_created_idx
  ON public.inventory_movements (product_id, created_at DESC);
CREATE INDEX inventory_movements_type_idx ON public.inventory_movements (type);
CREATE INDEX inventory_movements_created_at_idx ON public.inventory_movements (created_at DESC);
CREATE INDEX inventory_movements_reference_idx ON public.inventory_movements (reference);

CREATE INDEX expenses_expense_date_idx ON public.expenses (expense_date DESC);
CREATE INDEX expenses_category_idx ON public.expenses (category);
CREATE INDEX expenses_created_by_id_idx ON public.expenses (created_by_id);

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX audit_logs_entity_created_idx ON public.audit_logs (entity, created_at DESC);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- 21. updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER customer_accounts_set_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_set_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER purchases_set_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create customer_accounts (1:1) when a customer is inserted
CREATE OR REPLACE FUNCTION public.handle_new_customer_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_accounts (customer_id)
  VALUES (NEW.id)
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_create_account
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_account();

-- Prevent deleting staff profiles that appear on historical financial records.
-- Operational rule: set profiles.is_active = false; do not delete.
CREATE OR REPLACE FUNCTION public.prevent_profile_delete_with_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sales s WHERE s.cashier_id = OLD.id) THEN
    RAISE EXCEPTION
      'Cannot delete profile %: referenced by historical sales. Deactivate with is_active = false instead.',
      OLD.id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.purchases p WHERE p.created_by_id = OLD.id) THEN
    RAISE EXCEPTION
      'Cannot delete profile %: referenced by historical purchases. Deactivate with is_active = false instead.',
      OLD.id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.expenses e WHERE e.created_by_id = OLD.id) THEN
    RAISE EXCEPTION
      'Cannot delete profile %: referenced by historical expenses. Deactivate with is_active = false instead.',
      OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER profiles_prevent_delete_with_history
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_delete_with_history();

-- Block direct client edits to stock_quantity / cost_price.
-- RPCs set bries.allow_inventory_mutation=true (transaction-local) before updating stock.
CREATE OR REPLACE FUNCTION public.protect_product_stock_and_cost()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(current_setting('bries.allow_inventory_mutation', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    RAISE EXCEPTION
      'Direct updates to stock_quantity are not allowed. Use sale, purchase, or inventory RPCs.';
  END IF;

  IF NEW.cost_price IS DISTINCT FROM OLD.cost_price THEN
    RAISE EXCEPTION
      'Direct updates to cost_price are not allowed. Cost is updated when receiving purchases.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_protect_stock_and_cost
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_stock_and_cost();

-- -----------------------------------------------------------------------------
-- 22. Supabase Auth → profiles bootstrap
-- Role from signup metadata is IGNORED for privilege (always CASHIER).
-- Admins promote roles later via authorized workflow.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_username text;
  v_first text;
  v_last text;
  local_part text;
BEGIN
  local_part := split_part(COALESCE(NEW.email, 'user'), '@', 1);

  v_username := NULLIF(trim(BOTH FROM COALESCE(meta ->> 'username', '')), '');
  IF v_username IS NULL THEN
    v_username := local_part;
  END IF;

  v_first := NULLIF(trim(BOTH FROM COALESCE(meta ->> 'first_name', meta ->> 'firstName', '')), '');
  IF v_first IS NULL THEN
    v_first := local_part;
  END IF;

  v_last := NULLIF(trim(BOTH FROM COALESCE(meta ->> 'last_name', meta ->> 'lastName', '')), '');
  IF v_last IS NULL THEN
    v_last := '';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    username,
    first_name,
    last_name,
    role,
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@users.local'),
    v_username,
    v_first,
    v_last,
    'CASHIER',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 23–25. RLS helpers, enablement, policies
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(allowed public.staff_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_staff()
    AND public.current_staff_role() = ANY (allowed);
$$;

CREATE OR REPLACE FUNCTION public.require_active_staff()
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
BEGIN
  SELECT * INTO staff
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true;

  IF staff.id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: active staff profile not found'
      USING ERRCODE = '42501';
  END IF;

  RETURN staff;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_staff_roles(allowed public.staff_role[])
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
BEGIN
  staff := public.require_active_staff();
  IF NOT (staff.role = ANY (allowed)) THEN
    RAISE EXCEPTION 'Insufficient permissions for role %', staff.role
      USING ERRCODE = '42501';
  END IF;
  RETURN staff;
END;
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_staff
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_active_staff())
  WITH CHECK (
    id = auth.uid()
    AND public.is_active_staff()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY profiles_admin_update
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]))
  WITH CHECK (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

-- categories
CREATE POLICY categories_select_staff
  ON public.categories FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY categories_insert_managers
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  );

CREATE POLICY categories_update_managers
  ON public.categories FOR UPDATE TO authenticated
  USING (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  )
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  );

CREATE POLICY categories_delete_admin
  ON public.categories FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

-- products
CREATE POLICY products_select_staff
  ON public.products FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY products_insert_managers
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  );

-- Product catalog fields may be updated by managers/inventory.
-- stock_quantity and cost_price cannot be changed by direct client UPDATE:
-- enforced by protect_product_stock_and_cost trigger (RPCs opt in via
-- bries.allow_inventory_mutation). Do not compare those columns here with a
-- self-subquery — that can recurse under RLS.
CREATE POLICY products_update_managers
  ON public.products FOR UPDATE TO authenticated
  USING (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  )
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  );

CREATE POLICY products_delete_admin
  ON public.products FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

-- customers
CREATE POLICY customers_select_staff
  ON public.customers FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY customers_insert_sales_staff
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'CASHIER']::public.staff_role[])
  );

CREATE POLICY customers_update_sales_staff
  ON public.customers FOR UPDATE TO authenticated
  USING (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'CASHIER']::public.staff_role[])
  )
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'CASHIER']::public.staff_role[])
  );

CREATE POLICY customers_delete_admin
  ON public.customers FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

-- suppliers
CREATE POLICY suppliers_select_staff
  ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY suppliers_insert_managers
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  );

CREATE POLICY suppliers_update_managers
  ON public.suppliers FOR UPDATE TO authenticated
  USING (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  )
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[])
  );

CREATE POLICY suppliers_delete_admin
  ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

-- expenses (direct insert allowed; created_by forced to auth.uid())
CREATE POLICY expenses_select_staff
  ON public.expenses FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY expenses_insert_staff
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_staff()
    AND created_by_id = auth.uid()
  );

CREATE POLICY expenses_update_managers
  ON public.expenses FOR UPDATE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[]))
  WITH CHECK (public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[]));

CREATE POLICY expenses_delete_admin
  ON public.expenses FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

-- Read-only for RPC-managed financial / stock tables
CREATE POLICY customer_accounts_select_staff
  ON public.customer_accounts FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY sales_select_staff
  ON public.sales FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY sale_items_select_staff
  ON public.sale_items FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY purchases_select_staff
  ON public.purchases FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY purchase_items_select_staff
  ON public.purchase_items FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY payments_select_staff
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY customer_transactions_select_staff
  ON public.customer_transactions FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY inventory_movements_select_staff
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY audit_logs_select_managers
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[]));

-- invoice_counters: no direct client access (no policies for authenticated)

-- -----------------------------------------------------------------------------
-- Money helpers (numeric only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.money_round(amount numeric)
RETURNS numeric(18, 2)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(COALESCE(amount, 0), 2)::numeric(18, 2);
$$;

-- =============================================================================
-- 26. RPC: next_invoice_number (internal)
-- Timezone for counter_date: Africa/Dar_es_Salaam
-- =============================================================================
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_tz text := 'Africa/Dar_es_Salaam';
  d date;
  seq integer;
BEGIN
  d := (now() AT TIME ZONE business_tz)::date;

  INSERT INTO public.invoice_counters AS ic (counter_date, last_value)
  VALUES (d, 1)
  ON CONFLICT (counter_date)
  DO UPDATE SET last_value = ic.last_value + 1
  RETURNING last_value INTO seq;

  RETURN 'INV-'
    || to_char(d, 'YYYYMMDD')
    || '-'
    || lpad(seq::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM authenticated, anon;

-- =============================================================================
-- 26a. RPC: create_sale
-- Payload shape:
-- {
--   "customer_id": "uuid"|null,
--   "items": [{"product_id":"uuid","quantity":1}, ...],
--   "discount_type": "NONE"|"PERCENTAGE"|"FIXED",
--   "discount_value": 0,
--   "payments": [{"method":"CASH","amount":1000,"reference":null}, ...],
--   "notes": null
-- }
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
  items jsonb;
  payments jsonb;
  v_customer_id uuid;
  discount_type public.discount_type;
  discount_value numeric(18, 2);
  notes text;

  product_ids uuid[];
  pid uuid;
  locked_product public.products;
  item jsonb;
  qty integer;
  product_id uuid;

  subtotal numeric(18, 2) := 0;
  discount_amount numeric(18, 2) := 0;
  total_amount numeric(18, 2);
  total_cost numeric(18, 2) := 0;
  total_profit numeric(18, 2);
  total_paid numeric(18, 2) := 0;
  amount_due numeric(18, 2);
  payment_status public.payment_status;

  -- Must be jsonb (not anonymous record). Assigning jsonb → record raises:
  -- "input of anonymous composite types is not implemented"
  line_rec jsonb;
  calc_items jsonb := '[]'::jsonb;
  allocated_discount numeric(18, 2) := 0;
  item_discount numeric(18, 2);
  line_subtotal numeric(18, 2);
  line_cost numeric(18, 2);
  line_total numeric(18, 2);
  line_profit numeric(18, 2);
  item_count integer;
  idx integer := 0;

  invoice_number text;
  sale_id uuid;
  payment jsonb;
  pay_amount numeric(18, 2);
  pay_method public.payment_method;
  pay_ref text;

  account public.customer_accounts;
  balance numeric(18, 2);
  new_total_purchases numeric(18, 2);
  new_total_paid numeric(18, 2);

  qty_before integer;
  qty_after integer;
  result jsonb;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'CASHIER']::public.staff_role[]
  );

  -- Allow stock mutations inside this transaction (blocked for direct client UPDATEs).
  PERFORM set_config('bries.allow_inventory_mutation', 'true', true);

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid sale payload';
  END IF;

  items := COALESCE(payload -> 'items', '[]'::jsonb);
  payments := COALESCE(payload -> 'payments', '[]'::jsonb);

  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) < 1 THEN
    RAISE EXCEPTION 'Sale requires at least one item';
  END IF;

  v_customer_id := NULLIF(payload ->> 'customer_id', '')::uuid;
  discount_type := COALESCE((payload ->> 'discount_type')::public.discount_type, 'NONE');
  discount_value := public.money_round(COALESCE((payload ->> 'discount_value')::numeric, 0));
  notes := NULLIF(payload ->> 'notes', '');

  IF v_customer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = v_customer_id
        AND c.is_active = true
    ) THEN
      RAISE EXCEPTION 'Customer not found or inactive';
    END IF;
  END IF;

  -- Collect product ids, then lock in stable order to avoid deadlocks
  SELECT array_agg(DISTINCT (elem ->> 'product_id')::uuid ORDER BY (elem ->> 'product_id')::uuid)
  INTO product_ids
  FROM jsonb_array_elements(items) AS elem;

  IF product_ids IS NULL OR array_length(product_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Sale requires valid product ids';
  END IF;

  FOREACH pid IN ARRAY product_ids
  LOOP
    PERFORM 1 FROM public.products p WHERE p.id = pid FOR UPDATE;
  END LOOP;

  -- Aggregate quantities per product for stock sufficiency (supports duplicate lines)
  FOR pid, qty IN
    SELECT
      (elem ->> 'product_id')::uuid,
      SUM((elem ->> 'quantity')::integer)::integer
    FROM jsonb_array_elements(items) AS elem
    GROUP BY 1
    ORDER BY 1
  LOOP
    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = pid;

    IF locked_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', pid;
    END IF;

    IF locked_product.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Product is not ACTIVE: %', locked_product.name;
    END IF;

    IF locked_product.stock_quantity < qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', locked_product.name;
    END IF;
  END LOOP;

  -- Build calculated lines
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    product_id := (item ->> 'product_id')::uuid;
    qty := (item ->> 'quantity')::integer;

    IF product_id IS NULL OR qty IS NULL OR qty < 1 THEN
      RAISE EXCEPTION 'Each sale item needs product_id and quantity >= 1';
    END IF;

    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = product_id;

    IF locked_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', product_id;
    END IF;

    line_subtotal := public.money_round(locked_product.selling_price * qty);
    line_cost := public.money_round(locked_product.cost_price * qty);
    subtotal := public.money_round(subtotal + line_subtotal);
    total_cost := public.money_round(total_cost + line_cost);

    calc_items := calc_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', locked_product.id,
        'product_name', locked_product.name,
        'quantity', qty,
        'unit_price', locked_product.selling_price,
        'unit_cost', locked_product.cost_price,
        'line_subtotal', line_subtotal,
        'line_cost', line_cost
      )
    );
  END LOOP;

  -- Discount (same rules as legacy calculator)
  IF discount_type = 'PERCENTAGE' THEN
    IF discount_value < 0 OR discount_value > 100 THEN
      RAISE EXCEPTION 'Percentage discount must be between 0 and 100';
    END IF;
    discount_amount := public.money_round(subtotal * discount_value / 100);
  ELSIF discount_type = 'FIXED' THEN
    IF discount_value < 0 THEN
      RAISE EXCEPTION 'Fixed discount cannot be negative';
    END IF;
    IF discount_value > subtotal THEN
      RAISE EXCEPTION 'Fixed discount cannot exceed subtotal';
    END IF;
    discount_amount := public.money_round(discount_value);
  ELSE
    discount_amount := 0;
    discount_value := 0;
  END IF;

  item_count := jsonb_array_length(calc_items);
  allocated_discount := 0;

  -- Allocate proportional discounts; remainder on last line
  FOR idx IN 0 .. item_count - 1 LOOP
    line_rec := calc_items -> idx;
    line_subtotal := (line_rec ->> 'line_subtotal')::numeric;

    IF discount_amount > 0 AND subtotal > 0 THEN
      IF idx = item_count - 1 THEN
        item_discount := public.money_round(discount_amount - allocated_discount);
      ELSE
        item_discount := public.money_round(discount_amount * line_subtotal / subtotal);
        allocated_discount := public.money_round(allocated_discount + item_discount);
      END IF;
    ELSE
      item_discount := 0;
    END IF;

    line_total := public.money_round(line_subtotal - item_discount);
    line_cost := (line_rec ->> 'line_cost')::numeric;
    line_profit := public.money_round(line_total - line_cost);

    calc_items := jsonb_set(
      calc_items,
      ARRAY[idx::text],
      (line_rec || jsonb_build_object(
        'discount_amount', item_discount,
        'line_total', line_total,
        'line_profit', line_profit
      ))
    );
  END LOOP;

  total_amount := public.money_round(subtotal - discount_amount);
  total_profit := public.money_round(total_amount - total_cost);

  -- Payments total
  IF jsonb_typeof(payments) = 'array' THEN
    FOR payment IN SELECT * FROM jsonb_array_elements(payments)
    LOOP
      pay_amount := public.money_round((payment ->> 'amount')::numeric);
      IF pay_amount < 0 THEN
        RAISE EXCEPTION 'Payment amount cannot be negative';
      END IF;
      total_paid := public.money_round(total_paid + pay_amount);
    END LOOP;
  END IF;

  IF total_paid > total_amount THEN
    RAISE EXCEPTION 'Payment amount exceeds sale total.';
  END IF;

  amount_due := public.money_round(total_amount - total_paid);

  IF amount_due > 0 AND v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Credit sales require a registered customer';
  END IF;

  IF amount_due > 0 THEN
    IF v_customer_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = v_customer_id
        AND c.is_active = true
    ) THEN
      RAISE EXCEPTION 'Credit sales require an active registered customer';
    END IF;
  END IF;

  IF amount_due = 0 THEN
    payment_status := 'PAID';
  ELSIF total_paid > 0 THEN
    payment_status := 'PARTIAL';
  ELSE
    payment_status := 'PENDING';
  END IF;

  invoice_number := public.next_invoice_number();

  INSERT INTO public.sales (
    invoice_number,
    customer_id,
    cashier_id,
    status,
    subtotal,
    discount_type,
    discount_value,
    discount_amount,
    total_amount,
    total_cost,
    total_profit,
    amount_paid,
    amount_due,
    payment_status,
    notes
  )
  VALUES (
    invoice_number,
    v_customer_id,
    staff.id,
    'COMPLETED',
    subtotal,
    discount_type,
    discount_value,
    discount_amount,
    total_amount,
    total_cost,
    total_profit,
    total_paid,
    amount_due,
    payment_status,
    notes
  )
  RETURNING id INTO sale_id;

  -- Sale items + stock + inventory movements
  FOR idx IN 0 .. item_count - 1 LOOP
    line_rec := calc_items -> idx;
    product_id := (line_rec ->> 'product_id')::uuid;
    qty := (line_rec ->> 'quantity')::integer;

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_cost,
      line_subtotal,
      discount_amount,
      line_total,
      line_cost,
      line_profit
    )
    VALUES (
      sale_id,
      product_id,
      line_rec ->> 'product_name',
      qty,
      (line_rec ->> 'unit_price')::numeric,
      (line_rec ->> 'unit_cost')::numeric,
      (line_rec ->> 'line_subtotal')::numeric,
      (line_rec ->> 'discount_amount')::numeric,
      (line_rec ->> 'line_total')::numeric,
      (line_rec ->> 'line_cost')::numeric,
      (line_rec ->> 'line_profit')::numeric
    );

    SELECT stock_quantity INTO qty_before
    FROM public.products
    WHERE id = product_id
    FOR UPDATE;

    qty_after := qty_before - qty;
    IF qty_after < 0 THEN
      RAISE EXCEPTION 'Insufficient stock during final update';
    END IF;

    UPDATE public.products
    SET stock_quantity = qty_after
    WHERE id = product_id;

    INSERT INTO public.inventory_movements (
      product_id,
      type,
      quantity,
      quantity_before,
      quantity_after,
      unit_cost,
      reference,
      notes,
      created_by
    )
    VALUES (
      product_id,
      'SALE',
      -qty,
      qty_before,
      qty_after,
      (line_rec ->> 'unit_cost')::numeric,
      invoice_number,
      'Sale ' || invoice_number,
      staff.id
    );
  END LOOP;

  -- Payment rows
  IF jsonb_typeof(payments) = 'array' THEN
    FOR payment IN SELECT * FROM jsonb_array_elements(payments)
    LOOP
      pay_amount := public.money_round((payment ->> 'amount')::numeric);
      IF pay_amount = 0 THEN
        CONTINUE;
      END IF;
      pay_method := (payment ->> 'method')::public.payment_method;
      pay_ref := NULLIF(payment ->> 'reference', '');

      INSERT INTO public.payments (
        sale_id,
        customer_id,
        amount,
        method,
        reference,
        created_by
      )
      VALUES (
        sale_id,
        v_customer_id,
        pay_amount,
        pay_method,
        pay_ref,
        staff.id
      );
    END LOOP;
  END IF;

  -- Customer ledger
  IF v_customer_id IS NOT NULL THEN
    SELECT * INTO account
    FROM public.customer_accounts ca
    WHERE ca.customer_id = v_customer_id
    FOR UPDATE;

    IF account.id IS NULL THEN
      INSERT INTO public.customer_accounts (customer_id)
      VALUES (v_customer_id)
      RETURNING * INTO account;
    END IF;

    balance := account.outstanding_balance;
    new_total_purchases := public.money_round(account.total_purchases + total_amount);
    new_total_paid := account.total_paid;

    balance := public.money_round(balance + total_amount);
    INSERT INTO public.customer_transactions (
      customer_id, type, amount, balance_after, reference, sale_id, notes
    )
    VALUES (
      v_customer_id,
      'SALE',
      total_amount,
      balance,
      invoice_number,
      sale_id,
      'Credit/sale ' || invoice_number
    );

    IF total_paid > 0 THEN
      balance := public.money_round(balance - total_paid);
      new_total_paid := public.money_round(new_total_paid + total_paid);

      INSERT INTO public.customer_transactions (
        customer_id, type, amount, balance_after, reference, sale_id, notes
      )
      VALUES (
        v_customer_id,
        'PAYMENT',
        -total_paid,
        GREATEST(balance, 0),
        invoice_number,
        sale_id,
        'Payment on ' || invoice_number
      );
    END IF;

    UPDATE public.customer_accounts
    SET
      total_purchases = new_total_purchases,
      total_paid = new_total_paid,
      outstanding_balance = GREATEST(balance, 0)
    WHERE customer_accounts.customer_id = v_customer_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'CREATE_SALE',
    'sales',
    sale_id,
    jsonb_build_object(
      'invoice_number', invoice_number,
      'total_amount', total_amount,
      'amount_due', amount_due
    )
  );

  SELECT jsonb_build_object(
    'id', s.id,
    'invoice_number', s.invoice_number,
    'customer_id', s.customer_id,
    'cashier_id', s.cashier_id,
    'status', s.status,
    'subtotal', s.subtotal,
    'discount_type', s.discount_type,
    'discount_value', s.discount_value,
    'discount_amount', s.discount_amount,
    'total_amount', s.total_amount,
    'total_cost', s.total_cost,
    'total_profit', s.total_profit,
    'amount_paid', s.amount_paid,
    'amount_due', s.amount_due,
    'payment_status', s.payment_status,
    'notes', s.notes,
    'sold_at', s.sold_at,
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
      FROM public.sale_items si
      WHERE si.sale_id = s.id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)
      FROM public.payments p
      WHERE p.sale_id = s.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.sales s
  WHERE s.id = sale_id;

  RETURN result;
END;
$$;

-- =============================================================================
-- 26b. RPC: receive_purchase
-- Payload:
-- {
--   "supplier_id": "uuid",
--   "reference": "optional",
--   "payment_status": "PAID",
--   "amount_paid": 0,
--   "purchase_date": "ISO"|null,
--   "notes": null,
--   "items": [{"product_id":"uuid","quantity":1,"unit_cost":1000}, ...]
-- }
-- =============================================================================
CREATE OR REPLACE FUNCTION public.receive_purchase(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
  supplier_id uuid;
  supplier_exists boolean;
  items jsonb;
  item jsonb;
  reference text;
  payment_status public.payment_status;
  amount_paid numeric(18, 2);
  purchase_date timestamptz;
  notes text;

  product_ids uuid[];
  pid uuid;
  product_id uuid;
  qty integer;
  unit_cost numeric(18, 2);
  line_total numeric(18, 2);
  total_amount numeric(18, 2) := 0;
  locked_product public.products;

  purchase_id uuid;
  qty_before integer;
  qty_after integer;
  result jsonb;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[]
  );

  -- Allow stock/cost mutations inside this transaction.
  PERFORM set_config('bries.allow_inventory_mutation', 'true', true);

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid purchase payload';
  END IF;

  supplier_id := (payload ->> 'supplier_id')::uuid;
  items := COALESCE(payload -> 'items', '[]'::jsonb);

  IF supplier_id IS NULL THEN
    RAISE EXCEPTION 'supplier_id is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.is_active = true
  ) INTO supplier_exists;

  IF NOT supplier_exists THEN
    RAISE EXCEPTION 'Supplier not found or inactive';
  END IF;

  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) < 1 THEN
    RAISE EXCEPTION 'Purchase requires at least one item';
  END IF;

  reference := NULLIF(trim(BOTH FROM COALESCE(payload ->> 'reference', '')), '');
  IF reference IS NULL THEN
    reference := 'PO-' || to_char(now() AT TIME ZONE 'Africa/Dar_es_Salaam', 'YYYYMMDDHH24MISS')
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;

  payment_status := COALESCE(
    (payload ->> 'payment_status')::public.payment_status,
    'PAID'
  );
  notes := NULLIF(payload ->> 'notes', '');
  purchase_date := COALESCE((payload ->> 'purchase_date')::timestamptz, now());

  -- Lock products in deterministic UUID order to reduce deadlock risk
  SELECT array_agg(DISTINCT (elem ->> 'product_id')::uuid ORDER BY (elem ->> 'product_id')::uuid)
  INTO product_ids
  FROM jsonb_array_elements(items) AS elem;

  IF product_ids IS NULL OR array_length(product_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Purchase requires valid product ids';
  END IF;

  FOREACH pid IN ARRAY product_ids
  LOOP
    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = pid
    FOR UPDATE;

    IF locked_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', pid;
    END IF;

    IF locked_product.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Only ACTIVE products can be received. Product % is %',
        locked_product.name, locked_product.status;
    END IF;
  END LOOP;

  -- Pre-validate lines and compute total
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    product_id := (item ->> 'product_id')::uuid;
    qty := (item ->> 'quantity')::integer;
    unit_cost := public.money_round((item ->> 'unit_cost')::numeric);

    IF product_id IS NULL OR qty IS NULL OR qty < 1 THEN
      RAISE EXCEPTION 'Each purchase item needs product_id and quantity >= 1';
    END IF;
    IF unit_cost IS NULL OR unit_cost < 0 THEN
      RAISE EXCEPTION 'unit_cost must be >= 0';
    END IF;

    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = product_id;

    IF locked_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', product_id;
    END IF;

    IF locked_product.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Only ACTIVE products can be received. Product % is %',
        locked_product.name, locked_product.status;
    END IF;

    line_total := public.money_round(unit_cost * qty);
    total_amount := public.money_round(total_amount + line_total);
  END LOOP;

  amount_paid := public.money_round(
    COALESCE((payload ->> 'amount_paid')::numeric, total_amount)
  );
  IF amount_paid < 0 OR amount_paid > total_amount THEN
    RAISE EXCEPTION 'amount_paid must be between 0 and total_amount';
  END IF;

  INSERT INTO public.purchases (
    reference,
    supplier_id,
    created_by_id,
    status,
    payment_status,
    subtotal,
    total_amount,
    amount_paid,
    notes,
    purchase_date,
    received_at
  )
  VALUES (
    reference,
    supplier_id,
    staff.id,
    'RECEIVED',
    payment_status,
    total_amount,
    total_amount,
    amount_paid,
    notes,
    purchase_date,
    now()
  )
  RETURNING id INTO purchase_id;

  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    product_id := (item ->> 'product_id')::uuid;
    qty := (item ->> 'quantity')::integer;
    unit_cost := public.money_round((item ->> 'unit_cost')::numeric);
    line_total := public.money_round(unit_cost * qty);

    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = product_id;

    INSERT INTO public.purchase_items (
      purchase_id,
      product_id,
      product_name,
      quantity,
      unit_cost,
      line_total
    )
    VALUES (
      purchase_id,
      product_id,
      locked_product.name,
      qty,
      unit_cost,
      line_total
    );

    qty_before := locked_product.stock_quantity;
    qty_after := qty_before + qty;

    UPDATE public.products
    SET
      stock_quantity = qty_after,
      cost_price = unit_cost
    WHERE id = product_id;

    -- Refresh locked snapshot for duplicate lines of the same product
    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = product_id;

    INSERT INTO public.inventory_movements (
      product_id,
      type,
      quantity,
      quantity_before,
      quantity_after,
      unit_cost,
      reference,
      notes,
      created_by
    )
    VALUES (
      product_id,
      'PURCHASE',
      qty,
      qty_before,
      qty_after,
      unit_cost,
      reference,
      'Purchase ' || reference,
      staff.id
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'RECEIVE_PURCHASE',
    'purchases',
    purchase_id,
    jsonb_build_object(
      'reference', reference,
      'total_amount', total_amount
    )
  );

  SELECT jsonb_build_object(
    'id', p.id,
    'reference', p.reference,
    'supplier_id', p.supplier_id,
    'created_by_id', p.created_by_id,
    'status', p.status,
    'payment_status', p.payment_status,
    'subtotal', p.subtotal,
    'total_amount', p.total_amount,
    'amount_paid', p.amount_paid,
    'notes', p.notes,
    'purchase_date', p.purchase_date,
    'received_at', p.received_at,
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.id)
      FROM public.purchase_items pi
      WHERE pi.purchase_id = p.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.purchases p
  WHERE p.id = purchase_id;

  RETURN result;
END;
$$;

-- =============================================================================
-- 26c. RPC: record_debt_payment
-- Payload:
-- {
--   "customer_id": "uuid",
--   "sale_id": "uuid"|null,
--   "amount": 1000,
--   "method": "CASH"|"MPESA"|"BANK",
--   "reference": null,
--   "notes": null
-- }
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_debt_payment(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
  v_customer_id uuid;
  v_sale_id uuid;
  amount numeric(18, 2);
  method public.payment_method;
  reference text;
  notes text;

  customer_exists boolean;
  sale public.sales;
  payment_id uuid;
  account public.customer_accounts;
  balance numeric(18, 2);
  new_paid numeric(18, 2);
  new_due numeric(18, 2);
  result jsonb;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'CASHIER']::public.staff_role[]
  );

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payment payload';
  END IF;

  v_customer_id := (payload ->> 'customer_id')::uuid;
  v_sale_id := NULLIF(payload ->> 'sale_id', '')::uuid;
  amount := public.money_round((payload ->> 'amount')::numeric);
  method := (payload ->> 'method')::public.payment_method;
  reference := NULLIF(payload ->> 'reference', '');
  notes := NULLIF(payload ->> 'notes', '');

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  IF method IS NULL THEN
    RAISE EXCEPTION 'payment method is required';
  END IF;

  IF method = 'CREDIT' THEN
    RAISE EXCEPTION 'Cannot record CREDIT as a debt repayment';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than 0';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = v_customer_id AND c.is_active = true
  ) INTO customer_exists;

  IF NOT customer_exists THEN
    RAISE EXCEPTION 'Customer not found or inactive';
  END IF;

  SELECT * INTO account
  FROM public.customer_accounts ca
  WHERE ca.customer_id = v_customer_id
  FOR UPDATE;

  IF account.id IS NULL THEN
    INSERT INTO public.customer_accounts (customer_id)
    VALUES (v_customer_id)
    RETURNING * INTO account;
  END IF;

  IF amount > account.outstanding_balance THEN
    RAISE EXCEPTION
      'Payment amount exceeds customer outstanding balance.';
  END IF;

  IF v_sale_id IS NOT NULL THEN
    SELECT * INTO sale
    FROM public.sales s
    WHERE s.id = v_sale_id
    FOR UPDATE;

    IF sale.id IS NULL THEN
      RAISE EXCEPTION 'Sale not found';
    END IF;

    IF sale.customer_id IS DISTINCT FROM v_customer_id THEN
      RAISE EXCEPTION 'Sale does not belong to this customer';
    END IF;

    IF amount > sale.amount_due THEN
      RAISE EXCEPTION
        'Payment amount exceeds sale remaining amount due.';
    END IF;

    new_paid := public.money_round(sale.amount_paid + amount);
    new_due := public.money_round(sale.total_amount - new_paid);

    IF new_due < 0 THEN
      RAISE EXCEPTION 'Payment amount exceeds sale remaining amount due.';
    END IF;

    UPDATE public.sales
    SET
      amount_paid = new_paid,
      amount_due = new_due,
      payment_status = CASE
        WHEN new_due = 0 THEN 'PAID'::public.payment_status
        ELSE 'PARTIAL'::public.payment_status
      END
    WHERE id = v_sale_id;
  END IF;

  INSERT INTO public.payments (
    sale_id,
    customer_id,
    amount,
    method,
    reference,
    notes,
    created_by
  )
  VALUES (
    v_sale_id,
    v_customer_id,
    amount,
    method,
    reference,
    COALESCE(notes, 'Debt payment'),
    staff.id
  )
  RETURNING id INTO payment_id;

  balance := public.money_round(account.outstanding_balance - amount);

  IF balance < 0 THEN
    RAISE EXCEPTION 'Payment amount exceeds customer outstanding balance.';
  END IF;

  INSERT INTO public.customer_transactions (
    customer_id,
    type,
    amount,
    balance_after,
    reference,
    sale_id,
    payment_id,
    notes
  )
  VALUES (
    v_customer_id,
    'PAYMENT',
    -amount,
    balance,
    reference,
    v_sale_id,
    payment_id,
    COALESCE(notes, 'Debt payment')
  );

  UPDATE public.customer_accounts
  SET
    total_paid = public.money_round(account.total_paid + amount),
    outstanding_balance = balance
  WHERE customer_accounts.customer_id = v_customer_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'RECORD_DEBT_PAYMENT',
    'payments',
    payment_id,
    jsonb_build_object(
      'customer_id', v_customer_id,
      'sale_id', v_sale_id,
      'amount', amount,
      'method', method
    )
  );

  SELECT to_jsonb(p) INTO result
  FROM public.payments p
  WHERE p.id = payment_id;

  RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- Grants: RPC callable by authenticated; helpers usable by policies
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_staff_role(public.staff_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.money_round(numeric) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.create_sale(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.receive_purchase(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_debt_payment(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_active_staff() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_staff_roles(public.staff_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

GRANT SELECT ON public.customer_accounts TO authenticated;
GRANT SELECT ON public.sales TO authenticated;
GRANT SELECT ON public.sale_items TO authenticated;
GRANT SELECT ON public.purchases TO authenticated;
GRANT SELECT ON public.purchase_items TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.customer_transactions TO authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

-- No grants on invoice_counters to authenticated (RPC-only via SECURITY DEFINER)
