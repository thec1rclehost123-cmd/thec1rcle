import { describe, it, expect } from 'vitest';
import SM from './order-state-machine.js';

describe('Order State Machine', () => {
  describe('getNextStatus', () => {
    it('should transition from draft to reserved on RESERVE', () => {
      expect(SM.getNextStatus('draft', 'RESERVE')).toBe('reserved');
    });

    it('should return null for invalid transitions', () => {
      expect(SM.getNextStatus('confirmed', 'RESERVE')).toBeNull();
    });

    it('should handle terminal states', () => {
      expect(SM.getNextStatus('cancelled', 'ANY_EVENT')).toBeNull();
    });
  });

  describe('transition', () => {
    const mockOrder = {
      id: 'ord-123',
      status: 'draft',
      totalAmount: 1000,
      statusHistory: [],
    };
    const mockActor = { uid: 'u1', role: 'user', name: 'John' };

    it('should update status and record history', () => {
      const result = SM.transition(mockOrder, 'RESERVE', mockActor);
      expect(result.status).toBe('reserved');
      expect(result.statusHistory).toHaveLength(1);
      expect(result.statusHistory[0].from).toBe('draft');
      expect(result.statusHistory[0].to).toBe('reserved');
      expect(result.statusHistory[0].actor.uid).toBe('u1');
    });

    it('should set confirmedAt on PAYMENT_SUCCESS', () => {
      const confirmedOrder = { ...mockOrder, status: 'payment_pending' };
      const result = SM.transition(confirmedOrder, 'PAYMENT_SUCCESS', mockActor);
      expect(result.status).toBe('confirmed');
      expect(result.confirmedAt).toBeDefined();
    });

    it('should throw error for illegal transition', () => {
      expect(() => SM.transition(mockOrder, 'PAYMENT_SUCCESS', mockActor)).toThrow(
        'Invalid transition',
      );
    });
  });

  describe('validateTransition', () => {
    it('should block non-admin transitions for admin events', () => {
      const order = { status: 'confirmed' };
      const actor = { role: 'user' };
      const result = SM.validateTransition(order, 'CANCEL', actor);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('requires admin authority');
    });

    it('should allow admin transitions for admin events', () => {
      const order = { status: 'confirmed' };
      const actor = { role: 'admin' };
      const result = SM.validateTransition(order, 'CANCEL', actor);
      expect(result.valid).toBe(true);
    });
  });

  describe('Refund Approval Logic', () => {
    it('should require auto approval for small amounts', () => {
      const req = SM.getRefundApprovalRequirement(100);
      expect(req.type).toBe('auto');
      expect(req.approversRequired).toBe(0);
    });

    it('should require dual approval for high amounts', () => {
      const req = SM.getRefundApprovalRequirement(6000);
      expect(req.type).toBe('dual');
      expect(req.approversRequired).toBe(2);
    });
  });
});
