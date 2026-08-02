// =============================================================================
// BharatGrowth — Inbound WhatsApp Webhook (Meta Cloud API)
// GET  /api/whatsapp/webhook — Meta subscription verification handshake
// POST /api/whatsapp/webhook — inbound messages + delivery status callbacks
//
// Purpose: DPDP / Meta-policy opt-out. A customer replying STOP (or a Hindi
// equivalent) has marketing consent revoked across ALL shops, because the
// platform sends from a single WhatsApp number.
//
// Meta requirements honored here:
//   * GET must echo hub.challenge as plain text when the verify token matches
//   * POST payloads are HMAC-signed (X-Hub-Signature-256) with the app secret
//   * After signature verification, always return 200 — Meta disables
//     endpoints that keep failing
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalized (lowercased, space-collapsed) opt-out keywords — English + Hindi.
const OPT_OUT_KEYWORDS = new Set([
  'stop',
  'unsubscribe',
  'opt out',
  'optout',
  'band',
  'band karo',
  'band kar do',
  'message band karo',
  'बंद',
  'बंद करो',
  'बंद कर दो',
]);

// Lenient schema: Meta payload shapes vary — never reject on structure.
const webhookPayloadSchema = z
  .object({
    entry: z
      .array(
        z
          .object({
            changes: z
              .array(
                z
                  .object({
                    value: z
                      .object({
                        messages: z
                          .array(
                            z
                              .object({
                                from: z.string().optional(),
                                type: z.string().optional(),
                                text: z
                                  .object({ body: z.string().optional() })
                                  .passthrough()
                                  .optional(),
                              })
                              .passthrough()
                          )
                          .optional(),
                        statuses: z.array(z.unknown()).optional(),
                      })
                      .passthrough()
                      .optional(),
                  })
                  .passthrough()
              )
              .optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

function normalizeText(body: string): string {
  return body.trim().toLowerCase().replace(/\s+/g, ' ');
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret || appSecret.trim() === '') {
    // Dev escape hatch: keeps curl-testability in simulation mode.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Webhook] WHATSAPP_APP_SECRET not set — skipping signature verification (dev only)'
      );
      return true;
    }
    return false;
  }

  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const received = signatureHeader.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(received, 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}

// ── GET: Meta subscription verification ──
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ── POST: inbound messages + status callbacks ──
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // From here on, always return 200 — Meta disables failing webhooks.
  let payload: z.infer<typeof webhookPayloadSchema>;
  try {
    payload = webhookPayloadSchema.parse(JSON.parse(rawBody));
  } catch {
    console.warn('[Webhook] Unparseable payload — acknowledged and ignored');
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  let optOuts = 0;
  let statusCallbacks = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      statusCallbacks += value.statuses?.length ?? 0;

      for (const message of value.messages ?? []) {
        if (message.type !== 'text' || !message.from || !message.text?.body) {
          continue;
        }

        const normalized = normalizeText(message.text.body);
        if (!OPT_OUT_KEYWORDS.has(normalized)) continue;

        const { data: revoked, error } = await admin.rpc(
          'revoke_marketing_consent_by_phone',
          { p_phone: message.from, p_keyword: normalized }
        );

        if (error) {
          console.error('[Webhook] Consent revocation failed:', error.message);
        } else {
          optOuts++;
          console.log(
            `[Webhook] Opt-out from ${maskPhone(message.from)}: revoked marketing consent on ${revoked} customer record(s)`
          );
        }
      }
    }
  }

  if (statusCallbacks > 0) {
    console.log(`[Webhook] Received ${statusCallbacks} status callback(s)`);
  }

  return NextResponse.json({ ok: true, opt_outs: optOuts });
}
