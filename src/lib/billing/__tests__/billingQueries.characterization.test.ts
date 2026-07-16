import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryBuilder, expectQueryCalls } from '@/test/supabaseQueryMock';
import type { SaveInvoiceParams } from '../billingQueries';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
    auth: { getUser: vi.fn() },
    ...overrides,
  };
}

const invoiceParams: SaveInvoiceParams = {
  invoice: {
    shop_id: 'shop-1',
    invoice_date: '2026-07-15',
    invoice_type: 'b2c',
    document_type: 'invoice',
    customer_id: null,
    customer_name: 'Walk-in',
    customer_phone: null,
    customer_gstin: null,
    billing_state_code: '27',
    is_inter_state: false,
    subtotal_paise: 10000,
    cgst_total_paise: 900,
    sgst_total_paise: 900,
    igst_total_paise: 0,
    discount_paise: 0,
    round_off_paise: 0,
    total_paise: 11800,
    payment_mode: 'cash',
    created_by: 'user-1',
  },
  items: [
    {
      product_id: 'product-1',
      product_name: 'Tyre',
      hsn_code: '4011',
      quantity: 1,
      unit: 'pcs',
      unit_price_paise: 10000,
      discount_paise: 0,
      taxable_amount_paise: 10000,
      gst_rate_percent: 18,
      cgst_paise: 900,
      sgst_paise: 900,
      igst_paise: 0,
      total_paise: 11800,
    },
  ],
};

