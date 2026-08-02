'use client';

import { useState } from 'react';
import type { CreditCustomer } from './dashboardQueries';

export function useKhataReminder() {
  const [target, setTarget] = useState<CreditCustomer | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function sendReminder() {
    if (!target) return;
    setSending(true);

    try {
      const response = await fetch('/api/whatsapp/send-khata-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: target.id,
        }),
      });
      const result = await response.json();
      if (result.sent || result.simulated) {
        setSuccess(`Reminder sent to ${target.name ?? target.phone_number}`);
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch {
      // Silent fail — non-critical
    }

    setSending(false);
    setTarget(null);
  }

  return { sendReminder, sending, setTarget, success, target };
}

export type KhataReminderController = ReturnType<typeof useKhataReminder>;
