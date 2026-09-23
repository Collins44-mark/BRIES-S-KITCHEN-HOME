-- =============================================================================
-- 004: Product selling units + optional wholesale price tiers (Phase 1)
--
-- Household/kitchenware only: PCS | SET | PACK | DOZEN | BOX | CARTON
-- Inventory remains products.stock_quantity in BASE units (normally PCS).
-- Selling units are configurations (conversion + retail price), not stock pools.
-- Purchases remain base-unit only in this phase (no purchase conversion).
-- create_sale / receive_purchase / POS are NOT changed here.
--
-- Does NOT rewrite historical sales/purchases/payments/movements money or qty
-- beyond safe nullable sale_items snapshot columns + base_quantity = quantity.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Allowed unit codes
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'product_unit_code'
  ) THEN
    CREATE TYPE public.product_unit_code AS ENUM (
      'PCS',
      'SET',
      'PACK',
      'DOZEN',
      'BOX',
      'CARTON'
    );
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- B. product_units
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  unit_code public.product_unit_code NOT NULL,
  unit_label text,
  conversion_to_base integer NOT NULL DEFAULT 1,
  selling_price numeric(18, 2) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_units_conversion_positive CHECK (conversion_to_base >= 1),
  CONSTRAINT product_units_selling_price_nonneg CHECK (selling_price >= 0),
  CONSTRAINT product_units_pcs_conversion_one CHECK (
    unit_code <> 'PCS'::public.product_unit_code
    OR conversion_to_base = 1
  )
);

-- One row per product/unit_code (inactive rows keep the slot).
CREATE UNIQUE INDEX IF NOT EXISTS product_units_product_code_uidx
  ON public.product_units (product_id, unit_code);

-- Exactly one active default selling unit per product.
CREATE UNIQUE INDEX IF NOT EXISTS product_units_one_default_active_uidx
  ON public.product_units (product_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX IF NOT EXISTS product_units_product_id_idx
  ON public.product_units (product_id);

CREATE INDEX IF NOT EXISTS product_units_product_active_idx
  ON public.product_units (product_id, is_active);

CREATE INDEX IF NOT EXISTS product_units_product_default_active_idx
  ON public.product_units (product_id)
  WHERE is_default = true AND is_active = true;

CREATE TRIGGER product_units_set_updated_at
  BEFORE UPDATE ON public.product_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- C. product_price_tiers (wholesale bands per selling unit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_unit_id uuid NOT NULL REFERENCES public.product_units (id) ON DELETE CASCADE,
  min_quantity integer NOT NULL,
  unit_price numeric(18, 2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_price_tiers_min_qty_positive CHECK (min_quantity >= 1),
  CONSTRAINT product_price_tiers_unit_price_nonneg CHECK (unit_price >= 0)
);

-- Avoid duplicate active mins on the same selling unit.
CREATE UNIQUE INDEX IF NOT EXISTS product_price_tiers_unit_min_active_uidx
  ON public.product_price_tiers (product_unit_id, min_quantity)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS product_price_tiers_product_unit_id_idx
  ON public.product_price_tiers (product_unit_id);

CREATE INDEX IF NOT EXISTS product_price_tiers_unit_active_idx
  ON public.product_price_tiers (product_unit_id, is_active, min_quantity);

CREATE TRIGGER product_price_tiers_set_updated_at
  BEFORE UPDATE ON public.product_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- D. sale_items nullable unit snapshots (historical sales otherwise untouched)
-- -----------------------------------------------------------------------------
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_unit_id uuid
    REFERENCES public.product_units (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selling_unit_code public.product_unit_code,
  ADD COLUMN IF NOT EXISTS selling_unit_label text,
  ADD COLUMN IF NOT EXISTS conversion_to_base integer,
  ADD COLUMN IF NOT EXISTS base_quantity integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sale_items_conversion_positive'
      AND conrelid = 'public.sale_items'::regclass
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_conversion_positive
      CHECK (conversion_to_base IS NULL OR conversion_to_base >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sale_items_base_quantity_positive'
      AND conrelid = 'public.sale_items'::regclass
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_base_quantity_positive
      CHECK (base_quantity IS NULL OR base_quantity >= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS sale_items_product_unit_id_idx
  ON public.sale_items (product_unit_id);

-- Safe identity backfill: legacy sales treated quantity as the stock deduction (1:1).
UPDATE public.sale_items
SET base_quantity = quantity
WHERE base_quantity IS NULL;

-- Do NOT invent selling_unit_code / label / conversion / product_unit_id for history.

-- -----------------------------------------------------------------------------
-- E. Backfill default PCS unit for every existing product
-- -----------------------------------------------------------------------------
INSERT INTO public.product_units (
  product_id,
  unit_code,
  unit_label,
  conversion_to_base,
  selling_price,
  is_default,
  is_active,
  sort_order
)
SELECT
  p.id,
  'PCS'::public.product_unit_code,
  'PCS',
  1,
  p.selling_price,
  true,
  true,
  0
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_units pu
  WHERE pu.product_id = p.id
    AND pu.unit_code = 'PCS'::public.product_unit_code
)
ON CONFLICT (product_id, unit_code) DO NOTHING;

-- Ensure exactly one active default: prefer PCS when multiple defaults somehow exist.
UPDATE public.product_units pu
SET is_default = false
WHERE pu.is_default = true
  AND pu.is_active = true
  AND pu.unit_code <> 'PCS'::public.product_unit_code
  AND EXISTS (
    SELECT 1
    FROM public.product_units pcs
    WHERE pcs.product_id = pu.product_id
      AND pcs.unit_code = 'PCS'::public.product_unit_code
      AND pcs.is_active = true
  );

UPDATE public.product_units pu
SET is_default = true
WHERE pu.unit_code = 'PCS'::public.product_unit_code
  AND pu.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_units d
    WHERE d.product_id = pu.product_id
      AND d.is_default = true
      AND d.is_active = true
  );

-- Auto-create default PCS unit when a new product is inserted (keeps Phase 1 invariant).
CREATE OR REPLACE FUNCTION public.products_ensure_default_pcs_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_units (
    product_id,
    unit_code,
    unit_label,
    conversion_to_base,
    selling_price,
    is_default,
    is_active,
    sort_order
  )
  VALUES (
    NEW.id,
    'PCS'::public.product_unit_code,
    'PCS',
    1,
    NEW.selling_price,
    true,
    true,
    0
  )
  ON CONFLICT (product_id, unit_code) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_ensure_default_pcs_unit ON public.products;
CREATE TRIGGER products_ensure_default_pcs_unit
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_ensure_default_pcs_unit();

REVOKE ALL ON FUNCTION public.products_ensure_default_pcs_unit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.products_ensure_default_pcs_unit() FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- G. RLS — match products model; cashiers read-only for configuration
-- -----------------------------------------------------------------------------
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_units_select_staff ON public.product_units;
CREATE POLICY product_units_select_staff
  ON public.product_units FOR SELECT TO authenticated
  USING (public.is_active_staff());

DROP POLICY IF EXISTS product_units_insert_managers ON public.product_units;
CREATE POLICY product_units_insert_managers
  ON public.product_units FOR INSERT TO authenticated
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[])
  );

DROP POLICY IF EXISTS product_units_update_managers ON public.product_units;
CREATE POLICY product_units_update_managers
  ON public.product_units FOR UPDATE TO authenticated
  USING (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[])
  )
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[])
  );

