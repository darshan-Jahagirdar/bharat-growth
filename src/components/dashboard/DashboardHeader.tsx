import Link from 'next/link';
import { Check, Download, ExternalLink } from 'lucide-react';

interface DashboardHeaderProps {
  exportDone: boolean;
  exporting: boolean;
  onExport: () => void;
  shopId: string;
  shopName: string;
}

export function DashboardHeader({
  exportDone,
  exporting,
  onExport,
  shopId,
  shopName,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold text-gray-200">{shopName}</h1>
        <p className="text-xs text-gray-500">Analytics Command Center</p>
      </div>
      <div className="flex items-center gap-3">
        {shopId && (
          <>
            <button
              onClick={onExport}
              disabled={exporting}
              className={`border transition-colors rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium
                ${exportDone
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                  : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                } disabled:opacity-50`}
            >
              {exporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : exportDone ? (
                <>
                  <Check className="w-4 h-4" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Tax Report
                </>
              )}
            </button>
            <Link
              href={`/store/${shopId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-orange-500/30 text-orange-400 hover:bg-orange-500/10
                         transition-colors rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium"
            >
              View Storefront
              <ExternalLink className="w-4 h-4" />
            </Link>
          </>
        )}
        <div className="text-right">
          <div className="text-xs text-gray-500">Today</div>
          <div className="text-sm font-medium text-gray-300">
            {new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
