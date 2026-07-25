import { createHmac, timingSafeEqual } from 'node:crypto';

function getAttributionSecret() {
  const secret =
    process.env.PROMOTER_ATTRIBUTION_SECRET ||
    (process.env.NODE_ENV === 'test' ? 'c1rcle-promoter-attribution-test-secret-only' : null);
  if (!secret || secret.length < 32) {
    const error = new Error('Promoter attribution signing is not configured');
    error.code = 'PROMOTER_ATTRIBUTION_NOT_CONFIGURED';
    throw error;
  }
  return secret;
}

function canonicalTierCommissions(value) {
  if (!value || typeof value !== 'object') return null;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tierId, terms]) => [
        tierId,
        {
          rate: Number(terms?.rate || 0),
          type: String(terms?.type || 'percentage'),
        },
      ]),
  );
}

export function buildPromoterAttributionPayload(input) {
  return JSON.stringify({
    assignmentId: String(input.assignmentId || ''),
    assignmentVersion: Number(input.assignmentVersion || 0),
    termsVersion: Number(input.termsVersion || 0),
    promoterId: String(input.promoterId || ''),
    eventId: String(input.eventId || ''),
    commissionRate: Number(input.commissionRate || 0),
    commissionType: String(input.commissionType || ''),
    ticketTierIds: [...(input.ticketTierIds || [])].map(String).sort(),
    tierCommissions: canonicalTierCommissions(input.tierCommissions),
  });
}

export function signPromoterAttribution(input) {
  return createHmac('sha256', getAttributionSecret())
    .update(buildPromoterAttributionPayload(input))
    .digest('hex');
}

export function verifyPromoterAttribution(input, signature) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signPromoterAttribution(input), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
