// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function migration(name: string): string {
  return readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
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
});
