import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireShopUser } from '@/lib/api/requireShopUser';
import { sendReceiptMessage } from '@/lib/whatsapp/service';

const bodySchema = z.object({
  invoice_id: z.string().uuid(),
});

interface InvoiceRow {
  id: string;
  shop_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_paise: number;
  status: string;
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
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid receipt payload', 400);
  }

  const { data, error } = await auth.supabase
    .from('invoices')
    .select('id, shop_id, customer_name, customer_phone, total_paise, status')
    .eq('id', parsed.data.invoice_id)
    .eq('shop_id', auth.shopId)
    .maybeSingle();

  const invoice = data as InvoiceRow | null;

  if (error || !invoice) {
    return errorResponse('Invoice not found for this shop', 404);
  }

  if (invoice.status !== 'completed') {
    return errorResponse('Receipt can only be sent for completed invoices', 409);
  }

  if (!invoice.customer_phone) {
    return errorResponse('Invoice has no customer phone number', 400);
  }

  const result = await sendReceiptMessage(
    invoice.customer_phone,
    invoice.customer_name ?? 'Customer',
    invoice.id,
    invoice.total_paise,
    auth.shopName
  );

  return NextResponse.json({
    success: true,
    ...result,
  });
}
