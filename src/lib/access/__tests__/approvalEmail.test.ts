// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAccessApprovalEmail } from '../approvalEmail';

describe('sendAccessApprovalEmail', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'hello@bharatgrowthshop.com');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://bharatgrowthshop.com');
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends the configured approval email with a canonical login URL', async () => {
    await expect(
      sendAccessApprovalEmail({
        email: 'owner@example.test',
        fullName: 'Darshan',
      })
    ).resolves.toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_secret',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: 'BharatGrowth <hello@bharatgrowthshop.com>',
      to: ['owner@example.test'],
      subject: 'Your BharatGrowth shop is ready',
    });
    expect(JSON.parse(String(init.body)).text).toContain(
      'https://bharatgrowthshop.com/login'
    );
  });

  it.each(['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'NEXT_PUBLIC_APP_URL'])(
    'fails closed without %s and does not call Resend',
    async (envName) => {
      vi.stubEnv(envName, '');
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        sendAccessApprovalEmail({
          email: 'owner@example.test',
          fullName: 'Darshan',
        })
      ).resolves.toEqual({
        sent: false,
        failureKind: 'configuration',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('reports provider rejection without logging secrets or recipient details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(
      sendAccessApprovalEmail({
        email: 'owner@example.test',
        fullName: 'Darshan',
      })
    ).resolves.toEqual({ sent: false, failureKind: 'rejected' });

    const logged = consoleError.mock.calls.flat().join(' ');
    expect(logged).toContain('422');
    expect(logged).not.toContain('re_secret');
    expect(logged).not.toContain('owner@example.test');
  });

  it('reports network failure without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      sendAccessApprovalEmail({
        email: 'owner@example.test',
        fullName: 'Darshan',
      })
    ).resolves.toEqual({ sent: false, failureKind: 'network' });
  });
});
