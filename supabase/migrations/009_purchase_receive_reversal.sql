-- =============================================================================
-- 009_purchase_receive_reversal.sql
-- Phase 6B-2: Safe reverse/cancel of a RECEIVED purchase
--
-- - Adds inventory_movement_type PURCHASE_REVERSAL
-- - Creates reverse_received_purchase(p_purchase_id uuid)
-- - Does NOT change receive_purchase stock/cost logic
-- - Does NOT delete historical purchases, items, or PURCHASE movements
-- - Does NOT roll back products.cost_price
-- - Rejects reversal when amount_paid > 0 (no supplier AP workflow yet)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum: PURCHASE_REVERSAL (immutable history; original PURCHASE rows stay)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'inventory_movement_type'
      AND e.enumlabel = 'PURCHASE_REVERSAL'
  ) THEN
    ALTER TYPE public.inventory_movement_type ADD VALUE 'PURCHASE_REVERSAL';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. RPC: reverse_received_purchase
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
  result jsonb;
BEGIN
  staff := public.require_staff_roles(
    ARRAY['ADMIN', 'MANAGER', 'INVENTORY_MANAGER']::public.staff_role[]
  );

  PERFORM set_config('bries.allow_inventory_mutation', 'true', true);

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'purchase_id is required';
  END IF;

  -- Lock purchase first (concurrency / double-reverse protection).
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

  -- Stock reversal only — do not rewrite financial history.
  -- Settled/partial payments require future supplier-payment workflow.
  IF purchase_row.amount_paid > 0 THEN
    RAISE EXCEPTION
      'Cannot reverse a purchase with recorded payment. Handle supplier payment first.';
  END IF;

  -- Collect product ids (deterministic lock order).
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

  -- Pre-check: reversing must never drive any stock negative.
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

  -- Apply stock reductions + immutable reversal movements.
  -- cost_price is intentionally NOT changed (preserve last-write cost policy).
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
      -- Cast via text so ADD VALUE in this migration is usable at runtime
      -- (Postgres disallows using a newly added enum label until commit).
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

COMMENT ON FUNCTION public.reverse_received_purchase(uuid) IS
  'Atomically reverse a RECEIVED unpaid purchase: reduce base stock, insert PURCHASE_REVERSAL movements, set status CANCELLED. Does not alter cost_price or delete history.';

GRANT EXECUTE ON FUNCTION public.reverse_received_purchase(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reverse_received_purchase(uuid) FROM PUBLIC, anon;
