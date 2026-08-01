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

  it('keeps the invoice campaign characterization isolated and rollback-backed', () => {
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
    expect(sql).toMatch(/v_token\s+text := 'wave-c-char-' \|\| gen_random_uuid\(\)::text/i);
    expect(sql).toMatch(/BEGIN;[\s\S]+ROLLBACK;/i);
    expect(sql).toMatch(/settings->>'fixture' = v_token/i);
    expect(sql).toMatch(/unapproved guard shop returned/i);
    expect(sql).toMatch(/inside_mid/i);
    expect(sql).toMatch(/grace_lower/i);
    expect(sql).toMatch(/grace_upper/i);
    expect(sql).toMatch(/consent_false/i);
    expect(sql).toMatch(/dedupe/i);
    expect(sql).toMatch(/cooldown_active_source/i);
    expect(sql).toMatch(/cooldown_boundary_source/i);
    expect(sql).toMatch(/guard-alt-rule/i);
    expect(sql).toMatch(/one-per-customer newest invoice assertion/i);
    expect(sql).toMatch(/cap shop with one prior send and cap 3/i);
    expect(sql).toMatch(/match\.shop_name = v_token \|\| '-guards'/i);
    expect(sql).toMatch(/match\.customer_name = v_token \|\| '-guard-' \|\| c\.label/i);
    expect(sql).toMatch(/match\.rule_name = v_token \|\| '-guard-rule'/i);
    expect(sql).toMatch(/match\.tag_name = v_token \|\| '-guard-tag'/i);
    expect(sql).toMatch(/match\.template_key = 'PROMO'/i);
    expect(sql).toMatch(/match\.custom_variable = 'Invoice characterization'/i);
    expect(sql).toMatch(/fixture cleanup readback found residual rows/i);
  });

  it('makes visit capture RPC-only, amount-free, and source-exclusive in migration 052', () => {
    const sql = migration('052_customer_visits_and_attribution.sql');
    const visitTableStart = sql.indexOf('CREATE TABLE public.customer_visits');
    const messageLogStart = sql.indexOf('ALTER TABLE public.message_logs');
    const visitTable = sql.slice(visitTableStart, messageLogStart);
    const rpcStart = sql.indexOf('CREATE FUNCTION public.log_customer_visit');
    const statsStart = sql.indexOf(
      'CREATE OR REPLACE FUNCTION public.get_retention_stats'
    );
    const visitRpc = sql.slice(rpcStart, statsStart);

    expect(sql.trimStart()).toMatch(/^--[\s\S]*\bBEGIN;/i);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/i);
    expect(visitTableStart).toBeGreaterThan(-1);
    expect(visitTable).toMatch(/tag_id\s+uuid REFERENCES public\.tags\(id\) ON DELETE SET NULL/i);
    expect(visitTable).toMatch(
      /visit_date\s+date NOT NULL DEFAULT \(now\(\) AT TIME ZONE 'Asia\/Kolkata'\)::date/i
    );
    expect(visitTable).not.toMatch(/\bamount\b|\bprice\b|line_items?|inventory/i);
    expect(visitTable).toMatch(/FOR SELECT TO authenticated/i);
    expect(visitTable).not.toMatch(/FOR (INSERT|UPDATE|DELETE) TO authenticated/i);
    expect(visitTable).toMatch(
      /REVOKE ALL ON TABLE public\.customer_visits FROM PUBLIC, anon, authenticated/i
    );
    expect(visitTable).toMatch(
      /GRANT SELECT ON TABLE public\.customer_visits TO authenticated/i
    );

    expect(sql).toMatch(
      /preflight failed: existing message_logs rows without invoice_id/i
    );
    expect(sql).toMatch(
      /DROP CONSTRAINT message_logs_invoice_id_rule_id_key/i
    );
    expect(sql).toMatch(/DROP INDEX public\.idx_message_logs_invoice_rule/i);
    expect(sql).toMatch(/ALTER COLUMN invoice_id DROP NOT NULL/i);
    expect(sql).toMatch(
      /ADD CONSTRAINT message_logs_one_source CHECK \(\s*\(invoice_id IS NOT NULL AND visit_id IS NULL\)\s*OR \(invoice_id IS NULL AND visit_id IS NOT NULL\)/i
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX message_logs_invoice_rule_unique[\s\S]+WHERE invoice_id IS NOT NULL/i
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX message_logs_visit_rule_unique[\s\S]+WHERE visit_id IS NOT NULL/i
    );
    expect(sql).toMatch(
      /CREATE INDEX idx_message_logs_conversion_visit[\s\S]+WHERE conversion_visit_id IS NOT NULL/i
    );

    expect(sql).toMatch(/DROP FUNCTION public\.find_campaign_matches\(integer\)/i);
    expect(sql).toMatch(/invoice_id\s+uuid,\s*visit_id\s+uuid,/i);
    expect(sql).toMatch(/SELECT \* FROM invoice_candidates\s+UNION ALL\s+SELECT \* FROM visit_candidates/i);
    expect(sql.indexOf('combined_candidates AS')).toBeLessThan(
      sql.indexOf('PARTITION BY cc.shop_id, cc.customer_id')
    );
    expect(sql).toMatch(
      /ORDER BY\s*cc\.event_date DESC,\s*cc\.source_priority,\s*cc\.source_id,\s*cc\.rule_id/i
    );
    expect(sql).toMatch(/cv\.tag_id = cr\.tag_id/i);

    expect(visitRpc).toMatch(
      /v_points_awarded\s+constant integer := 1/i
    );
    expect(visitRpc).not.toMatch(
      /p_(amount|price|points)|inventory|invoice_items/i
    );
    expect(visitRpc.match(/total_spent_paise/gi)).toHaveLength(1);
    expect(visitRpc).toMatch(
      /total_spent_paise,[\s\S]+VALUES \([\s\S]+v_customer_name,\s*'new',\s*0,\s*1,/i
    );
    expect(visitRpc).toMatch(/PERFORM public\.assert_authenticated_shop\(p_shop_id\)/i);
    expect(visitRpc).toMatch(
      /WHERE id = p_tag_id\s+AND shop_id = p_shop_id/i
    );
    expect(visitRpc).toMatch(
      /c\.phone_number NOT LIKE 'ERASED-%'/i
    );
    expect(visitRpc).toMatch(
      /dpdp_marketing_consent\s*=\s*dpdp_marketing_consent OR COALESCE\(p_marketing_consent, false\)/i
    );
    expect(visitRpc).toMatch(
      /IF COALESCE\(p_marketing_consent, false\) THEN\s+INSERT INTO public\.consent_logs/i
    );
    expect(visitRpc).toMatch(/INSERT INTO public\.loyalty_ledger/i);
    expect(visitRpc).toMatch(
      /conversion_visit_id = v_visit_id[\s\S]+interval '14 days'/i
    );
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.save_invoice/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.log_customer_visit\(uuid, text, text, uuid, boolean\)\s+TO authenticated/i
    );

    expect(sql).toMatch(
      /LEFT JOIN public\.invoices inv\s+ON inv\.id = ml\.conversion_invoice_id\s+AND inv\.status = 'completed'/i
    );
    expect(sql).not.toMatch(/AND inv\.id IS NOT NULL/i);
  });

  it('makes visit capture and acknowledgement replay-safe without weakening Wave C boundaries', () => {
    const sql = migration('053_visit_capture_and_acknowledgement_idempotency.sql');
    const visitRpcStart = sql.indexOf(
      'CREATE FUNCTION public.log_customer_visit'
    );
    const visitRpcEnd = sql.indexOf(
      'REVOKE ALL ON FUNCTION public.log_customer_visit',
      visitRpcStart
    );
    const visitRpc = sql.slice(visitRpcStart, visitRpcEnd);
    const replayLookup = visitRpc.indexOf(
      'WHERE cv.shop_id = p_shop_id\n    AND cv.request_id = p_request_id'
    );
    const customerMutation = visitRpc.indexOf(
      'INSERT INTO public.customers'
    );
    const claimRpcStart = sql.indexOf(
      'CREATE FUNCTION public.claim_visit_acknowledgement'
    );
    const claimRpcEnd = sql.indexOf(
      'REVOKE ALL ON FUNCTION public.claim_visit_acknowledgement',
      claimRpcStart
    );
    const claimRpc = sql.slice(claimRpcStart, claimRpcEnd);

    expect(sql.trimStart()).toMatch(/^--[\s\S]*\bBEGIN;/i);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/i);
    expect(sql).toMatch(
      /ALTER TABLE public\.customer_visits\s+ADD COLUMN request_id uuid/i
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX customer_visits_shop_request_uidx\s+ON public\.customer_visits \(shop_id, request_id\)\s+WHERE request_id IS NOT NULL/i
    );
    expect(sql).toMatch(
      /CREATE INDEX idx_customer_visits_shop_created_at\s+ON public\.customer_visits \(shop_id, created_at\)/i
    );
    expect(sql).toMatch(
      /DROP FUNCTION public\.log_customer_visit\(uuid, text, text, uuid, boolean\)/i
    );
    expect(sql).toMatch(
      /CREATE FUNCTION public\.log_customer_visit\(\s*p_shop_id\s+uuid,\s*p_request_id\s+uuid,/i
    );
    expect(visitRpc).toMatch(
      /PERFORM public\.assert_authenticated_shop\(p_shop_id\)/i
    );
    expect(visitRpc).toMatch(/p_request_id IS NULL/i);
    expect(visitRpc).toMatch(/pg_advisory_xact_lock/i);
    expect(replayLookup).toBeGreaterThan(-1);
    expect(customerMutation).toBeGreaterThan(replayLookup);
    expect(visitRpc).toMatch(
      /'idempotent_replay', v_idempotent_replay/i
    );
    expect(visitRpc).toMatch(
      /INSERT INTO public\.customer_visits \(\s*shop_id,\s*customer_id,\s*tag_id,\s*request_id/i
    );
    expect(visitRpc).toMatch(/v_points_awarded\s+constant integer := 1/i);
    expect(visitRpc).not.toMatch(
      /p_(amount|price|points)|invoice_items|inventory_movements/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.log_customer_visit\(\s*uuid,\s*uuid,\s*text,\s*text,\s*uuid,\s*boolean\s*\) TO authenticated/i
    );

    expect(sql).toMatch(
      /CREATE TABLE public\.visit_acknowledgement_claims[\s\S]+visit_id\s+uuid NOT NULL UNIQUE/i
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.visit_acknowledgement_claims ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.visit_acknowledgement_claims FORCE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\.visit_acknowledgement_claims\s+FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\.visit_acknowledgement_claims\s+FROM service_role/i
    );
    expect(sql).toMatch(
      /GRANT SELECT, DELETE ON TABLE public\.visit_acknowledgement_claims\s+TO service_role/i
    );
    expect(sql).not.toMatch(
      /GRANT [^;]*INSERT[^;]*ON TABLE public\.visit_acknowledgement_claims/i
    );
    expect(claimRpc).toMatch(
      /v_campaigns_approved IS DISTINCT FROM true/i
    );
    expect(claimRpc).toMatch(
      /v_marketing_consent IS DISTINCT FROM true/i
    );
    expect(claimRpc).toMatch(
      /ON CONFLICT \(visit_id\) DO NOTHING/i
    );
    expect(claimRpc).not.toMatch(/INSERT INTO public\.message_logs/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_visit_acknowledgement\(uuid, uuid\)\s+FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_visit_acknowledgement\(uuid, uuid\)\s+TO service_role/i
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_visit_acknowledgement\(uuid, uuid\)\s+TO (anon|authenticated)/i
    );
  });

  it('makes visit data consent required, replay-safe, and separately append-logged in migration 054', () => {
    const sql = migration('054_visit_data_consent.sql');
    const visitRpcStart = sql.indexOf(
      'CREATE OR REPLACE FUNCTION public.log_customer_visit'
    );
    const visitRpcEnd = sql.indexOf(
      'REVOKE ALL ON FUNCTION public.log_customer_visit',
      visitRpcStart
    );
    const visitRpc = sql.slice(visitRpcStart, visitRpcEnd);
    const replayLookup = visitRpc.indexOf(
      'WHERE cv.shop_id = p_shop_id\n    AND cv.request_id = p_request_id'
    );
    const customerMutation = visitRpc.indexOf(
      'INSERT INTO public.customers'
    );
    const dataLog = visitRpc.indexOf("'data_collection'");
    const marketingLog = visitRpc.indexOf("'whatsapp_marketing'");

    expect(sql.trimStart()).toMatch(/^--[\s\S]*\bBEGIN;/i);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/i);
    expect(sql).toMatch(
      /WITH corrected_visit_customers AS \(\s*UPDATE public\.customers c[\s\S]+dpdp_data_consent = true/i
    );
    expect(sql).toMatch(
      /c\.phone_number NOT LIKE 'ERASED-%'[\s\S]+FROM public\.customer_visits cv[\s\S]+cv\.shop_id = c\.shop_id[\s\S]+cv\.customer_id = c\.id/i
    );
    expect(sql).toMatch(
      /SELECT cl\.status[\s\S]+cl\.shop_id = c\.shop_id[\s\S]+cl\.customer_id = c\.id[\s\S]+cl\.purpose = 'data_collection'[\s\S]+ORDER BY cl\.created_at DESC, cl\.id DESC[\s\S]+<> 'withdrawn'/i
    );
    expect(sql).toMatch(
      /'data_collection',\s*'granted',\s*'verbal_recorded',\s*NULL,[\s\S]+'source', 'customer_visit_backfill'/i
    );

    expect(replayLookup).toBeGreaterThan(-1);
    expect(customerMutation).toBeGreaterThan(replayLookup);
    expect(visitRpc).toMatch(
      /dpdp_data_consent,\s*dpdp_marketing_consent,\s*consent_collected_at[\s\S]+true,\s*COALESCE\(p_marketing_consent, false\),\s*now\(\)/i
    );
    expect(visitRpc).toMatch(
      /dpdp_data_consent\s*=\s*public\.customers\.dpdp_data_consent\s*OR EXCLUDED\.dpdp_data_consent/i
    );
    expect(visitRpc).toMatch(
      /dpdp_data_consent\s*=\s*dpdp_data_consent OR true/i
    );
    expect(dataLog).toBeGreaterThan(customerMutation);
    expect(marketingLog).toBeGreaterThan(dataLog);
    expect(visitRpc.slice(dataLog - 250, dataLog)).not.toMatch(
      /IF COALESCE\(p_marketing_consent, false\) THEN/i
    );
    expect(visitRpc).toMatch(
      /'data_collection',\s*'granted',\s*'verbal_recorded',\s*auth\.uid\(\),\s*jsonb_build_object\(\s*'source', 'customer_visit',\s*'visit_id', v_visit_id\s*\)/i
    );
    expect(visitRpc).toMatch(
      /IF COALESCE\(p_marketing_consent, false\) THEN\s+INSERT INTO public\.consent_logs[\s\S]+'whatsapp_marketing'/i
    );
    expect(visitRpc).not.toMatch(
      /\bp_(data_consent|amount|price|points|items)\b|invoice_items|inventory|stock/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.log_customer_visit\(\s*uuid,\s*uuid,\s*text,\s*text,\s*uuid,\s*boolean\s*\) FROM PUBLIC, anon, authenticated/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.log_customer_visit\(\s*uuid,\s*uuid,\s*text,\s*text,\s*uuid,\s*boolean\s*\) TO authenticated/i
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.log_customer_visit\([\s\S]+TO (anon|service_role)/i
    );
  });
});
