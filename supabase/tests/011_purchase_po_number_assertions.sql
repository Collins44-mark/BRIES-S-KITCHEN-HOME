-- =============================================================================
-- Phase PO numbering assertions (manual / staging)
-- Not applied by migrate — reference checks for next_purchase_number().
-- =============================================================================
-- Expected after 011_purchase_po_numbers_and_docs.sql:
--
-- A. next_purchase_number() returns PO-001 then PO-002 (sequential)
-- B. Concurrent calls cannot return the same PO (row-level UPSERT lock)
-- C. Sales INV counter (1970-01-01) is independent of PO counter (1970-01-02)
-- D. Historical purchase.reference rows are NOT rewritten by this migration
-- =============================================================================

DO $$
DECLARE
  a text;
  b text;
  inv_before integer;
  po_before integer;
BEGIN
  SELECT COALESCE(last_value, 0) INTO inv_before
  FROM public.invoice_counters
  WHERE counter_date = DATE '1970-01-01';

  SELECT COALESCE(last_value, 0) INTO po_before
  FROM public.invoice_counters
  WHERE counter_date = DATE '1970-01-02';

  -- Direct allocate (SECURITY DEFINER; run as privileged role in staging)
  a := public.next_purchase_number();
  b := public.next_purchase_number();

  ASSERT a <> b, 'Two sequential PO numbers must differ';
  ASSERT a ~ '^PO-[0-9]{3,}$', 'PO format must be PO-###+';
  ASSERT b ~ '^PO-[0-9]{3,}$', 'PO format must be PO-###+';

  -- Sales counter must be unchanged by purchase allocations
  ASSERT (
    SELECT COALESCE(last_value, 0)
    FROM public.invoice_counters
    WHERE counter_date = DATE '1970-01-01'
  ) = COALESCE(inv_before, 0),
  'Sales INV counter must not change when allocating PO numbers';

  ASSERT (
    SELECT last_value FROM public.invoice_counters WHERE counter_date = DATE '1970-01-02'
  ) = COALESCE(po_before, 0) + 2,
  'PO counter must advance by 2';

  RAISE NOTICE 'PO numbering assertions passed: % then %', a, b;
END;
$$;
