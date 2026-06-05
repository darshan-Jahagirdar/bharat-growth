// =============================================================================
// BharatGrowth — WhatsApp Khata Reminder API Route
// POST /api/whatsapp/send-khata-reminder
// Sends a credit balance reminder to a customer via WhatsApp
// =============================================================================

import { NextResponse } from 'next/server';
import { sendKhataReminder } from '@/lib/whatsapp/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      phone_number,
      customer_name,
      shop_name,
      balance_paise,
      upi_id,
    } = body as {
      phone_number: string;
      customer_name: string;
      shop_name: string;
      balance_paise: number;
      upi_id: string | null;
    };

    if (!phone_number || !customer_name || !shop_name || !balance_paise) {
      return NextResponse.json(
        { error: 'Missing required fields: phone_number, customer_name, shop_name, balance_paise' },
        { status: 400 }
      );
    }

    const result = await sendKhataReminder(
      phone_number,
      customer_name,
      shop_name,
      balance_paise,
      upi_id ?? null
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API] send-khata-reminder error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
