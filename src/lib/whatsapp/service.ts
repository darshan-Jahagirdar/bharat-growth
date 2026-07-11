// =============================================================================
// BharatGrowth — WhatsApp Business Service (Template-Based)
// All messages use Meta-approved template names + ordered variables.
// Falls back to Simulation Mode (console logging) when WHATSAPP_ACCESS_TOKEN
// is not set — zero-config dev experience.
//
// DPDP Act 2026: Every marketing template includes opt-out footer.
// =============================================================================

import {
  WA_TEMPLATES,
  TEMPLATE_LABELS,
  type TemplateName,
  type TemplateKey,
} from './templates';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ─── Shared result type ─────────────────────────────────────────────────────
export interface WhatsAppResult {
  sent: boolean;
  simulated: boolean;
  error?: string;
  failureKind?: 'rejected' | 'network';
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

// ─── Simulation helper ──────────────────────────────────────────────────────

function simulateTemplate(
  templateName: TemplateName,
  variables: string[],
  phone: string
): void {
  const label = TEMPLATE_LABELS[templateName] ?? templateName;
  const varsDisplay = variables.length > 0
    ? variables.map((v, i) => `  {{${i + 1}}} = ${v}`).join('\n')
    : '  (no variables)';

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log(`│  📱 WhatsApp ${label} (SIMULATION MODE)`);
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Template:  ${templateName}`);
  console.log(`│  To:        ${maskPhone(phone)}`);
  console.log(`│  Variables:`);
  console.log(varsDisplay);
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  [SIMULATED] Template: ${templateName} | Vars: [${variables.join(', ')}]`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
}

// ─── Core: send any template via Meta Cloud API ─────────────────────────────

async function sendTemplate(
  phone: string,
  templateName: TemplateName,
  variables: string[]
): Promise<WhatsAppResult> {
  const normalizedPhone = normalizePhone(phone);

  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // ── Simulation Mode ──
  if (!WHATSAPP_TOKEN || WHATSAPP_TOKEN.trim() === '') {
    simulateTemplate(templateName, variables, normalizedPhone);
    return { sent: false, simulated: true };
  }

  // ── Live Mode — Meta WhatsApp Business Cloud API v21.0 ──
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: variables.map((text) => ({ type: 'text', text })),
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
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      const errMsg = result.error?.message ?? 'WhatsApp API error';
      console.error(`[WhatsApp] ${templateName} API error:`, errMsg);
      return { sent: false, simulated: false, error: errMsg, failureKind: 'rejected' };
    }

    console.log(
      `[WhatsApp] ${templateName} sent to ${maskPhone(normalizedPhone)} — msg_id: ${result.messages?.[0]?.id}`
    );
    return { sent: true, simulated: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.error(`[WhatsApp] ${templateName} network error:`, message);
    return { sent: false, simulated: false, error: message, failureKind: 'network' };
  }
}

// =============================================================================
// Public API — domain-specific senders
// =============================================================================

/**
 * Send a digital receipt link after invoice save.
 * Template: bg_receipt_v1
 * Variables: {{1}}=name, {{2}}=shop, {{3}}=amount, {{4}}=receiptUrl
 */
export async function sendReceiptMessage(
  phone: string,
  customerName: string,
  invoiceId: string,
  amountPaise: number,
  shopName: string
): Promise<WhatsAppResult> {
  const receiptUrl = `${APP_URL}/receipt/${invoiceId}`;
  return sendTemplate(phone, WA_TEMPLATES.RECEIPT, [
    customerName || 'Customer',
    shopName,
    formatINR(amountPaise),
    receiptUrl,
  ]);
}

/**
 * Send a khata (credit/udhaar) balance reminder from the dashboard.
 * Template: bg_khata_v1
 * Variables: {{1}}=name, {{2}}=shop, {{3}}=balance, {{4}}=upiLine
 */
export async function sendKhataReminder(
  phone: string,
  customerName: string,
  shopName: string,
  balancePaise: number,
  upiId: string | null
): Promise<WhatsAppResult> {
  const upiLine = upiId
    ? `Please clear your dues using our UPI ID: ${upiId}.`
    : '';
  return sendTemplate(phone, WA_TEMPLATES.KHATA, [
    customerName || 'Customer',
    shopName,
    formatINR(balancePaise),
    upiLine,
  ]);
}

/**
 * Send a campaign message from the automated CRM cron engine.
 * Supports RESTOCK, NEW_ARRIVAL, and PROMO templates.
 * Template: determined by templateKey parameter
 * Variables: {{1}}=name, {{2}}=shop, {{3}}=customVariable
 */
export async function sendCampaignMessage(
  phone: string,
  customerName: string,
  shopName: string,
  templateKey: TemplateKey,
  customVariable: string
): Promise<WhatsAppResult> {
  const templateName = WA_TEMPLATES[templateKey];
  return sendTemplate(phone, templateName, [
    customerName || 'Customer',
    shopName,
    customVariable,
  ]);
}

/**
 * Send a low-stock / reorder alert to the shop owner.
 * Template: bg_reorder_v1
 * Variables: {{1}}=ownerName, {{2}}=shopName, {{3}}=productName
 */
export async function sendLowStockAlert(
  ownerPhone: string,
  ownerName: string,
  shopName: string,
  productName: string
): Promise<WhatsAppResult> {
  return sendTemplate(ownerPhone, WA_TEMPLATES.RESTOCK, [
    ownerName || 'Owner',
    shopName,
    productName,
  ]);
}

/**
 * @deprecated Use sendCampaignMessage() instead.
 * Kept for backward compatibility with existing cron engine.
 * Delegates to PROMO template.
 */
export async function sendMarketingReminder(
  phone: string,
  customerName: string,
  shopName: string,
  message: string
): Promise<WhatsAppResult> {
  return sendCampaignMessage(phone, customerName, shopName, 'PROMO', message);
}
