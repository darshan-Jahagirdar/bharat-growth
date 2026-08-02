'use client';

import { useState } from 'react';
import { downloadCSV } from '@/lib/utils/csvExport';
import { exportGstReport } from './dashboardQueries';
import { buildGstExportFilename } from './dashboardPresentation';

interface UseGstExportOptions {
  shopId: string;
  shopName: string;
}

export function useGstExport({ shopId, shopName }: UseGstExportOptions) {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportDone(false);

    try {
      const rows = await exportGstReport(shopId);
      if (rows.length === 0) {
        alert('No completed invoices this month to export.');
        setExporting(false);
        return;
      }

      downloadCSV(
        rows as unknown as Record<string, string | number>[],
        buildGstExportFilename(shopName)
      );
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (error) {
      console.error('[GST Export] Error:', error);
      alert('Failed to export GST report. Please try again.');
    }

    setExporting(false);
  }

  return { exportDone, exporting, handleExport };
}

export type GstExportController = ReturnType<typeof useGstExport>;
