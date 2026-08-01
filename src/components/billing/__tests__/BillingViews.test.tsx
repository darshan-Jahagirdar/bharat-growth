import { createElement, createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types/database';
import { calculateTotals } from '@/lib/billing/calculateTotals';
import type { BillingState, SelectedCustomer } from '@/lib/billing/useBillingStore';
import { BillingFooter } from '../BillingFooter';
import { BillingHeader } from '../BillingHeader';
import { CreateCustomerModal } from '../CreateCustomerModal';
import { CustomerBar } from '../CustomerBar';
import { LineItemsGrid } from '../LineItemsGrid';
import { ProductSearchBar } from '../ProductSearchBar';

afterEach(cleanup);

const PRODUCT: Product = {
  id: 'product-1',
  shop_id: 'shop-1',
  name: 'MRF Test Tyre',
  sku: 'MRF-1',
  hsn_code: '4011',
  gst_rate_percent: 18,
  unit_price_paise: 10_000,
  selling_price_paise: 10_000,
  unit: 'piece',
  category: null,
  tag_id: null,
  is_active: true,
  barcode: '1234567890',
  vertical_attrs: {},
  image_url: null,
  is_stock_tracked: true,
  low_stock_threshold: 5,
  purchase_price_paise: 8_000,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const CUSTOMER: SelectedCustomer = {
  id: 'customer-1',
  phoneNumber: '9876543210',
  name: 'Test Customer',
  loyaltyPoints: 12,
  gstin: null,
  segment: 'regular',
  creditBalancePaise: 5_000,
  photoUrl: null,
};

function billingState(): BillingState {
  const input = {
    productName: PRODUCT.name,
    hsnCode: PRODUCT.hsn_code,
    quantity: 1,
    unitPricePaise: PRODUCT.selling_price_paise,
    gstRatePercent: PRODUCT.gst_rate_percent,
    discountPaise: 0,
    unit: PRODUCT.unit,
  };

  return {
    customer: CUSTOMER,
    lineItems: [{
      id: 'line-1',
      productId: PRODUCT.id,
      ...input,
      barcode: PRODUCT.barcode,
    }],
    activeLineIndex: 0,
    paymentMode: 'credit',
    invoiceLevelDiscountPaise: 0,
    isInterState: false,
    gstType: 'regular',
    shopStateCode: '27',
    totals: calculateTotals([input], 'regular', false),
  };
}

describe('decomposed billing views behavior contract', () => {
  it('keeps the document type, pending-order control, and shortcut legend in the header', () => {
    const onOpenOnlineOrders = vi.fn();
    const onOpenVisit = vi.fn();
    render(createElement(BillingHeader, {
      shopName: 'Test Shop',
      isComposition: false,
      pendingOnlineCount: 2,
      visitDisabled: false,
      onOpenVisit,
      onOpenOnlineOrders,
    }));

    expect(screen.getByText('TAX INVOICE')).toBeInTheDocument();
    expect(screen.getByText('2 Online Orders')).toBeInTheDocument();
    expect(screen.getByText('F5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Visit F6/ }));
    expect(onOpenVisit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('2 Online Orders'));
    expect(onOpenOnlineOrders).toHaveBeenCalledOnce();
  });

  it('disables the header Visit action while billing interaction is locked', () => {
    render(createElement(BillingHeader, {
      shopName: 'Test Shop',
      isComposition: false,
      pendingOnlineCount: 0,
      visitDisabled: true,
      onOpenVisit: vi.fn(),
      onOpenOnlineOrders: vi.fn(),
    }));

    expect(screen.getByRole('button', { name: /Visit F6/ })).toBeDisabled();
  });

  it('records verbal WhatsApp consent by default when creating a customer', () => {
    const onSave = vi.fn();
    render(createElement(CreateCustomerModal, {
      isOpen: true,
      prefillPhone: '9876543210',
      onSave,
      onCancel: vi.fn(),
      isSaving: false,
    }));

    const consentCheckbox = screen.getByLabelText(
      /purchase acknowledgements, loyalty updates, and offers/
    );
    expect(consentCheckbox).toBeChecked();
    expect(
      screen.getByText(
        'Untick if the customer declined. Consent is optional and can be withdrawn at any time.'
      )
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Sharma'), {
      target: { value: 'Test Customer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

    expect(onSave).toHaveBeenCalledWith(
      'Test Customer',
      '+919876543210',
      null,
      true
    );
  });

  it('records a customer decline when the operator unticks consent', () => {
    const onSave = vi.fn();
    render(createElement(CreateCustomerModal, {
      isOpen: true,
      prefillPhone: '9876543210',
      onSave,
      onCancel: vi.fn(),
      isSaving: false,
    }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Sharma'), {
      target: { value: 'Declined Customer' },
    });
    fireEvent.click(
      screen.getByLabelText(
        /purchase acknowledgements, loyalty updates, and offers/
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

    expect(onSave).toHaveBeenCalledWith(
      'Declined Customer',
      '+919876543210',
      null,
      false
    );
  });

  it('adds the first product on Enter and preserves the item count', () => {
    const onAddProduct = vi.fn();
    render(createElement(ProductSearchBar, {
      productSearchRef: createRef<HTMLInputElement>(),
      query: 'MRF',
      showDropdown: true,
      products: [PRODUCT],
      lineItemCount: 1,
      onQueryChange: vi.fn(),
      onShowDropdownChange: vi.fn(),
      onAddProduct,
    }));

    fireEvent.keyDown(screen.getByPlaceholderText(/Search product/), { key: 'Enter' });
    expect(onAddProduct).toHaveBeenCalledWith(PRODUCT);
    expect(screen.getByText('1 item in bill')).toBeInTheDocument();
  });

  it('keeps line quantity and removal controls connected to the active row handlers', () => {
    const onIncrementQuantity = vi.fn();
    const onDecrementQuantity = vi.fn();
    const onRemoveLineItem = vi.fn();
    render(createElement(LineItemsGrid, {
      state: billingState(),
      isComposition: false,
      onSetActiveLine: vi.fn(),
      onUpdateQuantity: vi.fn(),
      onIncrementQuantity,
      onDecrementQuantity,
      onRemoveLineItem,
    }));

    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('-'));
    fireEvent.click(screen.getByText('x'));
    expect(onIncrementQuantity).toHaveBeenCalledWith(0);
    expect(onDecrementQuantity).toHaveBeenCalledWith(0);
    expect(onRemoveLineItem).toHaveBeenCalledWith(0);
    expect(screen.getByText('₹118.00')).toBeInTheDocument();
  });

  it('preserves totals, payment mode, and all footer actions', () => {
    const onCyclePayment = vi.fn();
    const onClearBill = vi.fn();
    const onReserveSalesOrder = vi.fn();
    const onSaveBill = vi.fn();
    render(createElement(BillingFooter, {
      state: billingState(),
      isComposition: false,
      validationErrors: [],
      saveSuccess: false,
      lowStockWarning: false,
      isSaving: false,
      isReserving: false,
      onCyclePayment,
      onClearBill,
      onReserveSalesOrder,
      onSaveBill,
    }));

    expect(screen.getAllByText('₹118.00')).toHaveLength(1);
    fireEvent.click(screen.getByText('Credit'));
    fireEvent.click(screen.getByText('New Bill'));
    fireEvent.click(screen.getByText('Reserve (SO)'));
    fireEvent.click(screen.getByText('Save & Print'));
    expect(onCyclePayment).toHaveBeenCalledOnce();
    expect(onClearBill).toHaveBeenCalledOnce();
    expect(onReserveSalesOrder).toHaveBeenCalledOnce();
    expect(onSaveBill).toHaveBeenCalledOnce();
  });

  it('keeps customer selection, GSTIN, credit repayment, and clear actions connected', () => {
    const onSelectCustomer = vi.fn();
    const onCommitGstin = vi.fn();
    const onOpenRepayment = vi.fn();
    const onClearCustomer = vi.fn();
    render(createElement(CustomerBar, {
      customerSearchRef: createRef<HTMLInputElement>(),
      customerPhotoRef: createRef<HTMLInputElement>(),
      query: '9876',
      showDropdown: true,
      customers: [CUSTOMER],
      selectedCustomer: CUSTOMER,
      showGstinInput: true,
      gstinDraft: '27AAPFU0939F1ZV',
      onQueryChange: vi.fn(),
      onShowDropdownChange: vi.fn(),
      onSelectCustomer,
      onOpenCreateCustomer: vi.fn(),
      onPhotoChange: vi.fn(),
      onShowGstinInput: vi.fn(),
      onGstinDraftChange: vi.fn(),
      onCommitGstin,
      onCancelGstin: vi.fn(),
      onOpenRepayment,
      onClearCustomer,
    }));

    fireEvent.mouseDown(screen.getAllByText('Test Customer')[0]);
    fireEvent.keyDown(screen.getByPlaceholderText('15-digit GSTIN'), { key: 'Enter' });
    fireEvent.click(screen.getByText('Settle Udhaar'));
    fireEvent.click(screen.getByText('Clear'));
    expect(onSelectCustomer).toHaveBeenCalledWith(CUSTOMER);
    expect(onCommitGstin).toHaveBeenCalledOnce();
    expect(onOpenRepayment).toHaveBeenCalledOnce();
    expect(onClearCustomer).toHaveBeenCalledOnce();
  });
});
