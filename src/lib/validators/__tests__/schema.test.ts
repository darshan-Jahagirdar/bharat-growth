import { describe, expect, it } from 'vitest';
import { gstinSchema, phoneSchema } from '../schema';

describe('Indian identifier validation', () => {
  it('accepts a GSTIN with a valid mod-36 checksum', () => {
    expect(gstinSchema.safeParse('27AAPFU0939F1ZV').success).toBe(true);
  });

  it('rejects a well-shaped GSTIN with the wrong checksum', () => {
    expect(gstinSchema.safeParse('27AAPFU0939F1ZA').success).toBe(false);
  });

  it.each(['9876543210', '+919876543210'])('accepts Indian phone form %s', (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(true);
  });

  it('rejects a number outside Indian mobile prefixes', () => {
    expect(phoneSchema.safeParse('5876543210').success).toBe(false);
  });
});
