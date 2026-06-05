import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const checkoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive().max(9999999.999),
});

const checkoutBodySchema = z.object({
  shop_id: z.string().uuid(),
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(10).max(20),
  delivery_address: z.string().trim().max(500).nullable().optional(),
  payment_method: z.enum(['upi', 'khata']),
  data_consent: z.literal(true),
  // Per-attempt key so rapid double-clicks / retries dedupe to one order.
  idempotency_key: z.string().uuid().optional(),
  items: z.array(checkoutItemSchema).min(1).max(100),
});

interface OnlineOrderResult {
  order_id: string;
  invoice_number: string;
  total_paise: number;
  item_count: number;
}

function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    return ip && isIP(ip) ? ip : null;
  }

  const realIp = req.headers.get('x-real-ip')?.trim();
  return realIp && isIP(realIp) ? realIp : null;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = checkoutBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path.includes('data_consent')
      ? 'Explicit data consent is required for checkout'
      : issue?.message ?? 'Invalid checkout payload';

    return errorResponse(message, 400);
  }

  const body = parsed.data;
  const cleanPhone = body.customer_phone.replace(/[^0-9]/g, '');

  if (!/^[0-9]{10,15}$/.test(cleanPhone)) {
    return errorResponse('A valid phone number is required', 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('create_online_order', {
    p_order: {
      shop_id: body.shop_id,
      customer_name: body.customer_name,
      customer_phone: cleanPhone,
      delivery_address: body.delivery_address || null,
      payment_method: body.payment_method,
      data_consent: body.data_consent,
      idempotency_key: body.idempotency_key ?? null,
      items: body.items,
      ip_address: getClientIp(req),
      user_agent: req.headers.get('user-agent'),
    },
  });

  if (error) {
    return errorResponse(error.message || 'Failed to create order', 400);
  }

  if (!data || typeof data !== 'object') {
    return errorResponse('Failed to create order', 500);
  }

  const result = data as OnlineOrderResult;

  return NextResponse.json({
    order_id: result.order_id,
    invoice_number: result.invoice_number,
    total_paise: result.total_paise,
  });
}
