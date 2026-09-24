-- =============================================================================
-- 012_fix_purchase_idempotency_ambiguity.sql
--
-- Root cause (008/010/011): PL/pgSQL local variable `idempotency_key` collided
-- with table columns purchases.idempotency_key / purchase_payments.idempotency_key
-- under default #variable_conflict (error).
--
-- PostgreSQL error: column reference "idempotency_key" is ambiguous
-- Detail: It could refer to either a PL/pgSQL variable or a table column.
--
-- Exact failing pattern (same class as 006 product_id fix):
--   FROM public.purchases p
--   WHERE p.idempotency_key = idempotency_key;  -- RHS ambiguous
--
-- Also present in:
--   ON CONFLICT (idempotency_key) with a same-named local (inference conflict)
--   VALUES (..., idempotency_key) in some PG versions when target has the column
--
-- Fix: rename locals to v_idempotency_key. Keep column names, JSON keys,
-- unique constraints, PO numbering, payment ledger, and idempotent replay.
-- Function-only CREATE OR REPLACE. No schema / data changes.
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
  v_idempotency_key uuid;
  pay_method public.payment_method;

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
  initial_payment_id uuid;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[]
  );

  PERFORM set_config('bries.allow_inventory_mutation', 'true', true);

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid purchase payload';
  END IF;

  BEGIN
    v_idempotency_key := (payload ->> 'idempotency_key')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'idempotency_key must be a valid UUID';
  END;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT p.id INTO purchase_id
  FROM public.purchases p
  WHERE p.idempotency_key = v_idempotency_key;

  IF purchase_id IS NOT NULL THEN
    RETURN public.purchase_receive_result(purchase_id);
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

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(items) AS elem
    GROUP BY trim(BOTH FROM COALESCE(elem ->> 'product_id', ''))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate product lines are not allowed in a purchase';
  END IF;

  -- Always allocate sequential PO-### (ignore client reference).
  reference := public.next_purchase_number();

  notes := NULLIF(payload ->> 'notes', '');
  purchase_date := COALESCE((payload ->> 'purchase_date')::timestamptz, now());

  -- Optional method for initial payment at receive (default CASH when amount_paid > 0).
  BEGIN
    pay_method := NULLIF(payload ->> 'payment_method', '')::public.payment_method;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'payment method is invalid';
  END;

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

  IF amount_paid = 0 THEN
    payment_status := 'PENDING';
  ELSIF amount_paid < total_amount THEN
    payment_status := 'PARTIAL';
  ELSE
    payment_status := 'PAID';
  END IF;

  IF amount_paid > 0 THEN
    IF pay_method IS NULL THEN
      pay_method := 'CASH';
    END IF;
    IF pay_method = 'CREDIT' THEN
      RAISE EXCEPTION 'CREDIT is not allowed for supplier payments';
    END IF;
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
    received_at,
    idempotency_key
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
    now(),
    v_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO purchase_id;

  IF purchase_id IS NULL THEN
    SELECT p.id INTO purchase_id
    FROM public.purchases p
    WHERE p.idempotency_key = v_idempotency_key;

    IF purchase_id IS NULL THEN
      RAISE EXCEPTION 'Purchase receive conflict; please retry';
    END IF;

    RETURN public.purchase_receive_result(purchase_id);
  END IF;

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

  -- Seed ledger so amount_paid always equals SUM(purchase_payments).
  IF amount_paid > 0 THEN
    INSERT INTO public.purchase_payments (
      purchase_id,
      supplier_id,
      amount,
      method,
      reference,
      notes,
      created_by,
      idempotency_key
    )
    VALUES (
      purchase_id,
      supplier_id,
      amount_paid,
      pay_method,
      reference,
      'Payment recorded at receive',
      staff.id,
      v_idempotency_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO initial_payment_id;

    PERFORM public.recompute_purchase_payment_state(purchase_id);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'RECEIVE_PURCHASE',
    'purchases',
    purchase_id,
    jsonb_build_object(
      'reference', reference,
      'total_amount', total_amount,
      'amount_paid', amount_paid,
      'idempotency_key', v_idempotency_key
    )
  );

  RETURN public.purchase_receive_result(purchase_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_purchase_payment(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
  v_purchase_id uuid;
  amount numeric(18, 2);
  method public.payment_method;
  reference text;
  notes text;
  v_idempotency_key uuid;
  purchase_row public.purchases;
  payment_id uuid;
  existing_paid numeric(18, 2);
  new_paid numeric(18, 2);
  remaining numeric(18, 2);
  result jsonb;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER']::public.staff_role[]
  );

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payment payload';
  END IF;

  BEGIN
    v_idempotency_key := (payload ->> 'idempotency_key')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'idempotency_key must be a valid UUID';
  END;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  -- Idempotent replay
  SELECT pp.id INTO payment_id
  FROM public.purchase_payments pp
  WHERE pp.idempotency_key = v_idempotency_key;

  IF payment_id IS NOT NULL THEN
    SELECT pp.purchase_id INTO v_purchase_id
    FROM public.purchase_payments pp
    WHERE pp.id = payment_id;
    RETURN public.purchase_receive_result(v_purchase_id);
  END IF;

  v_purchase_id := (payload ->> 'purchase_id')::uuid;
  amount := public.money_round((payload ->> 'amount')::numeric);
  BEGIN
    method := (payload ->> 'method')::public.payment_method;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'payment method is required';
  END;
  reference := NULLIF(payload ->> 'reference', '');
  notes := NULLIF(payload ->> 'notes', '');

  IF v_purchase_id IS NULL THEN
    RAISE EXCEPTION 'purchase_id is required';
  END IF;

  IF method IS NULL THEN
    RAISE EXCEPTION 'payment method is required';
  END IF;

  IF method = 'CREDIT' THEN
    RAISE EXCEPTION 'CREDIT is not allowed for supplier payments';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than 0';
  END IF;

  SELECT * INTO purchase_row
  FROM public.purchases p
  WHERE p.id = v_purchase_id
  FOR UPDATE;

  IF purchase_row.id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  IF purchase_row.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Cannot record payment against a CANCELLED purchase';
  END IF;

  IF purchase_row.status <> 'RECEIVED' THEN
    RAISE EXCEPTION 'Only RECEIVED purchases can accept payments. Current status is %',
      purchase_row.status;
  END IF;

  SELECT public.money_round(COALESCE(SUM(pp.amount), 0))
  INTO existing_paid
  FROM public.purchase_payments pp
  WHERE pp.purchase_id = purchase_row.id;

  remaining := public.money_round(purchase_row.total_amount - existing_paid);

  IF amount > remaining THEN
    RAISE EXCEPTION 'Payment amount exceeds purchase amount due';
  END IF;

  new_paid := public.money_round(existing_paid + amount);

  INSERT INTO public.purchase_payments (
    purchase_id,
    supplier_id,
    amount,
    method,
    reference,
    notes,
    created_by,
    idempotency_key
  )
  VALUES (
    purchase_row.id,
    purchase_row.supplier_id,
    amount,
    method,
    reference,
    COALESCE(notes, 'Supplier purchase payment'),
    staff.id,
    v_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO payment_id;

  IF payment_id IS NULL THEN
    -- Concurrent retry with same key
    SELECT pp.purchase_id INTO v_purchase_id
    FROM public.purchase_payments pp
    WHERE pp.idempotency_key = v_idempotency_key;
    RETURN public.purchase_receive_result(v_purchase_id);
  END IF;

  PERFORM public.recompute_purchase_payment_state(purchase_row.id);

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'RECORD_PURCHASE_PAYMENT',
    'purchases',
    purchase_row.id,
    jsonb_build_object(
      'payment_id', payment_id,
      'amount', amount,
      'method', method,
      'reference', reference,
      'purchase_reference', purchase_row.reference,
      'new_amount_paid', new_paid
    )
  );

  RETURN public.purchase_receive_result(purchase_row.id);
END;
$$;

COMMENT ON FUNCTION public.record_purchase_payment(jsonb) IS
  'Record a supplier payment against a RECEIVED purchase. Updates amount_paid/payment_status from purchase_payments. Idempotent on idempotency_key.';

GRANT EXECUTE ON FUNCTION public.record_purchase_payment(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.record_purchase_payment(jsonb) FROM PUBLIC, anon;

