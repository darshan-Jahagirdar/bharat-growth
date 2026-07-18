import { describe, expect, it } from 'vitest';
import { normalizeIndianPhoneToE164 } from '../phone';

describe('Indian phone normalization', () => {
  it('converts ten local digits to canonical E.164', () => {
    expect(normalizeIndianPhoneToE164('0000000000')).toBe('+910000000000');
  });

  it('does not duplicate an existing India country code', () => {
    expect(normalizeIndianPhoneToE164('910000000000')).toBe('+910000000000');
    expect(normalizeIndianPhoneToE164('+91 00000 00000')).toBe('+910000000000');
  });
});
