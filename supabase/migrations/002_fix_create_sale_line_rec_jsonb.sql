-- =============================================================================
-- 002: Fix create_sale anonymous composite error
--
-- Root cause: line_rec was declared as `record` but assigned jsonb values
-- (calc_items -> idx). PostgreSQL cannot input anonymous composites from jsonb,
-- which surfaces as:
--   "Input of anonymous composite types is not implemented"
--
-- Fix: declare line_rec as jsonb. Payload remains jsonb; walk-in customer_id NULL
-- remains supported for fully paid sales.
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

GRANT EXECUTE ON FUNCTION public.create_sale(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_sale(jsonb) FROM PUBLIC, anon;
