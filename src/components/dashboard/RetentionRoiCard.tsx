'use client';

// =============================================================================
// BharatGrowth — Retention ROI Card ("Bring-Back")
// The rupee-proof hero card: "BharatGrowth brought back N customers worth ₹X
// this month." Approval-aware states:
//   1. Proof  — conversions exist: show the money
//   2. Armed + approved — campaigns are live, no conversions yet
//   3. Armed + unapproved — configured, but sending is gated
//   4. CTA — no active campaigns: point to /dashboard/campaigns
// =============================================================================

import Link from 'next/link';
import { ArrowRight, Users, Send } from 'lucide-react';
import { formatINR } from '@/lib/types/database';
import type { RetentionStats } from '@/lib/dashboard/dashboardQueries';

function WhatsAppBadge() {
  return (
    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-400" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </div>
  );
}

interface RetentionRoiCardProps {
  campaignsApproved: boolean | null;
  stats: RetentionStats;
}

export function RetentionRoiCard({
  campaignsApproved,
  stats,
}: RetentionRoiCardProps) {
  const hasProof = stats.customersReturned > 0 || stats.revenueAttributedPaise > 0;
  const isArmed = !hasProof && stats.activeRulesCount > 0;

  // ── State 4: no active campaigns — CTA ──
  if (!hasProof && !isArmed) {
    return (
      <div className="bg-slate-900/50 border border-emerald-500/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <WhatsAppBadge />
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-gray-100">
            Bring customers back automatically
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            WhatsApp reminders timed to your products&apos; repurchase cycle — and proof in rupees when they return.
          </div>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500
                     text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
        >
          Set up Bring-Back
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // ── State 3: configured before approval, but not live yet ──
  if (isArmed && campaignsApproved !== true) {
    return (
      <div className="bg-slate-900/50 border border-amber-500/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <WhatsAppBadge />
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-gray-100">
            Bring-Back is configured — campaign approval required
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Your active rules stay configured. WhatsApp reminders start only after
            BharatGrowth approves campaigns for this shop.
          </div>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 flex-shrink-0"
        >
          Review campaign approval <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // ── State 2: approved and armed, waiting for the first conversion ──
  if (isArmed) {
    return (
      <div className="bg-slate-900/50 border border-emerald-500/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <WhatsAppBadge />
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-gray-100">
            Bring-Back is live — {stats.activeRulesCount} campaign
            {stats.activeRulesCount === 1 ? '' : 's'} watching your customers
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {stats.messagesSent > 0
              ? `${stats.messagesSent} message${stats.messagesSent === 1 ? '' : 's'} sent this month — returns show up here.`
              : 'Reminders go out automatically when a customer is due to come back.'}
          </div>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 flex-shrink-0"
        >
          View campaigns <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // ── State 1: proof — show the money ──
  return (
    <div className="bg-slate-900/50 border border-emerald-500/25 rounded-xl p-5 hover:border-emerald-500/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <WhatsAppBadge />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-emerald-500 uppercase tracking-wider font-medium mb-1">
            Bring-Back · this month
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {formatINR(stats.revenueAttributedPaise)}
            <span className="text-sm font-medium text-gray-400 ml-2">brought back</span>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-lg font-bold text-gray-100 leading-none">
                {stats.customersReturned}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
                Returned
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-lg font-bold text-gray-100 leading-none">
                {stats.messagesSent}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
                Sent
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
          >
            View campaigns <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
