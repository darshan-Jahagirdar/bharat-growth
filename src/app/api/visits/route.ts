import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireShopUser } from '@/lib/api/requireShopUser';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendVisitAcknowledgement } from '@/lib/whatsapp/service';

const bodySchema = z.object({
  request_id: z.string().uuid(),
  phone_number: z.string().trim().min(1),
  customer_name: z.string().trim().max(200).nullable().optional(),
  tag_id: z.string().uuid().nullable().optional(),
  marketing_consent: z.boolean().default(false),
});

const visitResultSchema = z.object({
  request_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  visit_id: z.string().uuid(),
  points_awarded: z.number().int(),
  loyalty_balance: z.number().int(),
  idempotent_replay: z.boolean(),
});

const claimedAcknowledgementSchema = z.object({
  claimed: z.literal(true),
  claim_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  customer_name: z.string().nullable(),
  customer_phone: z.string(),
  shop_name: z.string(),
  points_awarded: z.number().int(),
  loyalty_balance: z.number().int(),
});

const skippedAcknowledgementSchema = z.object({
  claimed: z.literal(false),
  reason: z.enum([
    'already_claimed',
    'campaign_approval_required',
    'whatsapp_consent_required',
  ]),
  claim_id: z.string().uuid().optional(),
});

const acknowledgementClaimSchema = z.discriminatedUnion('claimed', [
  claimedAcknowledgementSchema,
  skippedAcknowledgementSchema,
]);

type AcknowledgementStatus =
  | 'sent'
  | 'simulated'
  | 'approval_required'
  | 'consent_required'
  | 'already_processed'
  | 'failed';

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

  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return errorResponse(
      parsedBody.error.issues[0]?.message ?? 'Invalid visit payload',
      400
    );
  }

  const { data: rawVisit, error: visitError } = await auth.supabase.rpc(
    'log_customer_visit',
    {
      p_shop_id: auth.shopId,
      p_request_id: parsedBody.data.request_id,
      p_phone_number: parsedBody.data.phone_number,
      p_customer_name: parsedBody.data.customer_name ?? null,
      p_tag_id: parsedBody.data.tag_id ?? null,
      p_marketing_consent: parsedBody.data.marketing_consent,
    }
  );

  if (visitError) {
    console.error('[Visits] log_customer_visit failed:', visitError.message);
    return errorResponse('Could not record visit', 400);
  }

  const visitResult = visitResultSchema.safeParse(rawVisit);
  if (!visitResult.success) {
    console.error('[Visits] Unexpected log_customer_visit response shape');
    return errorResponse('Visit response was invalid', 500);
  }

  const admin = createAdminClient();
  const { data: rawClaim, error: claimError } = await admin.rpc(
    'claim_visit_acknowledgement',
    {
      p_shop_id: auth.shopId,
      p_visit_id: visitResult.data.visit_id,
    }
  );

  let acknowledgement: AcknowledgementStatus = 'failed';

  if (claimError) {
    console.error('[Visits] Acknowledgement claim failed:', claimError.message);
  } else {
    const claimResult = acknowledgementClaimSchema.safeParse(rawClaim);

    if (!claimResult.success) {
      console.error('[Visits] Unexpected acknowledgement claim response shape');
    } else if (!claimResult.data.claimed) {
      if (claimResult.data.reason === 'campaign_approval_required') {
        acknowledgement = 'approval_required';
      } else if (claimResult.data.reason === 'whatsapp_consent_required') {
        acknowledgement = 'consent_required';
      } else {
        acknowledgement = 'already_processed';
      }
    } else {
      const claim = claimResult.data;

      const releaseClaim = async () => {
        const { error } = await admin
          .from('visit_acknowledgement_claims')
          .delete()
          .eq('id', claim.claim_id)
          .eq('shop_id', auth.shopId)
          .eq('visit_id', visitResult.data.visit_id);

        if (error) {
          console.error('[Visits] Failed to release acknowledgement claim');
        }
      };

      // Approval and consent are independent send gates. Re-read both after
      // the claim so a withdrawal/revocation racing the RPC fails closed.
      const [shopGate, customerGate] = await Promise.all([
        admin
          .from('shops')
          .select('campaigns_approved')
          .eq('id', auth.shopId)
          .maybeSingle(),
        admin
          .from('customers')
          .select('dpdp_marketing_consent')
          .eq('id', claim.customer_id)
          .eq('shop_id', auth.shopId)
          .maybeSingle(),
      ]);

      if (shopGate.error || customerGate.error) {
        await releaseClaim();
        console.error('[Visits] Could not re-check acknowledgement send gates');
      } else if (shopGate.data?.campaigns_approved !== true) {
        await releaseClaim();
        acknowledgement = 'approval_required';
      } else if (customerGate.data?.dpdp_marketing_consent !== true) {
        await releaseClaim();
        acknowledgement = 'consent_required';
      } else {
        const sendResult = await sendVisitAcknowledgement(
          claim.customer_phone,
          claim.customer_name ?? 'Customer',
          claim.shop_name,
          claim.points_awarded,
          claim.loyalty_balance
        );

        if (sendResult.sent) {
          acknowledgement = 'sent';
        } else if (sendResult.simulated) {
          acknowledgement = 'simulated';
        } else {
          // A definite configuration/API rejection means Meta did not accept
          // a message, so a replay may safely claim again. Network ambiguity
          // keeps the durable claim to prevent duplicate paid sends.
          if (
            sendResult.failureKind === 'configuration'
            || sendResult.failureKind === 'rejected'
          ) {
            await releaseClaim();
          }
          console.error('[Visits] Acknowledgement send did not complete');
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    visit_id: visitResult.data.visit_id,
    points_awarded: visitResult.data.points_awarded,
    loyalty_balance: visitResult.data.loyalty_balance,
    idempotent_replay: visitResult.data.idempotent_replay,
    acknowledgement,
  });
}
