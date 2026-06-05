// =============================================================================
// BharatGrowth — AI Vision Bill Scanner API (Phase 27)
// POST /api/vision/scan-bill
// Accepts a base64 image, sends to Claude/GPT-4o for structured extraction,
// decrements the shop's monthly_ai_scans quota on success.
// NEVER saves to DB — returns JSON for the frontend Speed Grid to review.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ScannedItem {
  raw_name: string;
  quantity: number;
  price_paise: number;
}

export async function POST(req: NextRequest) {
  // ── 1. Auth check ──
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Get shop context + quota ──
  const { data: user } = await supabase
    .from('users')
    .select('shop_id')
    .eq('id', session.user.id)
    .single();

  if (!user?.shop_id) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: shop } = await admin
    .from('shops')
    .select('monthly_ai_scans')
    .eq('id', user.shop_id)
    .single();

  if (!shop || (shop.monthly_ai_scans ?? 0) <= 0) {
    return NextResponse.json(
      { error: 'Scan quota exceeded. Resets on the 1st of next month.' },
      { status: 403 }
    );
  }

  // ── 3. Parse request body ──
  let imageBase64: string;
  try {
    const body = await req.json();
    imageBase64 = body.image_base64;
    if (!imageBase64) throw new Error('missing');
  } catch {
    return NextResponse.json(
      { error: 'Request must include image_base64 field' },
      { status: 400 }
    );
  }

  // ── 4. Call AI Vision API ──
  const systemPrompt = `You are a bill/invoice OCR assistant for an Indian retail shop.
You will receive an image of a supplier bill, challan, or purchase receipt.
Extract EVERY line item from the bill.

Return STRICT JSON — an array of objects. No markdown, no explanation, no backticks.
Each object: { "raw_name": "product name as printed", "quantity": number, "price_paise": number }
- raw_name: the product name exactly as printed on the bill
- quantity: number of units (default 1 if unclear)
- price_paise: UNIT price in paise (rupees * 100). If the bill shows ₹450, return 45000.
  If only a total is shown, divide by quantity to get unit price.
  If no price visible, return 0.

Return ONLY the JSON array. Example: [{"raw_name":"MRF ZLX 155/80 R13","quantity":4,"price_paise":245000}]`;

  let items: ScannedItem[] = [];

  // Try Anthropic first, fall back to OpenAI
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                  },
                },
                { type: 'text', text: 'Extract all line items from this supplier bill.' },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[VisionScan] Anthropic API error:', res.status, errText);
        return NextResponse.json(
          { error: `AI service error (${res.status})` },
          { status: 502 }
        );
      }

      const result = await res.json();
      const text =
        result.content?.[0]?.type === 'text' ? result.content[0].text : '';
      items = JSON.parse(text.trim());
    } catch (err) {
      console.error('[VisionScan] Anthropic parse error:', err);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 502 }
      );
    }
  } else if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64.startsWith('data:')
                      ? imageBase64
                      : `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: 'Extract all line items from this supplier bill.',
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[VisionScan] OpenAI API error:', res.status, errText);
        return NextResponse.json(
          { error: `AI service error (${res.status})` },
          { status: 502 }
        );
      }

      const result = await res.json();
      const text = result.choices?.[0]?.message?.content ?? '';
      items = JSON.parse(text.trim());
    } catch (err) {
      console.error('[VisionScan] OpenAI parse error:', err);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 502 }
      );
    }
  } else {
    return NextResponse.json(
      { error: 'No AI API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)' },
      { status: 501 }
    );
  }

  // ── 5. Validate + sanitize output ──
  if (!Array.isArray(items)) {
    return NextResponse.json(
      { error: 'AI returned invalid format' },
      { status: 502 }
    );
  }

  const sanitized: ScannedItem[] = items.map((item) => ({
    raw_name: String(item.raw_name ?? '').trim(),
    quantity: Math.max(1, Number(item.quantity) || 1),
    price_paise: Math.max(0, Math.round(Number(item.price_paise) || 0)),
  }));

  // ── 6. Decrement quota ──
  await admin
    .from('shops')
    .update({ monthly_ai_scans: (shop.monthly_ai_scans ?? 1) - 1 })
    .eq('id', user.shop_id);

  console.log(
    `[VisionScan] Success — shop=${user.shop_id}, items=${sanitized.length}, remaining_scans=${(shop.monthly_ai_scans ?? 1) - 1}`
  );

  return NextResponse.json({
    items: sanitized,
    scans_remaining: (shop.monthly_ai_scans ?? 1) - 1,
  });
}
