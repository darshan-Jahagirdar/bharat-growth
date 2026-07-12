import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBarcodeScanner, useKeyboardShortcuts } from '../useKeyboardShortcuts';

function setupKeyboard(disabled = false) {
  const customerInput = document.createElement('input');
  const productInput = document.createElement('input');
  const barcodeInput = document.createElement('input');
  document.body.append(customerInput, productInput, barcodeInput);

  const handlers = {
    onSaveBill: vi.fn(),
    onClearBill: vi.fn(),
    onCyclePaymentMode: vi.fn(),
    onRemoveActiveLine: vi.fn(),
    onNavigateUp: vi.fn(),
    onNavigateDown: vi.fn(),
    onIncrementQty: vi.fn(),
    onDecrementQty: vi.fn(),
    lineItemCount: 1,
  };
  const refs = {
    customerSearchRef: { current: customerInput },
    productSearchRef: { current: productInput },
    barcodeInputRef: { current: barcodeInput },
  };

  const hook = renderHook(
    ({ isDisabled }) => useKeyboardShortcuts(refs, handlers, isDisabled),
    { initialProps: { isDisabled: disabled } }
  );

  return { ...hook, customerInput, productInput, handlers };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('billing keyboard behavior contract', () => {
  it('keeps F2, F3, F4, F5, and F8 available globally, including inside inputs', () => {
    const { customerInput, productInput, handlers } = setupKeyboard();
    productInput.focus();

    fireEvent.keyDown(productInput, { key: 'F2' });
    expect(document.activeElement).toBe(customerInput);

    fireEvent.keyDown(customerInput, { key: 'F3' });
    expect(document.activeElement).toBe(productInput);

    fireEvent.keyDown(productInput, { key: 'F4' });
    fireEvent.keyDown(productInput, { key: 'F5' });
    fireEvent.keyDown(productInput, { key: 'F8' });
    expect(handlers.onClearBill).toHaveBeenCalledOnce();
    expect(handlers.onSaveBill).toHaveBeenCalledOnce();
    expect(handlers.onCyclePaymentMode).toHaveBeenCalledOnce();
  });

  it('blocks every shortcut while billing interaction is locked', () => {
    const { handlers } = setupKeyboard(true);

    fireEvent.keyDown(document.body, { key: 'F5' });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: '+' });

    expect(handlers.onSaveBill).not.toHaveBeenCalled();
    expect(handlers.onRemoveActiveLine).not.toHaveBeenCalled();
    expect(handlers.onIncrementQty).not.toHaveBeenCalled();
  });

  it('keeps row navigation and quantity keys out of text inputs', () => {
    const { customerInput, handlers } = setupKeyboard();
    customerInput.focus();

    fireEvent.keyDown(customerInput, { key: 'ArrowDown' });
    fireEvent.keyDown(customerInput, { key: '+' });
    expect(handlers.onNavigateDown).not.toHaveBeenCalled();
    expect(handlers.onIncrementQty).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: '+' });
    expect(handlers.onNavigateDown).toHaveBeenCalledOnce();
    expect(handlers.onIncrementQty).toHaveBeenCalledOnce();
  });

  it('blurs an input on Escape without invoking a billing action', () => {
    const { customerInput, handlers } = setupKeyboard();
    customerInput.focus();

    fireEvent.keyDown(customerInput, { key: 'Escape' });

    expect(document.activeElement).not.toBe(customerInput);
    expect(handlers.onClearBill).not.toHaveBeenCalled();
  });
});

describe('barcode scanner behavior contract', () => {
  it('emits a rapid barcode of at least four characters when Enter arrives', () => {
    const onBarcodeScanned = vi.fn();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(1_000);
    now.mockReturnValueOnce(1_020);
    now.mockReturnValueOnce(1_040);
    now.mockReturnValueOnce(1_060);
    now.mockReturnValueOnce(1_080);

    const { result } = renderHook(() => useBarcodeScanner(onBarcodeScanned));
    const event = (key: string) => ({ key, preventDefault: vi.fn() });

    act(() => {
      result.current.handleKeyPress(event('1') as never);
      result.current.handleKeyPress(event('2') as never);
      result.current.handleKeyPress(event('3') as never);
      result.current.handleKeyPress(event('4') as never);
      result.current.handleKeyPress(event('Enter') as never);
    });

    expect(onBarcodeScanned).toHaveBeenCalledWith('1234');
  });

  it('does not emit a short scanner buffer', () => {
    const onBarcodeScanned = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { result } = renderHook(() => useBarcodeScanner(onBarcodeScanned));

    act(() => {
      result.current.handleKeyPress({ key: '1', preventDefault: vi.fn() } as never);
      result.current.handleKeyPress({ key: '2', preventDefault: vi.fn() } as never);
      result.current.handleKeyPress({ key: 'Enter', preventDefault: vi.fn() } as never);
    });

    expect(onBarcodeScanned).not.toHaveBeenCalled();
  });
});
