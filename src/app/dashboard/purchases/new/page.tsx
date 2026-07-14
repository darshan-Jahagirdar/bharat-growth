'use client';

// =============================================================================
// BharatGrowth — Purchase Bill Entry "Speed Grid" (Phase 27)
// Keyboard-driven tabular entry + optional AI Vision scanner
// =============================================================================

import TopNav from '@/components/layout/TopNav';
import { PurchaseBillFeedback } from '@/components/purchases/PurchaseBillFeedback';
import { PurchaseBillFields } from '@/components/purchases/PurchaseBillFields';
import { PurchaseBillFooter } from '@/components/purchases/PurchaseBillFooter';
import { PurchaseBillHeader } from '@/components/purchases/PurchaseBillHeader';
import { PurchaseKeyboardShortcut } from '@/components/purchases/PurchaseKeyboardShortcut';
import { PurchaseSpeedGrid } from '@/components/purchases/PurchaseSpeedGrid';
import { usePurchaseBillContext } from '@/lib/purchases/usePurchaseBillContext';
import { usePurchaseBillSave } from '@/lib/purchases/usePurchaseBillSave';
import { usePurchaseGrid } from '@/lib/purchases/usePurchaseGrid';
import { usePurchaseScanner } from '@/lib/purchases/usePurchaseScanner';
import { calculateGrandTotal, getSelectedRows } from './purchaseBillTransforms';

export default function NewPurchaseBillPage() {
  const context = usePurchaseBillContext();
  const grid = usePurchaseGrid(context.shopId);
  const scanner = usePurchaseScanner({
    setRows: grid.setRows,
    setScansRemaining: context.setScansRemaining,
    shopId: context.shopId,
  });
  const save = usePurchaseBillSave({
    rows: grid.rows,
    setRows: grid.setRows,
    shopContext: context.shopContext,
    shopId: context.shopId,
  });
  const itemCount = getSelectedRows(grid.rows).length;
  const grandTotal = calculateGrandTotal(grid.rows);

  if (context.authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!context.shopContext) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Please log in to continue.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-6">
        <PurchaseBillHeader
          scanner={scanner}
          scansRemaining={context.scansRemaining}
        />
        <PurchaseBillFeedback
          saveError={save.saveError}
          saveSuccess={save.saveSuccess}
          scanError={scanner.scanError}
        />
        <PurchaseBillFields save={save} />
        <PurchaseSpeedGrid grid={grid} />
        <PurchaseBillFooter
          grandTotal={grandTotal}
          itemCount={itemCount}
          save={save}
        />
        <PurchaseKeyboardShortcut onSave={save.handleSave} />
      </div>
    </div>
  );
}
