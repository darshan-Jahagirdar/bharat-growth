-- =========================================================================
-- Migration 002: Shops (tenant root) + Users (auth-linked RBAC)
-- =========================================================================

CREATE TABLE shops (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name            text NOT NULL,
  legal_name               text,
  gstin                    varchar(15) CHECK (
                             gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$'
                           ),
  pan                      varchar(10),
  gst_type                 text NOT NULL DEFAULT 'regular' CHECK (
                             gst_type IN ('regular', 'composition')
                           ),
  business_type            text NOT NULL CHECK (
                             business_type IN ('tyre_shop', 'sweet_stall', 'garment_store', 'general')
                           ),
  address_line_1           text,
  address_line_2           text,
  city                     text,
  state_code               varchar(2) NOT NULL,
  pincode                  varchar(6),
  phone                    varchar(15),
  email                    text,
  logo_url                 text,
  subscription_plan        text NOT NULL DEFAULT 'free' CHECK (
                             subscription_plan IN ('free', 'pro', 'enterprise')
                           ),
  subscription_valid_until timestamptz,
  e_invoicing_enabled      boolean NOT NULL DEFAULT false,
  settings                 jsonb NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shops_gstin ON shops (gstin) WHERE gstin IS NOT NULL;
CREATE INDEX idx_shops_business_type ON shops (business_type);
CREATE TRIGGER set_shops_updated_at BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id       uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  phone         varchar(15),
  role          text NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_shop_id ON users (shop_id);
CREATE INDEX idx_users_shop_role ON users (shop_id, role);
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
