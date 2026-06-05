// =============================================================================
// BharatGrowth — Campaign Cron Engine
// GET /api/cron/campaigns?secret=CRON_SECRET
//
// Finds customers who purchased products with a tag N days ago,
// sends a marketing reminder via WhatsApp, and logs to message_logs.
// Designed to be called by Vercel Cron or an external scheduler.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMarketingReminder } from '@/lib/whatsapp/service';

interface CampaignMatch {
  shop_id: string;
  shop_name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  invoice_id: string;
  rule_id: string;
  tag_name: string;
  message_template: string;
}

export async function GET(request: Request) {
  // ── Auth: verify cron secret ──
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    // ══════════════════════════════════════════════════════════════════════
    // Find all campaign matches:
    //   invoices WHERE invoice_date = CURRENT_DATE - rule.trigger_days
    //   joined via invoice_items → products.tag_id → campaign_rules
    //   filtered: customer_id NOT NULL, rule is_active, not already in message_logs
    // ══════════════════════════════════════════════════════════════════════

    const { data: matches, error: queryErr } = await supabase.rpc(
      'find_campaign_matches'
    );

    // If the RPC doesn't exist yet, fall back to a raw query
    // We use a raw SQL approach via the admin client
    let campaignMatches: CampaignMatch[] = [];

    if (queryErr || !matches) {
      // Direct query approach
      const { data, error: rawErr } = await supabase
        .from('campaign_rules')
        .select(`
          id,
          shop_id,
          tag_id,
          trigger_days,
          message_template,
          tags!inner ( name ),
          shops!inner ( business_name )
        `)
        .eq('is_active', true);

      if (rawErr || !data) {
        console.error('[Cron] Failed to fetch campaign rules:', rawErr?.message);
        return NextResponse.json(
          { error: 'Failed to fetch campaign rules', details: rawErr?.message },
          { status: 500 }
        );
      }

      // For each active rule, find matching invoices
      for (const rule of data) {
        const ruleRecord = rule as Record<string, unknown>;
        const tags = ruleRecord.tags as { name: string } | null;
        const shops = ruleRecord.shops as { business_name: string } | null;
        const tagName = tags?.name ?? '';
        const shopName = shops?.business_name ?? '';

        // Find invoices from exactly trigger_days ago that contain
        // products with this tag, and have a known customer
        const { data: invoices, error: invErr } = await supabase
          .from('invoices')
          .select(`
            id,
            customer_id,
            customer_name,
            customer_phone,
            invoice_items!inner (
              product_id,
              products!inner ( tag_id )
            )
          `)
          .eq('shop_id', rule.shop_id)
          .not('customer_id', 'is', null)
          .not('customer_phone', 'is', null)
          .filter(
            'invoice_date',
            'eq',
            `${formatDateMinusDays(rule.trigger_days)}`
          );

        if (invErr || !invoices) {
          console.warn(`[Cron] Invoice query failed for rule ${rule.id}:`, invErr?.message);
          continue;
        }

        // Filter invoices that actually contain products with matching tag_id
        for (const inv of invoices) {
          const invoice = inv as Record<string, unknown>;
          const items = invoice.invoice_items as Array<{
            product_id: string;
            products: { tag_id: string | null };
          }>;

          const hasMatchingTag = items.some(
            (item) => item.products?.tag_id === rule.tag_id
          );

          if (!hasMatchingTag) continue;

          campaignMatches.push({
            shop_id: rule.shop_id,
            shop_name: shopName,
            customer_id: invoice.customer_id as string,
            customer_name: (invoice.customer_name as string) ?? 'Customer',
            customer_phone: invoice.customer_phone as string,
            invoice_id: invoice.id as string,
            rule_id: rule.id,
            tag_name: tagName,
            message_template: rule.message_template,
          });
        }
      }
    } else {
      campaignMatches = matches as CampaignMatch[];
    }

    results.processed = campaignMatches.length;

    // ══════════════════════════════════════════════════════════════════════
    // For each match: check for duplicates, send message, log it
    // ══════════════════════════════════════════════════════════════════════

    for (const match of campaignMatches) {
      // Check if already sent for this invoice + rule combo
      const { data: existing } = await supabase
        .from('message_logs')
        .select('id')
        .eq('invoice_id', match.invoice_id)
        .eq('rule_id', match.rule_id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        results.skipped++;
        continue;
      }

      // ── Send WhatsApp marketing reminder ──
      try {
        const personalizedMessage = match.message_template
          .replace('{{customer_name}}', match.customer_name)
          .replace('{{shop_name}}', match.shop_name)
          .replace('{{tag_name}}', match.tag_name);

        const sendResult = await sendMarketingReminder(
          match.customer_phone,
          match.customer_name,
          match.shop_name,
          personalizedMessage
        );

        if (sendResult.sent || sendResult.simulated) {
          // ── Log the send ──
          const { error: insertErr } = await supabase
            .from('message_logs')
            .insert({
              shop_id: match.shop_id,
              customer_id: match.customer_id,
              invoice_id: match.invoice_id,
              rule_id: match.rule_id,
              sent_at: new Date().toISOString(),
            });

          if (insertErr) {
            console.error(`[Cron] Failed to log message for invoice ${match.invoice_id}:`, insertErr.message);
            results.errors++;
          } else {
            results.sent++;
          }
        } else {
          console.warn(`[Cron] WhatsApp send failed for ${match.customer_phone}:`, sendResult.error);
          results.errors++;
        }
      } catch (err) {
        console.error(`[Cron] Error processing match:`, err);
        results.errors++;
      }
    }
  } catch (err) {
    console.error('[Cron] Campaign engine error:', err);
    return NextResponse.json(
      { error: 'Campaign engine failed', details: String(err) },
      { status: 500 }
    );
  }

  console.log(`[Cron] Campaign run complete:`, results);
  return NextResponse.json({ ok: true, ...results });
}

// ── Helper: get YYYY-MM-DD string for (today - N days) in IST ──
function formatDateMinusDays(days: number): string {
  const now = new Date();
  // Shift to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  ist.setDate(ist.getDate() - days);
  return ist.toISOString().split('T')[0];
}
