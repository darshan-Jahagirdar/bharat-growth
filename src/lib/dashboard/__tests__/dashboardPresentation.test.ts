import { describe, expect, it } from 'vitest';
import {
  buildDashboardDateRange,
  buildGstExportFilename,
  getDashboardPeriodLabel,
  getTopProductTotal,
} from '../dashboardPresentation';

const NOW = new Date('2026-07-13T06:30:00.000Z');

describe('dashboard presentation transforms', () => {
  it('builds the existing IST preset ranges', () => {
    expect(buildDashboardDateRange('today', '', '', NOW)).toEqual({
      start: '2026-07-13T00:00:00+05:30',
      end: '2026-07-13T23:59:59+05:30',
    });
    expect(buildDashboardDateRange('7d', '', '', NOW)).toEqual({
      start: '2026-07-07T00:00:00+05:30',
      end: '2026-07-13T23:59:59+05:30',
    });
    expect(buildDashboardDateRange('month', '', '', NOW)).toEqual({
      start: '2026-07-01T00:00:00+05:30',
      end: '2026-07-13T23:59:59+05:30',
    });
  });

  it('preserves custom range fallback behavior', () => {
    expect(buildDashboardDateRange('custom', '2026-06-01', '2026-06-30', NOW)).toEqual({
      start: '2026-06-01T00:00:00+05:30',
      end: '2026-06-30T23:59:59+05:30',
    });
    expect(buildDashboardDateRange('custom', '2026-06-01', '', NOW)).toEqual({
      start: '2026-06-01T00:00:00+05:30',
      end: '2026-07-13T23:59:59+05:30',
    });
    expect(buildDashboardDateRange('custom', '', '', NOW)).toBeUndefined();
  });

  it('maps presets to the existing KPI labels', () => {
    expect(getDashboardPeriodLabel('today')).toBe('Today');
    expect(getDashboardPeriodLabel('7d')).toBe('Last 7 Days');
    expect(getDashboardPeriodLabel('month')).toBe('This Month');
    expect(getDashboardPeriodLabel('custom')).toBe('Custom Range');
  });

  it('totals top-product sales without changing units', () => {
    expect(getTopProductTotal([{ sales: 1_000 }, { sales: 500 }])).toBe(1_500);
    expect(getTopProductTotal([])).toBe(0);
  });

  it('builds the existing sanitized current-month GST filename', () => {
    expect(buildGstExportFilename('Ganesh Tyres & Co.', NOW)).toBe(
      'GST_Report_Ganesh_Tyres___Co__Jul2026.csv'
    );
  });
});
