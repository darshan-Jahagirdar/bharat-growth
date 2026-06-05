// =============================================================================
// BharatGrowth — WhatsApp Receipt API Route
// POST /api/whatsapp/send-receipt
// Sends a digital receipt link via WhatsApp (template: bg_receipt_v1)
// Called non-blocking from the billing POS after invoice save
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendReceiptMessage } from '@/lib/whatsapp/service';

interface SendReceiptBody {
  phone_number: string;
  customer_name: string;
  invoice_id: string;
  invoice_total: number; // paise
  shop_name: string;
}

export async function POST(request: NextRequest) {
  let body: SendReceiptBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { phone_number, customer_name, invoice_id, invoice_total, shop_name } = body;

  if (!phone_number || !invoice_id || invoice_total == null) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: phone_number, invoice_id, invoice_total' },
      { status: 400 }
    );
  }

  const result = await sendReceiptMessage(
    phone_number,
    customer_name ?? 'Customer',
    invoice_id,
    invoice_total,
    shop_name ?? 'BharatGrowth Store'
  );

  return NextResponse.json({
    success: true,
    ...result,
  });
}
