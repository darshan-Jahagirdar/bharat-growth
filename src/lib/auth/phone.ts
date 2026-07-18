export function normalizeIndianPhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }

  return `+91${digits}`;
}
