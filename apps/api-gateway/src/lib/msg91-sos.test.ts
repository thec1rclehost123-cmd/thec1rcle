import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendSosViaMsg91 } from './msg91-sos';

describe('MSG91 SOS delivery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_SOS_TEMPLATE_ID;
  });

  it('fails closed when the provider is not configured', async () => {
    await expect(
      sendSosViaMsg91({
        sosId: 'sos-1',
        userName: 'A User',
        recipients: [{ contactId: 'contact-1', name: 'Mom', phone: '+919999999999' }],
      }),
    ).rejects.toMatchObject({ code: 'SOS_PROVIDER_UNAVAILABLE' });
  });

  it('returns a sanitized durable-acceptance receipt', async () => {
    process.env.MSG91_AUTH_KEY = 'test-auth-key';
    process.env.MSG91_SOS_TEMPLATE_ID = 'test-template';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'success', request_id: 'provider-request-1' }),
      }),
    );

    await expect(
      sendSosViaMsg91({
        sosId: 'sos-1',
        userName: 'A User',
        recipients: [{ contactId: 'contact-1', name: 'Mom', phone: '+919999999999' }],
        latitude: 19.076,
        longitude: 72.8777,
      }),
    ).resolves.toEqual([
      {
        contactId: 'contact-1',
        phoneLast4: '9999',
        provider: 'msg91',
        providerMessageId: 'provider-request-1',
        status: 'accepted',
      },
    ]);
  });

  it('does not convert provider rejection into SOS success', async () => {
    process.env.MSG91_AUTH_KEY = 'test-auth-key';
    process.env.MSG91_SOS_TEMPLATE_ID = 'test-template';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ type: 'error', message: 'rejected' }),
      }),
    );

    await expect(
      sendSosViaMsg91({
        sosId: 'sos-1',
        userName: 'A User',
        recipients: [{ contactId: 'contact-1', name: 'Mom', phone: '+919999999999' }],
      }),
    ).rejects.toMatchObject({ code: 'SOS_PROVIDER_REJECTED' });
  });
});
