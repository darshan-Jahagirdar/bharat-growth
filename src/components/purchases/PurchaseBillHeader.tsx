import type { PurchaseScannerController } from '@/lib/purchases/usePurchaseScanner';

interface PurchaseBillHeaderProps {
  scansRemaining: number | null;
  scanner: PurchaseScannerController;
}

export function PurchaseBillHeader({
  scansRemaining,
  scanner,
}: PurchaseBillHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">New Purchase Bill</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Log supplier bills to update inventory &amp; cost prices
        </p>
      </div>

      <div className="flex items-center gap-3">
        {scansRemaining !== null && (
          <span className="text-xs text-gray-500">
            {scansRemaining} AI scans left
          </span>
        )}
        <button
          onClick={() => scanner.fileInputRef.current?.click()}
          disabled={scanner.isScanning || (scansRemaining !== null && scansRemaining <= 0)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
                     bg-purple-600/20 text-purple-300 border border-purple-500/30
                     hover:bg-purple-600/30 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scanner.isScanning ? (
            <>
              <div className="w-4 h-4 border-2 border-purple-300/40 border-t-purple-300 rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scan Bill (AI)
            </>
          )}
        </button>
        <input
          ref={scanner.fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) scanner.handleScanBill(file);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
