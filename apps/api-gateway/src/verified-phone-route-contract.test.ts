import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function routeSource(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function expectVerifiedPhoneGuard(source: string, route: string) {
  const index = source.indexOf(`'${route}'`);
  expect(index, `${route} must exist`).toBeGreaterThan(-1);
  const registrationWindow = source.slice(index, index + 650);
  expect(registrationWindow, `${route} must enforce verified Firebase phone`).toContain(
    'requireVerifiedPhone',
  );
}

describe('verified-phone route boundary', () => {
  it('protects checkout and payment mutations without gating public quote/config endpoints', () => {
    const checkout = routeSource('./routes/v1/checkout.ts');
    const payments = routeSource('./routes/v1/payments.ts');

    for (const route of [
      '/checkout/reserve',
      '/checkout/intent',
      '/checkout/verify',
      '/checkout/initiate',
    ]) {
      expectVerifiedPhoneGuard(checkout, route);
    }
    for (const route of ['/payments/order', '/payments/verify']) {
      expectVerifiedPhoneGuard(payments, route);
    }

    const calculateWindow = checkout.slice(
      checkout.indexOf("'/checkout/calculate'"),
      checkout.indexOf("'/checkout/validate'"),
    );
    expect(calculateWindow).not.toContain('requireVerifiedPhone');
    const configWindow = payments.slice(
      payments.indexOf("'/payments/config'"),
      payments.indexOf("'/payments/order'"),
    );
    expect(configWindow).not.toContain('requireVerifiedPhone');
  });

  it('protects ticket transfer, claim, share, pairing, wallet delivery, chat, and matching', () => {
    const tickets = routeSource('./routes/v1/tickets.ts');
    const social = routeSource('./routes/v1/social.ts');
    const matching = routeSource('./routes/v1/matching.ts');

    for (const route of [
      '/tickets/transfer',
      '/tickets/share',
      '/tickets/share/revoke',
      '/tickets/claim/share',
      '/tickets/pair/link',
      '/tickets/pair/assign',
      '/tickets/pair/transfer',
      '/tickets/cover-wallet',
      '/tickets/download',
    ]) {
      expectVerifiedPhoneGuard(tickets, route);
    }
    for (const route of [
      '/social/chat',
      '/social/chat/:eventId',
      '/social/dm/request',
      '/social/dm/:id/accept',
      '/social/dm/:id/send',
      '/social/discover',
      '/social/swipe',
      '/social/matches',
    ]) {
      expectVerifiedPhoneGuard(social, route);
    }
    expect(social).toContain('sendChatMessage(fastify.db, userId, eventId');
    expect(social).toContain('getChatMessages(fastify.db, userId, eventId');
    expect(social).not.toContain("collection('eventGroupMessages').add(message)");
    for (const route of ['/feed', '/swipe']) {
      expectVerifiedPhoneGuard(matching, route);
    }
  });
});
