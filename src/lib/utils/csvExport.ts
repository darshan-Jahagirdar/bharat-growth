// =============================================================================
// BharatGrowth — CSV Export Utility (Phase 20)
// Uses PapaParse to generate downloadable CSV files
// =============================================================================

import Papa from 'papaparse';

/**
 * Convert an array of objects to a CSV string and trigger a browser download.
 *
 * @param data - Array of flat objects (each key becomes a column header)
 * @param filename - Download filename (should end in .csv)
 */
export function downloadCSV(
  data: Record<string, string | number>[],
  filename: string
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Use PapaParse to handle proper escaping, quoting, and UTF-8
  const csv = Papa.unparse(data, {
    quotes: true, // Quote all fields for CA-friendliness
  });

  // Add UTF-8 BOM so Excel on Windows opens it correctly with ₹ symbols
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
