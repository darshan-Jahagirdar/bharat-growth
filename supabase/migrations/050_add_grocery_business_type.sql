-- =========================================================================
-- Migration 050: Add grocery as a supported shop business type
-- =========================================================================

ALTER TABLE public.shops
  DROP CONSTRAINT shops_business_type_check,
  ADD CONSTRAINT shops_business_type_check CHECK (
    business_type IN ('tyre_shop', 'sweet_stall', 'garment_store', 'grocery', 'general')
  );
