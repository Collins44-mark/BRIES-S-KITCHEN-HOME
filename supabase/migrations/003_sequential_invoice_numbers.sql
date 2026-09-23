-- =============================================================================
-- 003: Sequential invoice numbers (INV-001, INV-002, ...)
--
-- Previous format (date-based):
--   INV-YYYYMMDD-00001 via per-day rows in public.invoice_counters
--
-- New format (global sequential):
--   INV-001, INV-002, ... INV-099, INV-100, INV-1000
--   Padding: at least 3 digits; values >= 1000 use the full number (no truncation).
--
-- Concurrency:
--   Still uses INSERT ... ON CONFLICT DO UPDATE on invoice_counters so two
--   concurrent create_sale() calls cannot receive the same sequence value.
--   create_sale continues to call public.next_invoice_number() inside its
--   transaction; clients cannot supply invoice_number.
--
-- Counter key:
--   A single global row keyed by counter_date = DATE '1970-01-01'
--   (reuses the existing table/PK without schema redesign).
--
-- Production init:
--   Sets the global counter last_value = 0 so the next sale becomes INV-001.
--   Does NOT delete or rewrite sales / payments / inventory / ledger rows.
--   After a separate test-data cleanup, re-run the init upsert below (or leave
--   this migration's init as-is if cleanup happens before first real sale).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Fixed sentinel date = global sequential counter (not a calendar day).
  counter_key date := DATE '1970-01-01';
  seq integer;
  seq_text text;
BEGIN
  INSERT INTO public.invoice_counters AS ic (counter_date, last_value)
  VALUES (counter_key, 1)
  ON CONFLICT (counter_date)
  DO UPDATE SET last_value = ic.last_value + 1
  RETURNING last_value INTO seq;

  seq_text := seq::text;
  -- Pad to 3 digits for 1..999; do not truncate larger values (PG lpad truncates).
  IF char_length(seq_text) < 3 THEN
    seq_text := lpad(seq_text, 3, '0');
  END IF;

  RETURN 'INV-' || seq_text;
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM authenticated, anon;

-- Drop obsolete per-day counter rows (not business data). Global key remains.
DELETE FROM public.invoice_counters
WHERE counter_date <> DATE '1970-01-01';

-- Initialize / reset global counter to 0 → next allocate yields INV-001.
INSERT INTO public.invoice_counters (counter_date, last_value)
VALUES (DATE '1970-01-01', 0)
ON CONFLICT (counter_date)
DO UPDATE SET last_value = EXCLUDED.last_value;

COMMENT ON FUNCTION public.next_invoice_number() IS
  'Allocates the next global sale invoice number (INV-001, INV-002, …). '
  'Concurrency-safe via UPSERT on invoice_counters (key 1970-01-01). '
  'Called only from create_sale; not granted to clients.';
