// =============================================================================
// BharatGrowth — WhatsApp Receipt API Route
// POST /api/whatsapp/send-receipt
// Sends a transactional receipt via Meta WhatsApp Business Cloud API
// Includes DPDP Act opt-out text in every marketing-adjacent message
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

interface SendReceiptBody {
  phone_number: string;
  invoice_number: string;
  invoice_total: number; // paise
  points_earned: number;
  shop_name: string;
}

export async function POST(request: NextRequest) {
  // ── Parse & validate request ──
  let body: SendReceiptBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { phone_number, invoice_number, invoice_total, points_earned, shop_name } = body;

  if (!phone_number || !invoice_number || invoice_total == null) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: phone_number, invoice_number, invoice_total' },
      { status: 400 }
    );
  }

  // ── Format values for WhatsApp message ──
  const totalRupees = (invoice_total / 100).toFixed(2);
  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(invoice_total / 100);

  // Ensure phone is in E.164 format (India: +91)
  const normalizedPhone = phone_number.startsWith('+')
    ? phone_number.replace(/[^0-9+]/g, '')
    : phone_number.startsWith('91')
      ? `+${phone_number.replace(/[^0-9]/g, '')}`
      : `+91${phone_number.replace(/[^0-9]/g, '')}`;

  // ── WhatsApp Business API config ──
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    // WhatsApp not configured — log and return success (non-blocking)
    console.log(
      `[WhatsApp] Not configured. Would send receipt to ${normalizedPhone}: ` +
      `${invoice_number} | ${formattedTotal} | ${points_earned} pts`
    );
    return NextResponse.json({
      success: true,
      sent: false,
      reason: 'whatsapp_not_configured',
      message: `Receipt logged for ${normalizedPhone}`,
    });
  }

  // ── Build WhatsApp template message payload ──
  // Template: "purchase_receipt" (must be pre-approved in Meta Business Manager)
  // Parameters: shop_name, invoice_number, total, points_earned
  const waPayload = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: 'purchase_receipt',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: shop_name },
            { type: 'text', text: invoice_number },
            { type: 'text', text: formattedTotal },
            { type: 'text', text: String(points_earned) },
            // DPDP Act 2026 — opt-out text embedded in template
            { type: 'text', text: 'Reply STOP to unsubscribe' },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(waPayload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp] API error:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message ?? 'WhatsApp API error',
          details: result.error,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      sent: true,
      message_id: result.messages?.[0]?.id ?? null,
    });
  } catch (err) {
    console.error('[WhatsApp] Network error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to reach WhatsApp API' },
      { status: 502 }
    );
  }
}
