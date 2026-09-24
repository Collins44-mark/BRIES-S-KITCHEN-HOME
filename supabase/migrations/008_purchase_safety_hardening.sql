-- =============================================================================
-- 008_purchase_safety_hardening.sql
-- Phase 6B-1: Purchase receive safety & data integrity
--
-- 1. Idempotency key on purchases + receive_purchase replay-safe behavior
-- 2. Server-derived payment_status from amount_paid vs total_amount
-- 3. Reject duplicate product_id lines in a single receive payload
--
-- Does NOT change: base-unit stock logic, cost update, RLS, roles, sales.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Idempotency key (unique per logical receive operation)
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

UPDATE public.purchases
SET idempotency_key = gen_random_uuid()
WHERE idempotency_key IS NULL;

ALTER TABLE public.purchases
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchases_idempotency_key_unique'
      AND conrelid = 'public.purchases'::regclass
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END;
$$;

COMMENT ON COLUMN public.purchases.idempotency_key IS
  'Client-supplied UUID identifying one logical receive_purchase operation. Retries with the same key return the existing purchase without re-applying stock.';

-- -----------------------------------------------------------------------------
-- 2. Helper: build receive_purchase JSON result
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
    'notes', p.notes,
    'purchase_date', p.purchase_date,
    'received_at', p.received_at,
    'idempotency_key', p.idempotency_key,
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.id)
      FROM public.purchase_items pi
      WHERE pi.purchase_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.purchases p
  WHERE p.id = p_purchase_id;
$$;

REVOKE ALL ON FUNCTION public.purchase_receive_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_receive_result(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. receive_purchase — hardened
-- Payload:
-- {
--   "idempotency_key": "uuid",          -- REQUIRED
--   "supplier_id": "uuid",
--   "reference": "optional",
--   "amount_paid": 0,
--   "purchase_date": "ISO"|null,
--   "notes": null,
--   "items": [{"product_id":"uuid","quantity":1,"unit_cost":1000}, ...]
-- }
-- payment_status from the client is IGNORED (derived server-side).
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
  idempotency_key uuid;

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
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[]
  );

  -- Allow stock/cost mutations inside this transaction.
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

  -- Idempotent replay (fast path): same key → return existing purchase, no stock change.
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

  -- Reject duplicate product_id lines (do not merge).
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

  -- payment_status from payload is intentionally ignored.
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

  -- Authoritative payment_status (enum: PENDING | PARTIAL | PAID | CANCELLED).
  -- amount_paid = 0 → PENDING (UNPAID equivalent in this schema)
  -- 0 < amount_paid < total → PARTIAL
  -- amount_paid = total → PAID
  IF amount_paid = 0 THEN
    payment_status := 'PENDING';
  ELSIF amount_paid < total_amount THEN
    payment_status := 'PARTIAL';
  ELSE
    payment_status := 'PAID';
  END IF;

  -- Insert purchase; concurrent retries with the same key lose the race safely.
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
    -- Another concurrent call created this purchase; return it without stock mutation.
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

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    staff.id,
    'RECEIVE_PURCHASE',
    'purchases',
    purchase_id,
    jsonb_build_object(
      'reference', reference,
      'total_amount', total_amount,
      'idempotency_key', idempotency_key
    )
  );

  RETURN public.purchase_receive_result(purchase_id);
END;
$$;

COMMENT ON FUNCTION public.receive_purchase(jsonb) IS
  'Atomically create a RECEIVED purchase, stock movements, and cost updates. Idempotent on idempotency_key. Derives payment_status server-side. Rejects duplicate product lines.';
