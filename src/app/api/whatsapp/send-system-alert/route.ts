// =============================================================================
// BharatGrowth — WhatsApp System Alert API Route (Phase 26)
// POST /api/whatsapp/send-system-alert
// Sends low-stock / reorder alert to the shop owner using bg_reorder_v1 template
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendLowStockAlert } from '@/lib/whatsapp/service';

interface SystemAlertBody {
  owner_phone: string;
  owner_name: string;
  shop_name: string;
  product_name: string;
}

export async function POST(request: NextRequest) {
  let body: SystemAlertBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { owner_phone, owner_name, shop_name, product_name } = body;

  if (!owner_phone || !product_name) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: owner_phone, product_name' },
      { status: 400 }
    );
  }

  const result = await sendLowStockAlert(
    owner_phone,
    owner_name ?? 'Owner',
    shop_name ?? 'BharatGrowth Store',
    product_name
  );

  return NextResponse.json({
    success: true,
    ...result,
  });
}
