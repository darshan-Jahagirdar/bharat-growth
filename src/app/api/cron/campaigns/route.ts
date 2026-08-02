// =============================================================================
// BharatGrowth — Campaign Cron Engine (Bring-Back)
// GET /api/cron/campaigns
// Auth: Authorization: Bearer <CRON_SECRET>  (Vercel Cron attaches this)
//
// Matching lives in the find_campaign_matches() RPC (migration 052), which
// enforces the DPDP marketing-consent gate, IST date windows, dedupe,
// per-customer cooldown, and the per-shop daily cap.
//
// Send discipline is claim-then-send: the message_logs row is inserted BEFORE
// the WhatsApp call so overlapping cron runs collide on the source-specific
// unique constraint instead of double-sending.
// =============================================================================

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCampaignMessage } from '@/lib/whatsapp/service';
import { CAMPAIGN_DAILY_SEND_CAP } from '@/lib/campaigns/constants';

const campaignMatchSchema = z.object({
  shop_id: z.string().uuid(),
  shop_name: z.string(),
  customer_id: z.string().uuid(),
  customer_name: z.string().nullable(),
  customer_phone: z.string(),
  invoice_id: z.string().uuid().nullable(),
  visit_id: z.string().uuid().nullable(),
  rule_id: z.string().uuid(),
  rule_name: z.string(),
  tag_name: z.string(),
  template_key: z.enum(['PROMO', 'RESTOCK', 'NEW_ARRIVAL']),
  custom_variable: z.string(),
}).refine(
  (match) => (match.invoice_id === null) !== (match.visit_id === null),
  {
    message: 'Exactly one campaign source is required',
    path: ['invoice_id'],
  }
);

type CampaignMatch = z.infer<typeof campaignMatchSchema>;

const PG_UNIQUE_VIOLATION = '23505';

function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;

  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(headerBuf, expectedBuf);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error('[Cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  const { data, error } = await admin.rpc('find_campaign_matches', {
    p_daily_cap: CAMPAIGN_DAILY_SEND_CAP,
  });

  if (error) {
    console.error('[Cron] find_campaign_matches failed:', error.message);
    return NextResponse.json(
      { error: 'Failed to find campaign matches', details: error.message },
      { status: 500 }
    );
  }

  const parsed = z.array(campaignMatchSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error('[Cron] Unexpected match shape:', parsed.error.message);
    return NextResponse.json(
      { error: 'Unexpected match shape from RPC' },
      { status: 500 }
    );
  }

  const matches: CampaignMatch[] = parsed.data;
  results.processed = matches.length;

  for (const match of matches) {
    try {
      // ── 1. Claim: insert the log row BEFORE sending ──
      const { data: claim, error: claimErr } = await admin
        .from('message_logs')
        .insert({
          shop_id: match.shop_id,
          customer_id: match.customer_id,
          invoice_id: match.invoice_id,
          visit_id: match.visit_id,
          rule_id: match.rule_id,
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (claimErr) {
        if (claimErr.code === PG_UNIQUE_VIOLATION) {
          results.skipped++; // another run already claimed this (source, rule)
        } else {
          const source = match.invoice_id
            ? `invoice ${match.invoice_id}`
            : `visit ${match.visit_id}`;
          console.error(
            `[Cron] Claim failed for ${source}:`,
            claimErr.message
          );
          results.errors++;
        }
        continue;
      }

      const releaseClaim = () =>
        admin.from('message_logs').delete().eq('id', claim.id);

      // ── 2. Opt-out race re-check: consent may have been withdrawn
      //       between matching and sending ──
      const { data: customer } = await admin
        .from('customers')
        .select('dpdp_marketing_consent')
        .eq('id', match.customer_id)
        .single();

      if (!customer?.dpdp_marketing_consent) {
        await releaseClaim();
        results.skipped++;
        continue;
      }

      // ── 3. Send via the Meta-approved template ──
      const sendResult = await sendCampaignMessage(
        match.customer_phone,
        match.customer_name ?? 'Customer',
        match.shop_name,
        match.template_key,
        match.custom_variable
      );

      if (sendResult.sent || sendResult.simulated) {
        results.sent++;
      } else {
        if (sendResult.failureKind === 'rejected') {
          // Definite API rejection: no WhatsApp message was accepted, so the
          // grace window may retry after configuration/template fixes.
          await releaseClaim();
        }
        console.warn(
          `[Cron] Send failed for ${maskPhone(match.customer_phone)}:`,
          sendResult.error
        );
        results.errors++;
      }
    } catch (err) {
      console.error('[Cron] Error processing match:', err);
      results.errors++;
    }
  }

  console.log('[Cron] Campaign run complete:', results);
  return NextResponse.json({ ok: true, ...results });
}
