-- =============================================================================
-- 011_purchase_po_numbers_and_docs.sql
-- Sequential purchase references: PO-001, PO-002, ...
-- Reuses invoice_counters with a separate sentinel date (independent of INV-*).
-- Updates receive_purchase to always allocate via next_purchase_number().
-- Does NOT rewrite historical purchase references.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.next_purchase_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Separate from sales INV counter (1970-01-01).
  counter_key date := DATE '1970-01-02';
  seq integer;
  seq_text text;
BEGIN
  INSERT INTO public.invoice_counters AS ic (counter_date, last_value)
  VALUES (counter_key, 1)
  ON CONFLICT (counter_date)
  DO UPDATE SET last_value = ic.last_value + 1
  RETURNING last_value INTO seq;

  seq_text := seq::text;
  IF char_length(seq_text) < 3 THEN
    seq_text := lpad(seq_text, 3, '0');
  END IF;

  RETURN 'PO-' || seq_text;
END;
$$;

REVOKE ALL ON FUNCTION public.next_purchase_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_purchase_number() FROM authenticated, anon;

-- Init purchase counter only if missing. Do NOT reset if already advanced.
INSERT INTO public.invoice_counters (counter_date, last_value)
VALUES (DATE '1970-01-02', 0)
ON CONFLICT (counter_date)
DO NOTHING;

COMMENT ON FUNCTION public.next_purchase_number() IS
  'Allocates the next global purchase reference (PO-001, PO-002, …). '
  'Concurrency-safe via UPSERT on invoice_counters (key 1970-01-02). '
  'Independent from next_invoice_number() / INV-* sales counters.';


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
  idempotency_key uuid;
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
    idempotency_key := (payload ->> 'idempotency_key')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'idempotency_key must be a valid UUID';
  END;

  IF idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT p.id INTO purchase_id
  FROM public.purchases p
  WHERE p.idempotency_key = idempotency_key;

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
    idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO purchase_id;

  IF purchase_id IS NULL THEN
    SELECT p.id INTO purchase_id
    FROM public.purchases p
    WHERE p.idempotency_key = idempotency_key;

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
      idempotency_key
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
      'idempotency_key', idempotency_key
    )
  );

  RETURN public.purchase_receive_result(purchase_id);
END;
$$;

