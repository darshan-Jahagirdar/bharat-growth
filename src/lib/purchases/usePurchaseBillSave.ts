'use client';

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { UserShopContext } from '@/lib/auth/checkUserOnboarded';
import { savePurchaseOrder } from '@/lib/orders/orderQueries';
import { createClient } from '@/lib/supabase/client';
import { formatINR } from '@/lib/types/database';
import { getIndiaDate } from '@/lib/utils/indiaDate';
import {
  buildPurchaseBillRpcArgs,
  buildPurchaseOrderParams,
  countSkippedRows,
  createEmptyRow,
  getSaveableRows,
  type GridRow,
} from '@/app/dashboard/purchases/new/purchaseBillTransforms';

interface UsePurchaseBillSaveOptions {
  rows: GridRow[];
  setRows: Dispatch<SetStateAction<GridRow[]>>;
  shopContext: UserShopContext | null;
  shopId: string;
}

export function usePurchaseBillSave({
  rows,
  setRows,
  shopContext,
  shopId,
}: UsePurchaseBillSaveOptions) {
  const [supplierName, setSupplierName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(getIndiaDate);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleSave = useCallback(async () => {
    const validRows = getSaveableRows(rows);
    if (validRows.length === 0) {
      setSaveError('Add at least one product to save');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    if (!supplierName.trim()) {
      setSaveError('Supplier name is required');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    const supabase = createClient();
    const rpcArgs = buildPurchaseBillRpcArgs({
      shopId,
      supplierName,
      billNumber,
      billDate,
      createdBy: shopContext?.userId || null,
      rows: validRows,
    });
    const totalAmountPaise = rpcArgs.p_bill.total_amount_paise;
    const skippedCount = countSkippedRows(rows, validRows.length);
    const { data: result, error: rpcError } = await supabase.rpc(
      'save_purchase_bill',
      rpcArgs
    );

    setIsSaving(false);
    if (rpcError) {
      console.error('[PurchaseBill] save_purchase_bill FAILED:', rpcError.message);
      setSaveError(`Failed to save bill: ${rpcError.message}`);
      setTimeout(() => setSaveError(''), 8000);
      return;
    }

    const itemsProcessed = (
      result as { bill_id: string; items_processed: number }
    )?.items_processed ?? 0;
    const skippedMessage = skippedCount > 0
      ? ` (${skippedCount} unmatched item${skippedCount > 1 ? 's' : ''} skipped)`
      : '';

    console.log('[PurchaseBill] save_purchase_bill OK:', result);
    setSaveSuccess(
      `Bill saved! ${itemsProcessed} item${itemsProcessed !== 1 ? 's' : ''} stocked in (${formatINR(totalAmountPaise)})${skippedMessage}`
    );
    setSupplierName('');
    setBillNumber('');
    setRows([createEmptyRow()]);
    setTimeout(() => setSaveSuccess(''), 6000);
  }, [billDate, billNumber, rows, setRows, shopContext, shopId, supplierName]);

  const handleSaveDraftPO = useCallback(async () => {
    const validRows = getSaveableRows(rows);
    if (validRows.length === 0) {
      setSaveError('Add at least one product to create a PO');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    if (!supplierName.trim()) {
      setSaveError('Supplier name is required');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }

    setIsCreatingPO(true);
    setSaveError('');
    const result = await savePurchaseOrder(buildPurchaseOrderParams({
      shopId,
      supplierName,
      billDate,
      createdBy: shopContext?.userId,
      rows: validRows,
    }));

    setIsCreatingPO(false);
    if (result.success) {
      const poNumber = (result.data?.po_number as string) ?? '';
      setSaveSuccess(`Purchase Order ${poNumber} created! No stock changes until received.`);
      setSupplierName('');
      setBillNumber('');
      setRows([createEmptyRow()]);
      setTimeout(() => setSaveSuccess(''), 6000);
    } else {
      setSaveError(result.error ?? 'Failed to create purchase order');
      setTimeout(() => setSaveError(''), 8000);
    }
  }, [billDate, rows, setRows, shopContext, shopId, supplierName]);

  const handleClear = useCallback(() => {
    setRows([createEmptyRow()]);
    setSupplierName('');
    setBillNumber('');
    setSaveSuccess('');
    setSaveError('');
  }, [setRows]);

  return {
    billDate,
    billNumber,
    handleClear,
    handleSave,
    handleSaveDraftPO,
    isCreatingPO,
    isSaving,
    saveError,
    saveSuccess,
    setBillDate,
    setBillNumber,
    setSupplierName,
    supplierName,
  };
}

export type PurchaseBillSaveController = ReturnType<typeof usePurchaseBillSave>;
