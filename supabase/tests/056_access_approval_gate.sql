-- Access approval gate staging harness.
-- Target: qokaaggeqahayxsybgds only.
-- Run with:
--   supabase db query --linked --file supabase/tests/056_access_approval_gate.sql
--
-- All fixtures are isolated by UUID/token and rolled back.

BEGIN;

DO $$
DECLARE
  v_rls boolean;
  v_force_rls boolean;
BEGIN
  SELECT c.relrowsecurity, c.relforcerowsecurity
  INTO v_rls, v_force_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'access_requests';

  IF v_rls IS DISTINCT FROM true OR v_force_rls IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access_requests must have enabled and forced RLS';
  END IF;

  IF has_table_privilege('anon', 'public.access_requests', 'SELECT')
     OR has_table_privilege('anon', 'public.access_requests', 'INSERT')
     OR has_table_privilege('anon', 'public.access_requests', 'UPDATE')
     OR has_table_privilege('anon', 'public.access_requests', 'DELETE') THEN
    RAISE EXCEPTION 'anon unexpectedly retains access_requests table privileges';
  END IF;

  IF has_table_privilege('authenticated', 'public.access_requests', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has access_requests DELETE';
  END IF;

  IF NOT has_column_privilege(
    'authenticated',
    'public.access_requests',
    'status',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'authenticated lost access_requests status SELECT';
  END IF;

  IF has_column_privilege(
    'authenticated',
    'public.access_requests',
    'email',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'authenticated unexpectedly has access_requests email SELECT';
  END IF;
END $$;

CREATE TEMP TABLE access_gate_fixture (
  token text NOT NULL,
  caller_id uuid NOT NULL,
  other_id uuid NOT NULL,
  caller_request_id uuid
) ON COMMIT DROP;

INSERT INTO access_gate_fixture (token, caller_id, other_id)
VALUES (
  'access-gate-' || gen_random_uuid()::text,
  gen_random_uuid(),
  gen_random_uuid()
);

GRANT SELECT ON access_gate_fixture TO authenticated, service_role;

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  caller_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  token || '-caller@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
FROM access_gate_fixture
UNION ALL
SELECT
  other_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  token || '-other@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
FROM access_gate_fixture;

SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT caller_id::text FROM access_gate_fixture),
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

INSERT INTO public.access_requests (
  user_id,
  full_name,
  business_name,
  business_type,
  city,
  email
)
SELECT
  caller_id,
  token || ' Caller',
  token || ' Store',
  'grocery',
  'Pune',
  token || '-caller@example.test'
FROM access_gate_fixture;

DO $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.access_requests;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'own request did not default to pending';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.access_requests (
      user_id,
      full_name,
      business_name,
      business_type,
      city,
      email
    )
    SELECT
      other_id,
      token || ' Forged',
      token || ' Forged Store',
      'general',
      'Mumbai',
      token || '-forged@example.test'
    FROM access_gate_fixture;

    RAISE EXCEPTION 'cross-user access request insert was not rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.access_requests (
      user_id,
      full_name,
      business_name,
      business_type,
      city,
      email,
      status,
      reviewed_at
    )
    SELECT
      other_id,
      token || ' Preapproved',
      token || ' Preapproved Store',
      'general',
      'Mumbai',
      token || '-preapproved@example.test',
      'approved',
      now()
    FROM access_gate_fixture;

    RAISE EXCEPTION 'pre-approved access request insert was not rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.access_requests
    SET status = 'approved',
        reviewed_at = now();

    RAISE EXCEPTION 'self-approval update was not rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE 'access request review is managed by BharatGrowth%' THEN
        RAISE;
      END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.access_requests
    SET reviewed_at = now();

    RAISE EXCEPTION 'reviewed_at mutation was not rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE 'access request review is managed by BharatGrowth%' THEN
        RAISE;
      END IF;
  END;
END $$;

RESET ROLE;

UPDATE access_gate_fixture fixture
SET caller_request_id = request.id
FROM public.access_requests request
WHERE request.user_id = fixture.caller_id;

INSERT INTO public.access_requests (
  user_id,
  full_name,
  business_name,
  business_type,
  city,
  email
)
SELECT
  other_id,
  token || ' Other',
  token || ' Other Store',
  'general',
  'Mumbai',
  token || '-other@example.test'
FROM access_gate_fixture;

SET LOCAL ROLE service_role;

UPDATE public.access_requests
SET status = 'approved',
    reviewed_at = now()
WHERE id = (SELECT caller_request_id FROM access_gate_fixture)
  AND status = 'pending';

RESET ROLE;

DO $$
DECLARE
  v_status text;
  v_reviewed_at timestamptz;
  v_shop_count integer;
BEGIN
  SELECT status, reviewed_at
  INTO v_status, v_reviewed_at
  FROM public.access_requests
  WHERE id = (SELECT caller_request_id FROM access_gate_fixture);

  IF v_status IS DISTINCT FROM 'approved' OR v_reviewed_at IS NULL THEN
    RAISE EXCEPTION 'privileged approval transition did not persist';
  END IF;

  SELECT count(*) INTO v_shop_count
  FROM public.users
  WHERE id IN (
    SELECT caller_id FROM access_gate_fixture
    UNION ALL
    SELECT other_id FROM access_gate_fixture
  );

  IF v_shop_count <> 0 THEN
    RAISE EXCEPTION 'access approval unexpectedly created a shop membership';
  END IF;
END $$;

ROLLBACK;
