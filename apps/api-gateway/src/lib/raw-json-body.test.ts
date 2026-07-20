import { describe, expect, it } from 'vitest';
import { parseRawJsonBody } from './raw-json-body';

describe('parseRawJsonBody', () => {
  it('accepts an empty JSON request body without throwing', () => {
    expect(parseRawJsonBody(Buffer.from(''))).toEqual({
      rawBody: '',
      parsedBody: {},
    });
  });

  it('preserves the exact raw body while parsing valid JSON', () => {
    const rawBody = '{"event":"payment.captured"}\n';
    expect(parseRawJsonBody(Buffer.from(rawBody))).toEqual({
      rawBody,
      parsedBody: { event: 'payment.captured' },
    });
  });

  it('rejects malformed non-empty JSON', () => {
    expect(() => parseRawJsonBody(Buffer.from('{'))).toThrow();
  });
});
