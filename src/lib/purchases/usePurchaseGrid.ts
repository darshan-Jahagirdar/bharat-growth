'use client';

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Product } from '@/lib/types/database';
import {
  createEmptyRow,
  type GridRow,
} from '@/app/dashboard/purchases/new/purchaseBillTransforms';
import { createClient } from '@/lib/supabase/client';

export function usePurchaseGrid(shopId: string) {
  const [rows, setRows] = useState<GridRow[]>([createEmptyRow()]);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setCellRef = useCallback(
    (rowIndex: number, column: string, element: HTMLInputElement | null) => {
      const key = `${rowIndex}-${column}`;
      if (element) cellRefs.current.set(key, element);
      else cellRefs.current.delete(key);
    },
    []
  );

  const focusCell = useCallback((rowIndex: number, column: string) => {
    const element = cellRefs.current.get(`${rowIndex}-${column}`);
    if (element) {
      element.focus();
      element.select();
    }
  }, []);

  const searchProducts = useCallback(async (query: string, rowIndex: number) => {
    if (!shopId || query.length < 1) {
      setRows((previous) => {
        const next = [...previous];
        next[rowIndex] = {
          ...next[rowIndex],
          suggestions: [],
          showSuggestions: false,
        };
        return next;
      });
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .or(`name.ilike.${query}%,sku.ilike.${query}%,barcode.eq.${query}`)
      .order('name')
      .limit(6);
    setRows((previous) => {
      const next = [...previous];
      next[rowIndex] = {
        ...next[rowIndex],
        suggestions: (data ?? []) as Product[],
        showSuggestions: (data ?? []).length > 0,
      };
      return next;
    });
  }, [shopId]);

  const selectProduct = useCallback((rowIndex: number, product: Product) => {
    setRows((previous) => {
      const next = [...previous];
      next[rowIndex] = {
        ...next[rowIndex],
        product,
        productQuery: product.name,
        costPricePaise: product.purchase_price_paise || product.unit_price_paise,
        matched: true,
        suggestions: [],
        showSuggestions: false,
      };
      return next;
    });
    setTimeout(() => focusCell(rowIndex, 'qty'), 50);
  }, [focusCell]);

  const handleCellKeyDown = useCallback((
    event: KeyboardEvent,
    rowIndex: number,
    column: string
  ) => {
    if (event.key !== 'Enter' && event.key !== 'Tab') return;

    const row = rows[rowIndex];
    if (column === 'product' && row.showSuggestions && row.suggestions.length > 0) {
      event.preventDefault();
      selectProduct(rowIndex, row.suggestions[0]);
      return;
    }

    event.preventDefault();
    if (column === 'product') {
      focusCell(rowIndex, 'qty');
    } else if (column === 'qty') {
      focusCell(rowIndex, 'price');
    } else if (column === 'price') {
      if (rowIndex === rows.length - 1) {
        setRows((previous) => [...previous, createEmptyRow()]);
        setTimeout(() => focusCell(rowIndex + 1, 'product'), 50);
      } else {
        focusCell(rowIndex + 1, 'product');
      }
    }
  }, [focusCell, rows, selectProduct]);

  const updateRow = useCallback((
    rowIndex: number,
    field: keyof GridRow,
    value: string | number | boolean
  ) => {
    setRows((previous) => {
      const next = [...previous];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, []);

  const updateProductQuery = useCallback((rowIndex: number, value: string) => {
    setRows((previous) => {
      const next = [...previous];
      next[rowIndex] = {
        ...next[rowIndex],
        productQuery: value,
        ...(!value ? { product: null, matched: false } : {}),
      };
      return next;
    });
    searchProducts(value, rowIndex);
  }, [searchProducts]);

  const removeRow = useCallback((rowIndex: number) => {
    setRows((previous) => {
      if (previous.length <= 1) return [createEmptyRow()];
      return previous.filter((_, index) => index !== rowIndex);
    });
  }, []);

  const addRow = useCallback(() => {
    setRows((previous) => [...previous, createEmptyRow()]);
    setTimeout(() => focusCell(rows.length, 'product'), 50);
  }, [focusCell, rows.length]);

  return {
    addRow,
    handleCellKeyDown,
    removeRow,
    rows,
    selectProduct,
    setCellRef,
    setRows,
    updateProductQuery,
    updateRow,
  };
}

export type PurchaseGridController = ReturnType<typeof usePurchaseGrid>;