DROP POLICY IF EXISTS product_units_delete_admin ON public.product_units;
CREATE POLICY product_units_delete_admin
  ON public.product_units FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

DROP POLICY IF EXISTS product_price_tiers_select_staff ON public.product_price_tiers;
CREATE POLICY product_price_tiers_select_staff
  ON public.product_price_tiers FOR SELECT TO authenticated
  USING (public.is_active_staff());

DROP POLICY IF EXISTS product_price_tiers_insert_managers ON public.product_price_tiers;
CREATE POLICY product_price_tiers_insert_managers
  ON public.product_price_tiers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[])
  );

DROP POLICY IF EXISTS product_price_tiers_update_managers ON public.product_price_tiers;
CREATE POLICY product_price_tiers_update_managers
  ON public.product_price_tiers FOR UPDATE TO authenticated
  USING (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[])
  )
  WITH CHECK (
    public.has_staff_role(ARRAY['ADMIN', 'MANAGER']::public.staff_role[])
  );

DROP POLICY IF EXISTS product_price_tiers_delete_admin ON public.product_price_tiers;
CREATE POLICY product_price_tiers_delete_admin
  ON public.product_price_tiers FOR DELETE TO authenticated
  USING (public.has_staff_role(ARRAY['ADMIN']::public.staff_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_price_tiers TO authenticated;

COMMENT ON TABLE public.product_units IS
  'Per-product selling units (PCS/SET/…). Stock stays on products.stock_quantity in base units.';
COMMENT ON TABLE public.product_price_tiers IS
  'Optional wholesale tiers per selling unit; highest matching min_quantity wins.';
COMMENT ON COLUMN public.sale_items.base_quantity IS
  'Base-unit quantity for stock/COGS. Legacy rows backfilled as quantity (1:1).';
COMMENT ON COLUMN public.sale_items.selling_unit_code IS
  'Snapshot of selling unit at sale time; NULL for pre-units historical rows.';
