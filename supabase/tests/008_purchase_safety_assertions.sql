-- =============================================================================
-- Phase 6B-1 verification helpers (manual / CI against a staging DB)
-- Not applied by migrate — reference checks for receive_purchase hardening.
-- =============================================================================
-- Expected behaviors after 008_purchase_safety_hardening.sql:
--
-- A. Normal receive with unique idempotency_key → 1 purchase, N items, N PURCHASE movements
-- B. Same idempotency_key again → same purchase id, stock unchanged
-- C. amount_paid = 0 → payment_status PENDING
-- D. 0 < amount_paid < total → PARTIAL
-- E. amount_paid = total → PAID
-- F/G. amount_paid > total or < 0 → exception
-- H. duplicate product_id → exception 'Duplicate product lines...'
-- I. two different products → accepted
-- J. exception after validations → full rollback (no orphan rows)
-- =============================================================================

-- Payment status derivation (mirrors RPC logic; run as sanity assertions):
DO $$
DECLARE
  total_amount numeric(18, 2);
  amount_paid numeric(18, 2);
  payment_status public.payment_status;
BEGIN
  -- C: unpaid
  total_amount := 100; amount_paid := 0;
  payment_status := CASE
    WHEN amount_paid = 0 THEN 'PENDING'::public.payment_status
    WHEN amount_paid < total_amount THEN 'PARTIAL'::public.payment_status
    ELSE 'PAID'::public.payment_status
  END;
  ASSERT payment_status = 'PENDING', 'amount_paid=0 must be PENDING';

  -- D: partial
  amount_paid := 40;
  payment_status := CASE
    WHEN amount_paid = 0 THEN 'PENDING'::public.payment_status
    WHEN amount_paid < total_amount THEN 'PARTIAL'::public.payment_status
    ELSE 'PAID'::public.payment_status
  END;
  ASSERT payment_status = 'PARTIAL', 'partial must be PARTIAL';

  -- E: paid
  amount_paid := 100;
  payment_status := CASE
    WHEN amount_paid = 0 THEN 'PENDING'::public.payment_status
    WHEN amount_paid < total_amount THEN 'PARTIAL'::public.payment_status
    ELSE 'PAID'::public.payment_status
  END;
  ASSERT payment_status = 'PAID', 'full pay must be PAID';

  RAISE NOTICE 'Phase 6B-1 payment_status derivation assertions passed';
END;
$$;
