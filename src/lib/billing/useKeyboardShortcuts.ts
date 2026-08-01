// =============================================================================
// BharatGrowth — Zero-Mouse Keyboard Shortcut Engine
// =============================================================================
// F2          → Focus customer search (phone number)
// F3          → Focus product search / add item
// F4          → New bill (clear all)
// F5          → Save & print invoice
// F6          → Record a customer visit
// F8          → Toggle payment mode (Cash → UPI → Card)
// Enter       → Add selected product / confirm action
// Escape      → Clear current focus / cancel search
// Delete      → Remove active line item
// ↑ / ↓       → Navigate line items
// + / =       → Increment quantity on active line
// - / _       → Decrement quantity on active line
// =============================================================================
// USB barcode scanners fire rapid keystrokes ending with Enter.
// The hidden barcode input captures these automatically.
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';

export interface KeyboardShortcutRefs {
  customerSearchRef: React.RefObject<HTMLInputElement | null>;
  productSearchRef: React.RefObject<HTMLInputElement | null>;
  barcodeInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface KeyboardShortcutHandlers {
  onSaveBill: () => void;
  onClearBill: () => void;
  onOpenVisit: () => void;
  onCyclePaymentMode: () => void;
  onRemoveActiveLine: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onIncrementQty: () => void;
  onDecrementQty: () => void;
  lineItemCount: number;
}

export function useKeyboardShortcuts(
  refs: KeyboardShortcutRefs,
  handlers: KeyboardShortcutHandlers,
  disabled: boolean = false
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isInInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

      // F-keys work globally (even in inputs)
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          refs.customerSearchRef.current?.focus();
          refs.customerSearchRef.current?.select();
          return;

        case 'F3':
          e.preventDefault();
          refs.productSearchRef.current?.focus();
          refs.productSearchRef.current?.select();
          return;

        case 'F4':
          e.preventDefault();
          handlers.onClearBill();
          return;

        case 'F5':
          e.preventDefault();
          handlers.onSaveBill();
          return;

        case 'F6':
          e.preventDefault();
          handlers.onOpenVisit();
          return;

        case 'F8':
          e.preventDefault();
          handlers.onCyclePaymentMode();
          return;
      }

      // These only fire when NOT in an input field
      if (!isInInput) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur();
            return;

          case 'Delete':
            e.preventDefault();
            handlers.onRemoveActiveLine();
            return;

          case 'ArrowUp':
            e.preventDefault();
            handlers.onNavigateUp();
            return;

          case 'ArrowDown':
            e.preventDefault();
            handlers.onNavigateDown();
            return;

          case '+':
          case '=':
            e.preventDefault();
            handlers.onIncrementQty();
            return;

          case '-':
          case '_':
            e.preventDefault();
            handlers.onDecrementQty();
            return;
        }
      }

      // Escape in inputs → blur the input
      if (isInInput && e.key === 'Escape') {
        e.preventDefault();
        (target as HTMLInputElement).blur();
      }
    },
    [refs, handlers, disabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// ── Barcode Scanner Hook ──
// USB scanners type characters rapidly then press Enter.
// We detect this pattern: if characters arrive within 50ms of each other,
// it's a scanner (not human typing).

export function useBarcodeScanner(
  onBarcodeScanned: (barcode: string) => void
) {
  const bufferRef = useRef('');
  const lastKeystrokeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now();
      const timeDiff = now - lastKeystrokeRef.current;
      lastKeystrokeRef.current = now;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (bufferRef.current.length >= 4) {
          onBarcodeScanned(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      // If too much time passed, reset buffer (human typing)
      if (timeDiff > 100) {
        bufferRef.current = '';
      }

      bufferRef.current += e.key;

      // Auto-clear after 200ms of no input
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, 200);
    },
    [onBarcodeScanned]
  );

  return { handleKeyPress };
}