describe('billingQueries characterization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useRealTimers();
    mocks.createClient.mockReset();
  });

  it('sanitizes customer search, preserves query order, maps fallbacks, and reuses one client', async () => {
    const customerQuery = createQueryBuilder({
      data: [
        {
          id: 'customer-1',
          phone_number: 'customer-phone',
          name: 'Raj Esh',
          gstin: null,
          segment: 'regular',
          total_spent_paise: 123,
          visit_count: 2,
          credit_balance_paise: null,
          photo_url: undefined,
        },
      ],
      error: null,
    });
    const productQuery = createQueryBuilder({
      data: [{ id: 'product-1', name: 'Alpha Tyre' }],
      error: null,
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(customerQuery)
        .mockReturnValueOnce(productQuery),
    });
    mocks.createClient.mockReturnValue(client);

    const { searchCustomers, searchProducts } = await import('../billingQueries');

    await expect(
      searchCustomers('  Raj,(%_\\esh)  ', 'shop-1')
    ).resolves.toEqual([
      {
        id: 'customer-1',
        phoneNumber: 'customer-phone',
        name: 'Raj Esh',
        loyaltyPoints: 0,
        gstin: null,
        segment: 'regular',
        creditBalancePaise: 0,
        photoUrl: null,
      },
    ]);
    await expect(searchCustomers(' %,_(\\) ', 'shop-1')).resolves.toEqual([]);
    await expect(searchProducts('  Alpha_%,()  ', 'shop-1')).resolves.toEqual([
      { id: 'product-1', name: 'Alpha Tyre' },
    ]);

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(2);
    expect(client.from).toHaveBeenNthCalledWith(1, 'customers');
    expect(client.from).toHaveBeenNthCalledWith(2, 'products');
    expect(expectQueryCalls(customerQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, phone_number, name, gstin, segment, total_spent_paise, visit_count, credit_balance_paise, photo_url',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      {
        method: 'or',
        args: ['phone_number.ilike.Raj esh%,name.ilike.Raj esh%'],
      },
      { method: 'limit', args: [5] },
    ]);
    expect(expectQueryCalls(productQuery)).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['is_active', true] },
      {
        method: 'or',
        args: [
          'name.ilike.%Alpha%,sku.ilike.%Alpha%,hsn_code.ilike.%Alpha%,barcode.eq.Alpha',
        ],
      },
      { method: 'order', args: ['name'] },
      { method: 'limit', args: [8] },
    ]);
  });

  it('keeps loyalty and barcode lookups tenant-scoped with exact fallbacks', async () => {
    const loyaltyQuery = createQueryBuilder({
      data: [{ running_balance: 37 }],
      error: null,
    });
    const barcodeQuery = createQueryBuilder({
      data: null,
      error: { message: 'not found' },
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(loyaltyQuery)
        .mockReturnValueOnce(barcodeQuery),
    });
    mocks.createClient.mockReturnValue(client);

    const { fetchCustomerLoyalty, lookupBarcode } = await import(
      '../billingQueries'
    );

    await expect(fetchCustomerLoyalty('customer-1', 'shop-1')).resolves.toBe(37);
    await expect(lookupBarcode('890123', 'shop-1')).resolves.toBeNull();

    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'loyalty_ledger',
      'products',
    ]);
    expect(expectQueryCalls(loyaltyQuery)).toEqual([
      { method: 'select', args: ['running_balance'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['customer_id', 'customer-1'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [1] },
    ]);
    expect(expectQueryCalls(barcodeQuery)).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['barcode', '890123'] },
      { method: 'eq', args: ['is_active', true] },
      { method: 'single', args: [] },
    ]);
  });

  it('preserves invoice and repayment RPC names, payloads, and error returns', async () => {
    const client = mockClient({
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            invoice_id: 'invoice-1',
            invoice_number: 'BG/1',
            invoice_sequence: 1,
            financial_year: '2026-27',
            total_paise: 11800,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'repayment failed' },
        }),
    });
    mocks.createClient.mockReturnValue(client);

    const { processCreditRepayment, saveInvoice } = await import(
      '../billingQueries'
    );

    await expect(saveInvoice(invoiceParams)).resolves.toEqual({
      data: {
        invoice_id: 'invoice-1',
        invoice_number: 'BG/1',
        invoice_sequence: 1,
        financial_year: '2026-27',
        total_paise: 11800,
      },
      error: null,
    });
    await expect(
      processCreditRepayment('shop-1', 'customer-1', 0, null)
    ).resolves.toEqual({
      success: false,
      error: 'Amount must be greater than 0',
    });
    await expect(
      processCreditRepayment('shop-1', 'customer-1', 500, 'cash')
    ).resolves.toEqual({ success: false, error: 'repayment failed' });

    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'save_invoice', {
      p_invoice: invoiceParams.invoice,
      p_items: invoiceParams.items,
      p_loyalty_entry: null,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'record_credit_repayment', {
      p_shop_id: 'shop-1',
      p_customer_id: 'customer-1',
      p_amount_paise: 500,
      p_notes: 'cash',
    });
  });

  it('refreshes the customer before lazily loading loyalty and preserves mapping', async () => {
    const customerQuery = createQueryBuilder({
      data: {
        id: 'customer-1',
        phone_number: 'customer-phone',
        name: null,
        gstin: null,
        segment: 'vip',
        credit_balance_paise: null,
        photo_url: null,
      },
      error: null,
    });
    const loyaltyQuery = createQueryBuilder({
      data: [{ running_balance: 11 }],
      error: null,
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(customerQuery)
        .mockReturnValueOnce(loyaltyQuery),
    });
    mocks.createClient.mockReturnValue(client);

    const { refreshCustomer } = await import('../billingQueries');
    await expect(refreshCustomer('shop-1', 'customer-1')).resolves.toEqual({
      id: 'customer-1',
      phoneNumber: 'customer-phone',
      name: null,
      loyaltyPoints: 11,
      gstin: null,
      segment: 'vip',
      creditBalancePaise: 0,
      photoUrl: null,
    });
    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'customers',
      'loyalty_ledger',
    ]);
    expect(expectQueryCalls(customerQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, phone_number, name, gstin, segment, credit_balance_paise, photo_url',
        ],
      },
      { method: 'eq', args: ['id', 'customer-1'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'single', args: [] },
    ]);
    expect(expectQueryCalls(loyaltyQuery)).toEqual([
      { method: 'select', args: ['running_balance'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['customer_id', 'customer-1'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [1] },
    ]);
  });

  it('validates customer images before client creation and preserves upload/update order', async () => {
    const updateQuery = createQueryBuilder({ data: null, error: null });
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi
        .fn()
        .mockReturnValue({ data: { publicUrl: 'https://images/customer.png' } }),
    };
    const client = mockClient({
      from: vi.fn().mockReturnValue(updateQuery),
      storage: { from: vi.fn().mockReturnValue(bucket) },
    });
    mocks.createClient.mockReturnValue(client);

    const { uploadCustomerImage } = await import('../billingQueries');
    const invalid = { type: 'image/gif', size: 10 } as File;
    const tooLarge = {
      type: 'image/jpeg',
      size: 5 * 1024 * 1024 + 1,
    } as File;
    const valid = { type: 'image/png', size: 2048 } as File;

    await expect(
      uploadCustomerImage(invalid, 'shop-1', 'customer-1')
    ).resolves.toEqual({
      publicUrl: null,
      error: 'Only JPG, PNG, or WebP images allowed.',
    });
    await expect(
      uploadCustomerImage(tooLarge, 'shop-1', 'customer-1')
    ).resolves.toEqual({
      publicUrl: null,
      error: 'Image must be under 5 MB.',
    });
    expect(mocks.createClient).not.toHaveBeenCalled();

    await expect(
      uploadCustomerImage(valid, 'shop-1', 'customer-1')
    ).resolves.toEqual({
      publicUrl: 'https://images/customer.png',
      error: null,
    });
    expect(client.storage.from).toHaveBeenCalledTimes(2);
    expect(client.storage.from).toHaveBeenNthCalledWith(1, 'customer-images');
    expect(client.storage.from).toHaveBeenNthCalledWith(2, 'customer-images');
    expect(bucket.upload).toHaveBeenCalledWith(
      'shop-1/customer-1.png',
      valid,
      {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png',
      }
    );
    expect(bucket.getPublicUrl).toHaveBeenCalledWith(
      'shop-1/customer-1.png'
    );
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('customers');
    expect(expectQueryCalls(updateQuery)).toEqual([
      {
        method: 'update',
        args: [{ photo_url: 'https://images/customer.png' }],
      },
      { method: 'eq', args: ['id', 'customer-1'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
    ]);
  });

  it('continues customer creation after non-fatal photo failure with default consent off', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const customerQuery = createQueryBuilder({
      data: {
        id: uuid,
        phone_number: 'customer-phone',
        name: 'Raj',
        gstin: null,
        segment: 'new',
        credit_balance_paise: 0,
        photo_url: null,
      },
      error: null,
    });
    const bucket = {
      upload: vi
        .fn()
        .mockResolvedValue({ error: { message: 'storage unavailable' } }),
      getPublicUrl: vi.fn(),
    };
    const client = mockClient({
      from: vi.fn().mockReturnValue(customerQuery),
      storage: { from: vi.fn().mockReturnValue(bucket) },
    });
    mocks.createClient.mockReturnValue(client);

    const { createNewCustomer } = await import('../billingQueries');
    const photo = { type: 'image/webp', size: 100 } as File;

    await expect(
      createNewCustomer('shop-1', 'Raj', 'customer-phone', photo)
    ).resolves.toEqual({
      customer: {
        id: uuid,
        phoneNumber: 'customer-phone',
        name: 'Raj',
        loyaltyPoints: 0,
        gstin: null,
        segment: 'new',
        creditBalancePaise: 0,
        photoUrl: null,
      },
      error: null,
    });
    expect(warn).toHaveBeenCalledWith(
      '[Billing] Photo upload failed:',
      'Upload failed: storage unavailable'
    );
    expect(client.storage.from).toHaveBeenCalledTimes(1);
    expect(client.storage.from).toHaveBeenCalledWith('customer-images');
    expect(bucket.upload).toHaveBeenCalledWith(
      `shop-1/${uuid}.webp`,
      photo,
      {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/webp',
      }
    );
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('customers');
    expect(expectQueryCalls(customerQuery)).toEqual([
      {
        method: 'insert',
        args: [
          {
            id: uuid,
            shop_id: 'shop-1',
            name: 'Raj',
            phone_number: 'customer-phone',
            segment: 'new',
            total_spent_paise: 0,
            visit_count: 0,
            credit_balance_paise: 0,
            photo_url: null,
            dpdp_marketing_consent: false,
            consent_collected_at: null,
          },
        ],
      },
      {
        method: 'select',
        args: [
          'id, phone_number, name, gstin, segment, credit_balance_paise, photo_url',
        ],
      },
      { method: 'single', args: [] },
    ]);
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('records consent after customer creation and keeps audit failure non-fatal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'));
    const uuid = '22222222-2222-4222-8222-222222222222';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const customerQuery = createQueryBuilder({
      data: {
        id: uuid,
        phone_number: 'customer-phone',
        name: 'Asha',
        gstin: '27ABCDE1234F1Z5',
        segment: 'new',
        credit_balance_paise: null,
        photo_url: null,
      },
      error: null,
    });
    const consentQuery = createQueryBuilder({
      data: null,
      error: { message: 'audit unavailable' },
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(customerQuery)
        .mockReturnValueOnce(consentQuery),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mocks.createClient.mockReturnValue(client);

    const { createNewCustomer } = await import('../billingQueries');
    const result = await createNewCustomer(
      'shop-1',
      'Asha',
      'customer-phone',
      null,
      true
    );

    expect(result.error).toBeNull();
    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'customers',
      'consent_logs',
    ]);
    expect(expectQueryCalls(customerQuery)).toEqual([
      {
        method: 'insert',
        args: [
          {
            id: uuid,
            shop_id: 'shop-1',
            name: 'Asha',
            phone_number: 'customer-phone',
            segment: 'new',
            total_spent_paise: 0,
            visit_count: 0,
            credit_balance_paise: 0,
            photo_url: null,
            dpdp_marketing_consent: true,
            consent_collected_at: '2026-07-15T10:00:00.000Z',
          },
        ],
      },
      {
        method: 'select',
        args: [
          'id, phone_number, name, gstin, segment, credit_balance_paise, photo_url',
        ],
      },
      { method: 'single', args: [] },
    ]);
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(expectQueryCalls(consentQuery)).toEqual([
      {
        method: 'insert',
        args: [
          {
            shop_id: 'shop-1',
            customer_id: uuid,
            purpose: 'whatsapp_marketing',
            status: 'granted',
            consent_method: 'verbal_recorded',
            collected_by: 'user-1',
            metadata: { source: 'pos_create_customer' },
          },
        ],
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[Billing] Consent log insert failed:',
      'audit unavailable'
    );
  });

  it('fetches the exact shop context projection and returns null on query error', async () => {
    const shopQuery = createQueryBuilder({
      data: null,
      error: { message: 'missing' },
    });
    const client = mockClient({ from: vi.fn().mockReturnValue(shopQuery) });
    mocks.createClient.mockReturnValue(client);

    const { fetchShopContext } = await import('../billingQueries');
    await expect(fetchShopContext('shop-1')).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledWith('shops');
    expect(expectQueryCalls(shopQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, business_name, gst_type, state_code, business_type, gstin, city, upi_id',
        ],
      },
      { method: 'eq', args: ['id', 'shop-1'] },
      { method: 'single', args: [] },
    ]);
  });
});
