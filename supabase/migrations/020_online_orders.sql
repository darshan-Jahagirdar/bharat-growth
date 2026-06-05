-- =========================================================================
-- Migration 020: Online Order Support
-- Adds 'pending_online' status, 'online_upi'/'online_khata' payment modes,
-- and delivery_address column.
--
-- Run this in Supabase SQL Editor.
-- =========================================================================

-- Step 1: Drop ALL check constraints on status and payment_mode
-- (Postgres auto-names inline checks inconsistently)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'invoices'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%status%'
        OR pg_get_constraintdef(oid) ILIKE '%payment_mode%'
      )
  LOOP
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Step 2: Re-add with expanded values
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'completed', 'cancelled', 'returned', 'pending_online'));

ALTER TABLE invoices ADD CONSTRAINT invoices_payment_mode_check
  CHECK (payment_mode IN ('cash', 'upi', 'card', 'credit', 'split', 'online_upi', 'online_khata'));

-- Step 3: Add delivery_address column
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_address text;
