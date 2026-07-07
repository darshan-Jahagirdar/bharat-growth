import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireShopUser } from '@/lib/api/requireShopUser';
import { sendKhataReminder } from '@/lib/whatsapp/service';

const bodySchema = z.object({
  customer_id: z.string().uuid(),
});

interface CustomerRow {
  id: string;
  shop_id: string;
  name: string | null;
  phone_number: string;
  credit_balance_paise: number;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireShopUser();
  if (!auth.ok) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid reminder payload', 400);
  }

  const { data, error } = await auth.supabase
    .from('customers')
    .select('id, shop_id, name, phone_number, credit_balance_paise')
    .eq('id', parsed.data.customer_id)
    .eq('shop_id', auth.shopId)
    .maybeSingle();

  const customer = data as CustomerRow | null;

  if (error || !customer) {
    return errorResponse('Customer not found for this shop', 404);
  }

  if (customer.credit_balance_paise <= 0) {
    return errorResponse('Customer has no outstanding credit', 409);
  }

  const result = await sendKhataReminder(
    customer.phone_number,
    customer.name ?? 'Customer',
    auth.shopName,
    customer.credit_balance_paise,
    auth.upiId
  );

  return NextResponse.json(result);
}
