// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendVisitAcknowledgement } from '../service';

const fetchMock = vi.fn();

describe('visit acknowledgement WhatsApp service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it('simulates only when both Meta credentials are absent and redacts variables', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await sendVisitAcknowledgement(
      '9876543210',
      'Sensitive Customer',
      'Sensitive Shop',
      1,
      42
    );

    expect(result).toEqual({ sent: false, simulated: true });
    expect(fetchMock).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('bg_visit_ack_v1');
    expect(output).toContain('****3210');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('Sensitive Customer');
    expect(output).not.toContain('Sensitive Shop');
    expect(output).not.toContain('Vars: [');

    logSpy.mockRestore();
  });

  it.each([
    {
      token: 'meta-token',
      phoneId: undefined,
    },
    {
      token: undefined,
      phoneId: 'phone-id',
    },
  ])('fails closed when Meta configuration is partial', async ({ token, phoneId }) => {
    if (token) process.env.WHATSAPP_ACCESS_TOKEN = token;
    if (phoneId) process.env.WHATSAPP_PHONE_NUMBER_ID = phoneId;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await sendVisitAcknowledgement(
      '9876543210',
      'Customer',
      'Shop',
      1,
      2
    );

    expect(result).toEqual({
      sent: false,
      simulated: false,
      error: 'WhatsApp configuration is incomplete',
      failureKind: 'configuration',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.flat().join('\n')).not.toContain('meta-token');

    errorSpy.mockRestore();
  });

  it('sends the registered template with the documented variable order', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'meta-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'message-id' }] }),
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await sendVisitAcknowledgement(
      '9876543210',
      'Customer',
      'Fixture Shop',
      1,
      12
    );

    expect(result).toEqual({ sent: true, simulated: false });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer meta-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '+919876543210',
          type: 'template',
          template: {
            name: 'bg_visit_ack_v1',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Customer' },
                  { type: 'text', text: 'Fixture Shop' },
                  { type: 'text', text: '1' },
                  { type: 'text', text: '12' },
                ],
              },
            ],
          },
        }),
      })
    );

    logSpy.mockRestore();
  });

  it('distinguishes a definite Meta rejection from network ambiguity', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'meta-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Template rejected' } }),
    });

    await expect(
      sendVisitAcknowledgement('9876543210', 'Customer', 'Shop', 1, 2)
    ).resolves.toEqual({
      sent: false,
      simulated: false,
      error: 'Template rejected',
      failureKind: 'rejected',
    });

    fetchMock.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      sendVisitAcknowledgement('9876543210', 'Customer', 'Shop', 1, 2)
    ).resolves.toEqual({
      sent: false,
      simulated: false,
      error: 'connection lost',
      failureKind: 'network',
    });

    errorSpy.mockRestore();
  });
});
