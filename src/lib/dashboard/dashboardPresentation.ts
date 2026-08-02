import type { DateRange } from './dashboardQueries';

export type DatePreset = 'today' | '7d' | 'month' | 'custom';

export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
] as const;

export const DONUT_COLORS = [
  '#f97316',
  '#fb923c',
  '#fdba74',
  '#fed7aa',
  '#fff7ed',
];

const GST_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatIstDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function buildDashboardDateRange(
  datePreset: DatePreset,
  customStart: string,
  customEnd: string,
  now = new Date()
): DateRange | undefined {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const todayISO = formatIstDate(istNow);

  switch (datePreset) {
    case 'today':
      return {
        start: `${todayISO}T00:00:00+05:30`,
        end: `${todayISO}T23:59:59+05:30`,
      };
    case '7d': {
      const weekAgo = new Date(istNow.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startISO = formatIstDate(weekAgo);
      return {
        start: `${startISO}T00:00:00+05:30`,
        end: `${todayISO}T23:59:59+05:30`,
      };
    }
    case 'month': {
      const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
      return {
        start: `${istNow.getUTCFullYear()}-${mm}-01T00:00:00+05:30`,
        end: `${todayISO}T23:59:59+05:30`,
      };
    }
    case 'custom':
      if (customStart) {
        return {
          start: `${customStart}T00:00:00+05:30`,
          end: customEnd
            ? `${customEnd}T23:59:59+05:30`
            : `${todayISO}T23:59:59+05:30`,
        };
      }
      return undefined;
  }
}

export function getDashboardPeriodLabel(datePreset: DatePreset): string {
  return datePreset === 'today'
    ? 'Today'
    : datePreset === '7d'
      ? 'Last 7 Days'
      : datePreset === 'month'
        ? 'This Month'
        : 'Custom Range';
}

export function getTopProductTotal(
  topProducts: ReadonlyArray<{ sales: number }>
): number {
  return topProducts.reduce((sum, product) => sum + product.sales, 0);
}

export function buildGstExportFilename(
  shopName: string,
  now = new Date()
): string {
  const safeName = shopName.replace(/[^a-zA-Z0-9]/g, '_');
  return `GST_Report_${safeName}_${GST_MONTH_NAMES[now.getMonth()]}${now.getFullYear()}.csv`;
}
