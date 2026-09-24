-- =============================================================================
-- 010_supplier_purchase_payments.sql
-- Phase 6B-3: Supplier payments & purchase payment integrity
--
-- - purchase_payments ledger (separate from customer payments)
-- - record_purchase_payment RPC (ADMIN/MANAGER)
-- - receive_purchase seeds an initial payment row when amount_paid > 0
-- - amount_paid / payment_status derived from purchase_payments
-- - reverse_received_purchase still rejects amount_paid > 0
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table: purchase_payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  amount numeric(18, 2) NOT NULL,
  method public.payment_method NOT NULL,
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  idempotency_key uuid NOT NULL,
  CONSTRAINT purchase_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT purchase_payments_method_not_credit CHECK (method <> 'CREDIT'),
  CONSTRAINT purchase_payments_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS purchase_payments_purchase_id_idx
  ON public.purchase_payments (purchase_id);

CREATE INDEX IF NOT EXISTS purchase_payments_supplier_id_idx
  ON public.purchase_payments (supplier_id);

CREATE INDEX IF NOT EXISTS purchase_payments_paid_at_idx
  ON public.purchase_payments (paid_at DESC);

COMMENT ON TABLE public.purchase_payments IS
  'Supplier payments against purchases. Authoritative source for purchases.amount_paid.';

ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_payments_select_staff ON public.purchase_payments;
CREATE POLICY purchase_payments_select_staff
  ON public.purchase_payments FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- No client INSERT/UPDATE/DELETE — SECURITY DEFINER RPCs only.
GRANT SELECT ON public.purchase_payments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.purchase_payments FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Backfill existing amount_paid into ledger (preserve history)
-- -----------------------------------------------------------------------------
INSERT INTO public.purchase_payments (
  purchase_id,
  supplier_id,
  amount,
  method,
  reference,
  notes,
  paid_at,
  created_by,
  idempotency_key
)
SELECT
  p.id,
  p.supplier_id,
  p.amount_paid,
  'CASH'::public.payment_method,
  p.reference,
  'Backfilled from purchase amount_paid at Phase 6B-3',
  COALESCE(p.received_at, p.created_at),
  p.created_by_id,
  gen_random_uuid()
FROM public.purchases p
WHERE p.amount_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.purchase_payments pp WHERE pp.purchase_id = p.id
  );

-- -----------------------------------------------------------------------------
-- 3. Helper: recompute purchase amount_paid + payment_status from ledger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_purchase_payment_state(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(18, 2);
  v_paid numeric(18, 2);
  v_status public.payment_status;
BEGIN
  SELECT p.total_amount INTO v_total
  FROM public.purchases p
  WHERE p.id = p_purchase_id
  FOR UPDATE;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  SELECT public.money_round(COALESCE(SUM(pp.amount), 0))
  INTO v_paid
  FROM public.purchase_payments pp
  WHERE pp.purchase_id = p_purchase_id;

  IF v_paid > v_total THEN
    RAISE EXCEPTION 'Purchase payments exceed purchase total_amount';
  END IF;

  IF v_paid = 0 THEN
    v_status := 'PENDING';
  ELSIF v_paid < v_total THEN
    v_status := 'PARTIAL';
  ELSE
    v_status := 'PAID';
  END IF;

  UPDATE public.purchases
  SET
    amount_paid = v_paid,
    payment_status = v_status
  WHERE id = p_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_purchase_payment_state(uuid) FROM PUBLIC, anon;
-- Internal helper; not granted to authenticated clients.

-- -----------------------------------------------------------------------------
-- 4. Helper: purchase JSON result including payments + amount_due
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_receive_result(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
    'amount_due', public.money_round(p.total_amount - p.amount_paid),
    'notes', p.notes,
    'purchase_date', p.purchase_date,
    'received_at', p.received_at,
    'idempotency_key', p.idempotency_key,
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.id)
      FROM public.purchase_items pi
      WHERE pi.purchase_id = p.id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'amount', pp.amount,
          'method', pp.method,
          'reference', pp.reference,
          'notes', pp.notes,
          'paid_at', pp.paid_at,
          'created_at', pp.created_at,
          'created_by_id', pp.created_by,
          'created_by_name', trim(BOTH FROM COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, ''))
        )
        ORDER BY pp.paid_at ASC, pp.created_at ASC
      )
      FROM public.purchase_payments pp
      LEFT JOIN public.profiles pr ON pr.id = pp.created_by
      WHERE pp.purchase_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.purchases p
  WHERE p.id = p_purchase_id;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: record_purchase_payment
