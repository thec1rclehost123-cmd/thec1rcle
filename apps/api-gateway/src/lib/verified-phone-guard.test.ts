import { describe, expect, it, vi } from 'vitest';
import { createRequireVerifiedPhone } from './verified-phone-guard';

function replyRecorder() {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return reply;
}

describe('requireVerifiedPhone', () => {
  it('rejects unauthenticated requests', async () => {
    const guard = createRequireVerifiedPhone({ getUser: vi.fn() });
    const reply = replyRecorder();
    await guard({ user: null }, reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body.code).toBe('UNAUTHORIZED');
  });

  it('confirms the decoded identity against the current Firebase Admin record', async () => {
    const getUser = vi.fn().mockResolvedValue({ phoneNumber: '+919999999999' });
    const guard = createRequireVerifiedPhone({ getUser });
    const request: any = { user: { uid: 'u1', phone_number: '+919999999999' } };
    const reply = replyRecorder();
    await guard(request, reply);
    expect(reply.statusCode).toBe(200);
    expect(request.verifiedPhone).toBe('+919999999999');
    expect(getUser).toHaveBeenCalledWith('u1');
  });

  it('uses Firebase Admin as a fallback for a newly linked phone', async () => {
    const guard = createRequireVerifiedPhone({
      getUser: vi.fn().mockResolvedValue({ phoneNumber: '+14155552671' }),
    });
    const request: any = { user: { uid: 'u1' } };
    const reply = replyRecorder();
    await guard(request, reply);
    expect(reply.statusCode).toBe(200);
    expect(request.verifiedPhone).toBe('+14155552671');
  });

  it('fails closed when Firebase has no phone or cannot be reached', async () => {
    for (const getUser of [
      vi.fn().mockResolvedValue({ phoneNumber: null }),
      vi.fn().mockRejectedValue(new Error('unavailable')),
    ]) {
      const guard = createRequireVerifiedPhone({ getUser });
      const reply = replyRecorder();
      await guard({ user: { uid: 'u1' }, log: { warn: vi.fn() } }, reply);
      expect(reply.statusCode).toBe(403);
      expect(reply.body.code).toBe('PHONE_VERIFICATION_REQUIRED');
    }
  });

  it('rejects a stale phone_number claim after the phone provider is unlinked', async () => {
    const guard = createRequireVerifiedPhone({
      getUser: vi.fn().mockResolvedValue({ phoneNumber: null }),
    });
    const reply = replyRecorder();
    await guard({ user: { uid: 'u1', phone_number: '+919999999999' } }, reply);
    expect(reply.statusCode).toBe(403);
    expect(reply.body.code).toBe('PHONE_VERIFICATION_REQUIRED');
  });

  it('does not let the internal system identity impersonate a verified consumer', async () => {
    const guard = createRequireVerifiedPhone({
      getUser: vi.fn().mockRejectedValue(new Error('user not found')),
    });
    const reply = replyRecorder();
    await guard(
      { user: { uid: 'system', isSystem: true }, log: { warn: vi.fn() } },
      reply,
    );
    expect(reply.statusCode).toBe(403);
    expect(reply.body.code).toBe('PHONE_VERIFICATION_REQUIRED');
  });

  it('rejects disabled Firebase users even when a phone remains linked', async () => {
    const guard = createRequireVerifiedPhone({
      getUser: vi.fn().mockResolvedValue({
        phoneNumber: '+919999999999',
        disabled: true,
      }),
    });
    const reply = replyRecorder();
    await guard({ user: { uid: 'u1', phone_number: '+919999999999' } }, reply);
    expect(reply.statusCode).toBe(403);
    expect(reply.body.code).toBe('PHONE_VERIFICATION_REQUIRED');
  });
});
