'use client';

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types/database';
import {
  getScanFileError,
  getScanMatchMessage,
  mapScannedItemsToRows,
  mergeScannedRows,
  type GridRow,
  type ScannedPurchaseItem,
} from '@/app/dashboard/purchases/new/purchaseBillTransforms';

interface UsePurchaseScannerOptions {
  setRows: Dispatch<SetStateAction<GridRow[]>>;
  setScansRemaining: Dispatch<SetStateAction<number | null>>;
  shopId: string;
}

export function usePurchaseScanner({
  setRows,
  setScansRemaining,
  shopId,
}: UsePurchaseScannerOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanBill = useCallback(async (file: File) => {
    setIsScanning(true);
    setScanError('');

    try {
      const fileError = getScanFileError(file);
      if (fileError) {
        setScanError(fileError);
        setIsScanning(false);
        return;
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const base64 = btoa(binary);

      const response = await fetch('/api/vision/scan-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, image_mime_type: file.type }),
      });

      if (!response.ok) {
        const error = await response.json();
        setScanError(error.error || `Scan failed (${response.status})`);
        setIsScanning(false);
        return;
      }

      const data = await response.json();
      setScansRemaining(data.scans_remaining ?? null);

      const supabase = createClient();
      const { data: allProducts } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true);

      const { rows: newRows, matchedCount } = mapScannedItemsToRows(
        data.items as ScannedPurchaseItem[],
        (allProducts ?? []) as Product[]
      );
      const matchMessage = getScanMatchMessage(matchedCount, newRows.length);
      if (matchMessage) setScanError(matchMessage);
      setRows((previous) => mergeScannedRows(previous, newRows));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scan failed');
    }

    setIsScanning(false);
  }, [setRows, setScansRemaining, shopId]);

  return {
    fileInputRef,
    handleScanBill,
    isScanning,
    scanError,
  };
}

export type PurchaseScannerController = ReturnType<typeof usePurchaseScanner>;
