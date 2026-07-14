-- =============================================================================
-- perf/local-ci/bootstrap.sql — Docker-less local validation shim
--
-- WHEN TO USE: ONLY in an environment that has a plain Postgres but cannot run
-- `supabase start` (no Docker) — e.g. an automation/CI container. It recreates
-- the minimal Supabase-provided scaffolding (roles + auth/storage schemas +
-- auth.uid()) that `supabase start` normally supplies, so the real repo
-- migrations 001-035 apply and the perf seed/invariant scripts can be validated.
--
-- ON A DEV MACHINE YOU DO NOT NEED THIS. `supabase start` + `supabase db reset`
-- provide the real auth/storage stack. This shim is a fallback, not production
-- parity: it stubs auth/storage just enough for schema + DB-level testing.
--
-- Apply order (against a fresh local DB), with function-body checks off so the
-- ordered migrations that forward-reference tables load cleanly:
--   createdb bg_perf
--   PGOPTIONS='-c check_function_bodies=off' psql -d bg_perf -f perf/local-ci/bootstrap.sql
--   for f in supabase/migrations/0*.sql; do  # skip 011 until after seed.sql
--     PGOPTIONS='-c check_function_bodies=off' psql -d bg_perf -f "$f"; done
--   psql -d bg_perf -f supabase/seed.sql
-- =============================================================================

-- ── Roles Supabase provides ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOINHERIT LOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO postgres;

-- ── auth schema ──
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid, id uuid PRIMARY KEY, aud varchar(255), role varchar(255),
  email varchar(255), encrypted_password varchar(255), email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  confirmation_token varchar(255), recovery_token varchar(255),
  email_change_token_new varchar(255), email_change varchar(255), phone text
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid, user_id uuid, identity_data jsonb, provider text, provider_id text,
  last_sign_in_at timestamptz, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), PRIMARY KEY (id)
);

-- auth.uid(): mirrors real Supabase — reads the JWT-sub GUC. A perf.uid fallback
-- lets direct-SQL seeding set a caller without a JWT. Returns NULL when unset.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('perf.uid', true), '')
  )::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
  SELECT COALESCE(NULLIF(current_setting('perf.role', true), ''), 'authenticated');
$$ LANGUAGE sql STABLE;

-- ── storage schema (buckets + objects + foldername) ──
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id), name text, owner uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] AS $$
  SELECT string_to_array(name, '/');
$$ LANGUAGE sql IMMUTABLE;

GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated, service_role;

-- ── Table privileges Supabase grants to its roles ──
-- Real Supabase grants CRUD to anon/authenticated (RLS then restricts the rows)
-- and full access to service_role. Migrations don't restate this (Supabase sets
-- it up), so mirror it here via DEFAULT PRIVILEGES BEFORE the migrations run, so
-- every table they create is auto-granted. Without this, RLS can't be exercised
-- (the role would be blocked by table privilege, not by policy).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
