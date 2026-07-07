import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireShopUser } from '@/lib/api/requireShopUser';
import { sendLowStockAlert } from '@/lib/whatsapp/service';

const bodySchema = z.object({
  product_id: z.string().uuid(),
});

interface ProductRow {
  id: string;
  shop_id: string;
  name: string;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
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
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid alert payload', 400);
  }

  const { data, error } = await auth.supabase
    .from('products')
    .select('id, shop_id, name')
    .eq('id', parsed.data.product_id)
    .eq('shop_id', auth.shopId)
    .maybeSingle();

  const product = data as ProductRow | null;

  if (error || !product) {
    return errorResponse('Product not found for this shop', 404);
  }

  const ownerPhone = auth.shopPhone ?? auth.userPhone;
  if (!ownerPhone) {
    return errorResponse('Shop owner phone number is missing', 400);
  }

  const result = await sendLowStockAlert(
    ownerPhone,
    auth.fullName || 'Owner',
    auth.shopName,
    product.name
  );

  return NextResponse.json({
    success: true,
    ...result,
  });
}
