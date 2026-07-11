'use client';

// =============================================================================
// BharatGrowth — Bring-Back Campaigns Page
// /dashboard/campaigns
//
// Manage automated WhatsApp repurchase-cycle campaigns:
//   * list rules with per-rule proof (sent / returned / ₹ brought back)
//   * toggle rules on/off (RLS-scoped)
//   * "Enable all" one-click activation for seeded defaults
//   * empty state retrofits defaults via POST /api/campaigns/seed-defaults
//
// Campaigns send Meta-approved templates only — no free-form builder (v1).
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import TopNav from '@/components/layout/TopNav';
import { createClient } from '@/lib/supabase/client';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { formatINR } from '@/lib/types/database';
import { fetchRetentionStats, type RetentionStats } from '@/lib/dashboard/dashboardQueries';
import { TEMPLATE_LABELS, WA_TEMPLATES, type TemplateKey } from '@/lib/whatsapp/templates';
import { Megaphone, Zap, Tag as TagIcon } from 'lucide-react';

interface CampaignRule {
  id: string;
  name: string;
  trigger_days: number;
  template_key: TemplateKey;
  custom_variable: string;
  is_active: boolean;
  tags: { name: string } | { name: string }[] | null;
}

function tagName(rule: CampaignRule): string {
  if (!rule.tags) return '—';
  if (Array.isArray(rule.tags)) return rule.tags[0]?.name ?? '—';
  return rule.tags.name;
}

function humanizeTiming(days: number): string {
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} after purchase`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `~${months} month${months === 1 ? '' : 's'} after purchase`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return `~${years} year${years === 1 ? '' : 's'} after purchase`;
}

function templateLabel(key: TemplateKey): string {
  return TEMPLATE_LABELS[WA_TEMPLATES[key]] ?? key;
}

export default function CampaignsPage() {
  const [shopId, setShopId] = useState<string>('');
  const [rules, setRules] = useState<CampaignRule[]>([]);
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  // ── Resolve shop ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) setShopId(ctx.shopId);
      });
    });
  }, [supabase]);

  // ── Load rules + stats ──
  const loadData = useCallback(async () => {
    if (!shopId) return;
    const [rulesResult, statsResult] = await Promise.all([
      supabase
        .from('campaign_rules')
        .select('id, name, trigger_days, template_key, custom_variable, is_active, tags(name)')
        .eq('shop_id', shopId)
        .order('created_at'),
      fetchRetentionStats(shopId),
    ]);

    if (rulesResult.error) {
      setError(`Failed to load campaigns: ${rulesResult.error.message}`);
    } else {
      setRules((rulesResult.data ?? []) as unknown as CampaignRule[]);
    }
    setStats(statsResult);
    setLoading(false);
  }, [supabase, shopId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Clear flash messages ──
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ── Toggle a rule (optimistic) ──
  async function toggleRule(rule: CampaignRule) {
    const next = !rule.is_active;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)));

    const { error: updateErr } = await supabase
      .from('campaign_rules')
      .update({ is_active: next })
      .eq('id', rule.id)
      .eq('shop_id', shopId);

    if (updateErr) {
      // Roll back optimistic update
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: !next } : r)));
      setError(`Failed to update campaign: ${updateErr.message}`);
    } else {
      setSuccess(next ? `"${rule.name}" is now live.` : `"${rule.name}" paused.`);
    }
  }

  // ── Enable all inactive rules ──
  async function enableAll() {
    if (busy) return;
    setBusy(true);
    const { error: updateErr } = await supabase
      .from('campaign_rules')
      .update({ is_active: true })
      .eq('shop_id', shopId)
      .eq('is_active', false);

    if (updateErr) {
      setError(`Failed to enable campaigns: ${updateErr.message}`);
    } else {
      setSuccess('All campaigns enabled. Reminders go out automatically.');
      await loadData();
    }
    setBusy(false);
  }

  // ── Retrofit: create recommended defaults ──
  async function createDefaults() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/seed-defaults', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to create campaigns');
      } else {
        setSuccess(`Created ${body.rulesCreated} recommended campaign(s). Review and switch them on.`);
        await loadData();
      }
    } catch {
      setError('Network error while creating campaigns');
    } finally {
      setBusy(false);
    }
  }

  const inactiveCount = rules.filter((r) => !r.is_active).length;
  const statsByRule = new Map((stats?.perRule ?? []).map((r) => [r.ruleId, r]));

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-400" />
              Bring-Back Campaigns
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Automatic WhatsApp reminders timed to your products&apos; repurchase cycle.
              Only customers who agreed to WhatsApp offers will be messaged.
            </p>
          </div>
          {inactiveCount > 0 && rules.length > 0 && (
            <button
              onClick={enableAll}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500
                         disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Zap className="w-4 h-4" />
              Enable all campaigns ({inactiveCount})
            </button>
          )}
        </div>

        {/* ── Flash messages ── */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {success}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-500 text-sm mt-3">Loading campaigns...</div>
          </div>
        )}

        {/* ── Empty state (shops onboarded before this feature) ── */}
        {!loading && rules.length === 0 && (
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
            <Megaphone className="w-10 h-10 text-emerald-500/40 mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-200">No campaigns yet</h2>
            <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
              We&apos;ll create recommended Bring-Back campaigns for your business type —
              like a repurchase reminder timed to when customers usually need to buy again.
              They start switched off so you can review them first.
            </p>
            <button
              onClick={createDefaults}
              disabled={busy}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500
                         disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {busy ? 'Creating…' : 'Create recommended campaigns'}
            </button>
          </div>
        )}

        {/* ── Rules table ── */}
        {!loading && rules.length > 0 && (
          <div className="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">Campaign</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Audience</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium hidden lg:table-cell">Timing</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium hidden lg:table-cell">Template</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium text-center">Sent</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium text-center">Returned</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium text-right">₹ Brought Back</th>
                    <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium text-center">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rules.map((rule) => {
                    const ruleStats = statsByRule.get(rule.id);
                    return (
                      <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-200">{rule.name}</div>
                          {rule.custom_variable && (
                            <div className="text-[11px] text-gray-500 truncate max-w-[240px]">
                              &ldquo;…{rule.custom_variable}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
                            <TagIcon className="w-3 h-3" />
                            {tagName(rule)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                          {humanizeTiming(rule.trigger_days)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                          {templateLabel(rule.template_key)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {ruleStats?.sent ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {ruleStats?.returned ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatINR(ruleStats?.revenuePaise ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            role="switch"
                            aria-checked={rule.is_active}
                            onClick={() => toggleRule(rule)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                              ${rule.is_active ? 'bg-emerald-600' : 'bg-gray-700'}`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                                ${rule.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/5 text-[11px] text-gray-600">
              Stats are for this month. Tag products on the{' '}
              <Link href="/dashboard/products" className="text-emerald-500 hover:text-emerald-400">
                Products page
              </Link>{' '}
              so campaigns know who bought what. Messages send only to customers with WhatsApp
              marketing consent, with an opt-out honored automatically.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
