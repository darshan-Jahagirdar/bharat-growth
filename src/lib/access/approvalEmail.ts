interface ApprovalEmailRecipient {
  email: string;
  fullName: string;
}

export type ApprovalEmailResult =
  | { sent: true }
  | {
      sent: false;
      failureKind: 'configuration' | 'rejected' | 'network';
    };

export async function sendAccessApprovalEmail({
  email,
  fullName,
}: ApprovalEmailRecipient): Promise<ApprovalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!apiKey || !fromEmail || !appUrl) {
    console.error('[Access approval email] Required email configuration is missing');
    return { sent: false, failureKind: 'configuration' };
  }

  let loginUrl: string;
  try {
    loginUrl = new URL('/login', appUrl).toString();
  } catch {
    console.error('[Access approval email] NEXT_PUBLIC_APP_URL is invalid');
    return { sent: false, failureKind: 'configuration' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `BharatGrowth <${fromEmail}>`,
        to: [email],
        subject: 'Your BharatGrowth shop is ready',
        text: [
          `Hi ${fullName},`,
          '',
          'Your early-access request has been approved. You can now sign in and set up your BharatGrowth shop.',
          '',
          loginUrl,
          '',
          '— BharatGrowth',
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      console.error(
        `[Access approval email] Resend rejected the request with status ${response.status}`
      );
      return { sent: false, failureKind: 'rejected' };
    }

    return { sent: true };
  } catch {
    console.error('[Access approval email] Resend request failed');
    return { sent: false, failureKind: 'network' };
  }
}
