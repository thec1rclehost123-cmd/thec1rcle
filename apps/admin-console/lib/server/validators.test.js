import { describe, expect, it } from 'vitest';

import { createOrderSchema, joinWaitlistSchema, validateBody } from './validators.js';

describe('validators', () => {
  describe('schema defaults and validation', () => {
    it('applies the default payment method for order creation', () => {
      const parsed = createOrderSchema.parse({
        eventId: 'event_123',
        tickets: [{ ticketId: 'ticket_1', quantity: 2 }],
        userEmail: 'guest@example.com',
        userName: 'Guest User',
      });

      expect(parsed.paymentMethod).toBe('card');
    });

    it('rejects invalid waitlist phone numbers', () => {
      const result = joinWaitlistSchema.safeParse({
        eventId: 'event_123',
        email: 'guest@example.com',
        phone: 'abc',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateBody', () => {
    it('returns parsed data when the request body matches the schema', async () => {
      const request = {
        json: async () => ({
          eventId: 'event_123',
          tickets: [{ ticketId: 'ticket_1', quantity: 1 }],
          userEmail: 'guest@example.com',
        }),
      };

      await expect(validateBody(request, createOrderSchema)).resolves.toEqual({
        data: {
          eventId: 'event_123',
          tickets: [{ ticketId: 'ticket_1', quantity: 1 }],
          userEmail: 'guest@example.com',
          paymentMethod: 'card',
        },
        error: null,
      });
    });

    it('surfaces the first zod validation error', async () => {
      const request = {
        json: async () => ({
          eventId: '',
          tickets: [],
          userEmail: 'not-an-email',
        }),
      };

      await expect(validateBody(request, createOrderSchema)).resolves.toEqual({
        data: null,
        error: 'Event ID is required',
      });
    });

    it('returns a generic error when the request body cannot be read', async () => {
      const request = {
        json: async () => {
          throw new Error('bad json');
        },
      };

      await expect(validateBody(request, createOrderSchema)).resolves.toEqual({
        data: null,
        error: 'Invalid request body',
      });
    });
  });
});
