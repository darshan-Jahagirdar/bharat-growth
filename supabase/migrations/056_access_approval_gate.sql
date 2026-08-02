-- =========================================================================
-- Migration 056: access approval gate
--
-- Public signup creates an access request, not a shop. The authenticated
-- caller may submit request details and read only their own status. Review
-- fields remain a BharatGrowth-controlled decision.
--
-- The own-row UPDATE policy is intentional: without it, RLS can turn a
-- forbidden PostgREST UPDATE into a success-shaped zero-row response before
-- the trigger runs. The narrow column grant lets the row reach the trigger,
-- which rejects self-approval loudly with SQLSTATE 42501.
--
-- This gate is independent from shops.campaigns_approved. This migration
-- neither changes shops nor grants campaign sending approval. Existing users
-- who already have users.shop_id are grandfathered by the application layer.
-- =========================================================================

BEGIN;

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL
    CONSTRAINT access_requests_full_name_nonempty CHECK (btrim(full_name) <> ''),
  business_name text NOT NULL
    CONSTRAINT access_requests_business_name_nonempty CHECK (btrim(business_name) <> ''),
  business_type text NOT NULL
    CONSTRAINT access_requests_business_type_check CHECK (
      business_type IN (
        'tyre_shop',
        'sweet_stall',
        'garment_store',
        'grocery',
        'general'
      )
    ),
  city text NOT NULL
    CONSTRAINT access_requests_city_nonempty CHECK (btrim(city) <> ''),
  email text NOT NULL
    CONSTRAINT access_requests_email_shape CHECK (
      btrim(email) = email
      AND position('@' IN email) > 1
      AND position('.' IN split_part(email, '@', 2)) > 0
    ),
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT access_requests_status_check CHECK (
      status IN ('pending', 'approved', 'dismissed')
    ),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT access_requests_review_state_check CHECK (
    (status = 'pending' AND reviewed_at IS NULL)
    OR
    (status IN ('approved', 'dismissed') AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX idx_access_requests_status_requested
  ON public.access_requests (status, requested_at, id);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY access_requests_insert_own_pending
  ON public.access_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND reviewed_at IS NULL
  );

CREATE POLICY access_requests_select_own
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- This policy exists only so protected-field writes reach the loud trigger.
CREATE POLICY access_requests_update_own_for_loud_guard
  ON public.access_requests
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.prevent_access_request_review_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'access request review is managed by BharatGrowth and cannot be changed by users';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

REVOKE ALL ON FUNCTION public.prevent_access_request_review_mutation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_access_request_review_mutation
  BEFORE UPDATE OF status, reviewed_at ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_access_request_review_mutation();

-- Supabase may carry default table grants. Replace them with the exact
-- request/review contracts rather than relying on RLS as the only lock.
REVOKE ALL PRIVILEGES ON TABLE public.access_requests
  FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT (
  user_id,
  full_name,
  business_name,
  business_type,
  city,
  email
) ON TABLE public.access_requests TO authenticated;

GRANT SELECT (status)
  ON TABLE public.access_requests TO authenticated;

GRANT UPDATE (status, reviewed_at)
  ON TABLE public.access_requests TO authenticated;

GRANT SELECT, UPDATE
  ON TABLE public.access_requests TO service_role;

COMMIT;
