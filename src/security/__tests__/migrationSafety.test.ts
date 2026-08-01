// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function migration(name: string): string {
  return readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
}

function campaignMatchFunction(sql: string): string {
  const signature = 'CREATE OR REPLACE FUNCTION find_campaign_matches';
  const finalGrant =
    'GRANT EXECUTE ON FUNCTION find_campaign_matches(integer) TO service_role;';
  const start = sql.indexOf(signature);
  const end = sql.indexOf(finalGrant, start);

  if (start === -1 || end === -1) {
    throw new Error('find_campaign_matches definition is incomplete');
  }

  return sql.slice(start, end + finalGrant.length);
}

describe('migration release safety', () => {
  it('keeps migration 011 neutralized for fresh databases', () => {
    const sql = migration('011_dev_auth_user.sql');

    expect(sql).not.toMatch(/devpass123|INSERT\s+INTO\s+auth\.users/i);
  });

  it('creates the shop resolver only after the users table exists', () => {
    const migration001 = migration('001_extensions_and_helpers.sql');
    const migration002 = migration('002_shops_and_users.sql');

    expect(migration001).not.toMatch(/FROM public\.users/i);
    expect(migration002).toMatch(/CREATE TABLE users/i);
    expect(migration002).toMatch(/CREATE OR REPLACE FUNCTION get_current_shop_id/i);
    expect(migration002.indexOf('CREATE TABLE users')).toBeLessThan(
      migration002.indexOf('CREATE OR REPLACE FUNCTION get_current_shop_id')
    );
  });

  it('keeps migration 042 additive until the compatible app is deployed', () => {
    const sql = migration('042_public_rls_hardening.sql');

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION get_public_receipt/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION get_storefront_owner_phone/i);
    expect(sql).not.toMatch(/DROP POLICY|REVOKE SELECT ON TABLE/i);
  });

  it('declares the read-only tenant guard stable and authenticated-only', () => {
    const sql = migration('047_tenant_guard_volatility.sql');

    expect(sql).toMatch(/LANGUAGE plpgsql STABLE SECURITY DEFINER/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION assert_authenticated_shop\(uuid\) FROM PUBLIC/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION assert_authenticated_shop\(uuid\) TO authenticated/i);
  });

  it('keeps shared staging seed data non-destructive and campaigns inactive', () => {
    const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8');

    expect(seed).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b|INSERT\s+INTO\s+auth\./i);
    expect(seed).toMatch(/Campaign rules stay INACTIVE/i);
    expect(seed).not.toMatch(/'Free alignment check[^\n]+true, NULL/i);
    expect(seed).not.toMatch(/'Fresh sweets nudge[^\n]+true, NULL/i);
    expect(seed).not.toMatch(/'New season collection[^\n]+true, NULL/i);
  });

  it('derives loyalty balance from prior points instead of UUID row order', () => {
    const sql = migration('048_loyalty_balance_sum.sql');

    expect(sql).toMatch(/SUM\(ll\.points\)/i);
    expect(sql).not.toMatch(/ORDER BY ll\.created_at DESC, ll\.id DESC/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
  });

  it('adds grocery without changing the existing shop business types', () => {
    const sql = migration('050_add_grocery_business_type.sql');

    expect(sql).toMatch(/DROP CONSTRAINT shops_business_type_check/i);
    expect(sql).toMatch(/ADD CONSTRAINT shops_business_type_check CHECK/i);
    expect(sql).toMatch(
      /business_type IN \('tyre_shop', 'sweet_stall', 'garment_store', 'grocery', 'general'\)/i
    );
    expect(sql).not.toMatch(
      /campaign_rules|message_logs|find_campaign_matches|get_retention_stats/i
    );
  });

  it('defaults campaign sending off and protects the manual approval decision', () => {
    const sql = migration('051_campaign_approval_gate.sql');
    const guardStart = sql.indexOf(
      'CREATE OR REPLACE FUNCTION public.prevent_shop_campaign_approval_mutation()'
    );
    const guardEnd = sql.indexOf('$$ LANGUAGE plpgsql SET search_path = public;', guardStart);
    const guard = sql.slice(guardStart, guardEnd);

    expect(sql).toMatch(
      /ADD COLUMN campaigns_approved boolean NOT NULL DEFAULT false/i
    );
    expect(sql).toMatch(/ADD COLUMN campaigns_approved_at timestamptz/i);
    expect(sql).toMatch(
      /ADD COLUMN campaigns_approval_requested_at timestamptz/i
    );
    expect(sql).toMatch(
      /current_user IN \('anon', 'authenticated'\)/i
    );
    expect(guard).toMatch(
      /NEW\.campaigns_approved IS DISTINCT FROM OLD\.campaigns_approved/i
    );
    expect(guard).toMatch(
      /NEW\.campaigns_approved_at IS DISTINCT FROM OLD\.campaigns_approved_at/i
    );
    expect(guard).not.toMatch(/campaigns_approval_requested_at/i);
    expect(sql).toMatch(
      /BEFORE UPDATE OF campaigns_approved, campaigns_approved_at ON public\.shops/i
    );
    expect(guard).toMatch(/RAISE EXCEPTION USING/i);
    expect(sql).toMatch(/ERRCODE = '42501'/i);
  });

  it('changes only the approved-shop join inside find_campaign_matches', () => {
    const migration037 = campaignMatchFunction(
      migration('037_find_campaign_matches_rpc.sql')
    );
    const migration051 = campaignMatchFunction(
      migration('051_campaign_approval_gate.sql')
    );
    const approvalJoin = '\n     AND s.campaigns_approved = true';

    expect(migration051).toContain(
      'JOIN shops s  ON s.id = cr.shop_id' + approvalJoin
    );
    expect(migration051.replace(approvalJoin, '')).toBe(migration037);
  });

  it('keeps the migration 051 staging fixture isolated and rollback-backed', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/tests/051_campaign_approval_gate.sql'
      ),
      'utf8'
    );

    expect(sql).toMatch(/qokaaggeqahayxsybgds/i);
    expect(sql).toMatch(/supabase db query --linked/i);
    expect(sql).not.toMatch(/\\set|\\if|\\gset|\\quit/i);
    expect(sql).toMatch(/v_token\s+text := 'wave-b-051-' \|\| gen_random_uuid\(\)::text/i);
    expect(sql).toMatch(/BEGIN;[\s\S]+ROLLBACK;/i);
    expect(sql).toMatch(/WHERE id = v_shop_id[\s\S]+settings->>'fixture' = v_token/i);
    expect(sql).toMatch(/v_unapproved_count <> 0/i);
    expect(sql).toMatch(/v_approved_count <> 1/i);
    expect(sql).toMatch(/fixture cleanup readback found residual rows/i);
  });
});
