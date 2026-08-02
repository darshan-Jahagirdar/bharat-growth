import { getDashboardClient } from './dashboardClient';
import { getMonthStart } from './dashboardDateRanges';
import type { DateRange, RetentionStats } from './dashboardQueryTypes';

const ZERO_RETENTION_STATS: RetentionStats = {
  messagesSent: 0,
  customersReturned: 0,
  revenueAttributedPaise: 0,
  activeRulesCount: 0,
  perRule: [],
};

interface RetentionRuleStatsRow {
  rule_id: string;
  rule_name: string;
  tag_name: string;
  is_active: boolean;
  sent: number;
  returned: number;
  revenue_paise: number;
}

export async function fetchRetentionStats(
  shopId: string,
  dateRange?: DateRange
): Promise<RetentionStats> {
  const client = getDashboardClient();
  const start = dateRange?.start ?? getMonthStart();
  const end = dateRange?.end ?? new Date().toISOString();

  const { data, error } = await client.rpc('get_retention_stats', {
    p_shop_id: shopId,
    p_start: start,
    p_end: end,
  });

  if (error || !data || typeof data !== 'object') {
    if (error) console.warn('[Dashboard] Retention stats failed:', error.message);
    return ZERO_RETENTION_STATS;
  }

  const raw = data as {
    messages_sent?: number;
    customers_returned?: number;
    revenue_attributed_paise?: number;
    active_rules_count?: number;
    per_rule?: RetentionRuleStatsRow[];
  };

  return {
    messagesSent: raw.messages_sent ?? 0,
    customersReturned: raw.customers_returned ?? 0,
    revenueAttributedPaise: raw.revenue_attributed_paise ?? 0,
    activeRulesCount: raw.active_rules_count ?? 0,
    perRule: (raw.per_rule ?? []).map((r) => ({
      ruleId: r.rule_id,
      ruleName: r.rule_name,
      tagName: r.tag_name,
      isActive: r.is_active,
      sent: r.sent ?? 0,
      returned: r.returned ?? 0,
      revenuePaise: r.revenue_paise ?? 0,
    })),
  };
}
