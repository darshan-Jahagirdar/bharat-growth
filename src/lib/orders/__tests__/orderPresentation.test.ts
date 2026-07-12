import { describe, expect, it } from 'vitest';
import type { PurchaseOrderRow, SalesOrderRow } from '../orderQueries';
import {
  buildPOWhatsAppUrl,
  buildSOWhatsAppUrl,
  formatOrderDate,
  isActionableOrder,
  normalizePhone,
} from '../orderPresentation';

const SALES_ORDER: SalesOrderRow = {
  id: 'so-1',
  so_number: 'SO/2026-27/00001',
  so_sequence: 1,
  financial_year: '2026-27',
  customer_id: 'customer-1',
  customer_name: 'Rajesh Sharma',
  customer_phone: '98765 43210',
  status: 'reserved',
  valid_until: null,
  total_amount_paise: 448_000,
  notes: null,
  created_at: '2026-07-13T04:30:00.000Z',
  updated_at: '2026-07-13T04:30:00.000Z',
  items: [{
    id: 'so-item-1',
    product_id: 'product-1',
    quantity: 2,
    agreed_price_paise: 224_000,
    product_name: 'CEAT SecuraDrive',
    product_unit: 'piece',
  }],
};

const PURCHASE_ORDER: PurchaseOrderRow = {
  id: 'po-1',
  po_number: 'PO/2026-27/00001',
  po_sequence: 1,
  financial_year: '2026-27',
  supplier_name: 'Mumbai Tyre Supply',
  status: 'sent',
  expected_date: null,
  total_amount_paise: 300_000,
  notes: null,
  created_at: '2026-07-13T04:30:00.000Z',
  updated_at: '2026-07-13T04:30:00.000Z',
  items: [{
    id: 'po-item-1',
    product_id: 'product-2',
    quantity: 3,
    expected_price_paise: 100_000,
    product_name: 'MRF Zapper',
    product_unit: 'piece',
  }],
};

describe('order presentation behavior', () => {
  it('keeps Indian phone normalization and null date formatting', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizePhone('12345')).toBe('12345');
    expect(formatOrderDate(null)).toBe('--');
  });

  it('keeps only fulfilled and cancelled orders non-actionable', () => {
    expect(isActionableOrder('draft')).toBe(true);
    expect(isActionableOrder('reserved')).toBe(true);
    expect(isActionableOrder('sent')).toBe(true);
    expect(isActionableOrder('fulfilled')).toBe(false);
    expect(isActionableOrder('cancelled')).toBe(false);
  });

  it('preserves the sales reservation WhatsApp number, item totals, and storefront link', () => {
    const url = buildSOWhatsAppUrl(SALES_ORDER, 'Ganesh Tyres', 'shop-1');
    const decoded = decodeURIComponent(url);

    expect(decoded).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(decoded).toContain('RESERVATION CONFIRMED - Ganesh Tyres');
    expect(decoded).toContain('CEAT SecuraDrive x 2 = ₹4,480.00');
    expect(decoded).toContain('/store/shop-1');
  });

  it('preserves purchase-order WhatsApp supplier, item, and estimated total text', () => {
    const decoded = decodeURIComponent(
      buildPOWhatsAppUrl(PURCHASE_ORDER, 'Ganesh Tyres')
    );

    expect(decoded).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decoded).toContain('PURCHASE ORDER - Ganesh Tyres');
    expect(decoded).toContain('Supplier: Mumbai Tyre Supply');
    expect(decoded).toContain('MRF Zapper x 3');
    expect(decoded).toContain('Total Estimated: ₹3,000.00');
  });
});