-- Payload:
-- {
--   "purchase_id": "uuid",
--   "amount": 1000,
--   "method": "CASH"|"MPESA"|"BANK",
--   "reference": null,
--   "notes": null,
--   "idempotency_key": "uuid"   -- REQUIRED
-- }
-- -----------------------------------------------------------------------------
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
  idempotency_key uuid;
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
    idempotency_key := (payload ->> 'idempotency_key')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'idempotency_key must be a valid UUID';
  END;

  IF idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  -- Idempotent replay
  SELECT pp.id INTO payment_id
  FROM public.purchase_payments pp
  WHERE pp.idempotency_key = idempotency_key;

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
    idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO payment_id;

  IF payment_id IS NULL THEN
    -- Concurrent retry with same key
    SELECT pp.purchase_id INTO v_purchase_id
    FROM public.purchase_payments pp
    WHERE pp.idempotency_key = idempotency_key;
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

-- -----------------------------------------------------------------------------
-- 6. Update receive_purchase: seed ledger when amount_paid > 0
--     (full replace preserves 008 behavior + payment row integrity)
-- -----------------------------------------------------------------------------
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

  reference := NULLIF(trim(BOTH FROM COALESCE(payload ->> 'reference', '')), '');
  IF reference IS NULL THEN
    reference := 'PO-' || to_char(now() AT TIME ZONE 'Africa/Dar_es_Salaam', 'YYYYMMDDHH24MISS')
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;

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

-- -----------------------------------------------------------------------------
-- 7. Tighten reverse_received_purchase payment guard (status-aware message)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_received_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff public.profiles;
  purchase_row public.purchases;
  item_row public.purchase_items;
  locked_product public.products;
  product_ids uuid[];
  pid uuid;
  qty_before integer;
  qty_after integer;
  payment_count integer;
  result jsonb;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[]
  );

  PERFORM set_config('bries.allow_inventory_mutation', 'true', true);

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'purchase_id is required';
  END IF;

  SELECT * INTO purchase_row
  FROM public.purchases p
  WHERE p.id = p_purchase_id
  FOR UPDATE;

  IF purchase_row.id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  IF purchase_row.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Purchase is already cancelled';
  END IF;

  IF purchase_row.status <> 'RECEIVED' THEN
    RAISE EXCEPTION 'Only RECEIVED purchases can be reversed. Current status is %',
      purchase_row.status;
  END IF;

  SELECT COUNT(*)::integer INTO payment_count
  FROM public.purchase_payments pp
  WHERE pp.purchase_id = purchase_row.id;

  IF purchase_row.amount_paid > 0 OR payment_count > 0 THEN
    RAISE EXCEPTION
      'Cannot reverse a purchase with recorded payment. Handle supplier payment first.';
  END IF;

  SELECT array_agg(DISTINCT pi.product_id ORDER BY pi.product_id)
  INTO product_ids
  FROM public.purchase_items pi
  WHERE pi.purchase_id = purchase_row.id;

  IF product_ids IS NULL OR array_length(product_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Purchase has no items to reverse';
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
  END LOOP;

  FOR item_row IN
    SELECT *
    FROM public.purchase_items pi
    WHERE pi.purchase_id = purchase_row.id
    ORDER BY pi.product_id, pi.id
  LOOP
    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = item_row.product_id;

    IF locked_product.stock_quantity < item_row.quantity THEN
      RAISE EXCEPTION
        'Cannot reverse purchase: insufficient stock for product % (have %, need %)',
        locked_product.name,
        locked_product.stock_quantity,
        item_row.quantity;
    END IF;
  END LOOP;

  FOR item_row IN
    SELECT *
    FROM public.purchase_items pi
    WHERE pi.purchase_id = purchase_row.id
    ORDER BY pi.product_id, pi.id
  LOOP
    SELECT * INTO locked_product
    FROM public.products p
    WHERE p.id = item_row.product_id;

    qty_before := locked_product.stock_quantity;
    qty_after := qty_before - item_row.quantity;

    UPDATE public.products
    SET stock_quantity = qty_after
    WHERE id = item_row.product_id;

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
      item_row.product_id,
      ('PURCHASE_REVERSAL'::text)::public.inventory_movement_type,
      -item_row.quantity,
      qty_before,
      qty_after,
      item_row.unit_cost,
      purchase_row.reference,
      'Reversal of purchase ' || purchase_row.reference,
      staff.id
    );
  END LOOP;

  UPDATE public.purchases
  SET status = 'CANCELLED'
  WHERE id = purchase_row.id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'REVERSE_RECEIVED_PURCHASE',
    'purchases',
    purchase_row.id,
    jsonb_build_object(
      'reference', purchase_row.reference,
      'previous_status', purchase_row.status,
      'new_status', 'CANCELLED',
      'total_amount', purchase_row.total_amount,
      'amount_paid', purchase_row.amount_paid
    )
  );

  result := public.purchase_receive_result(purchase_row.id);
  RETURN result;
END;
$$;
