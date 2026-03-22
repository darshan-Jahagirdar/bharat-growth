-- =========================================================================
-- Migration 001: Extensions and Helper Functions
-- BharatGrowth — Supabase Multi-Tenant Schema
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Auto-update updated_at trigger function ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Indian financial year: April 1 → March 31 ──
CREATE OR REPLACE FUNCTION get_financial_year(d date DEFAULT CURRENT_DATE)
RETURNS varchar(7) AS $$
BEGIN
  IF EXTRACT(MONTH FROM d) >= 4 THEN
    RETURN EXTRACT(YEAR FROM d)::text || '-' ||
           SUBSTRING((EXTRACT(YEAR FROM d) + 1)::text FROM 3);
  ELSE
    RETURN (EXTRACT(YEAR FROM d) - 1)::text || '-' ||
           SUBSTRING(EXTRACT(YEAR FROM d)::text FROM 3);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Resolve current user's shop_id ──
-- Wraps auth.uid() in (SELECT ...) for initplan optimization
CREATE OR REPLACE FUNCTION get_current_shop_id()
RETURNS uuid AS $$
  SELECT shop_id FROM public.users WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ── Consent log immutability enforcer (DPDP Act 2026) ──
CREATE OR REPLACE FUNCTION prevent_consent_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_logs is append-only: % operations are not permitted', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
