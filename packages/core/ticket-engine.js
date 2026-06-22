/**
 * THE C1RCLE - Master Ticket Engine
 * Centralizes ticket sharing, transfers, and assignment logic.
 */

import { randomBytes, createHmac } from 'node:crypto';
import { getTicketSecret } from './secret-registry.js';

const TICKET_SECRET = getTicketSecret();

/**
 * Signs a ticket ID for QR verification.
 */
export function signTicketId(ticketId) {
  const signature = createHmac('sha256', getTicketSecret()).update(ticketId).digest('hex'); // full 64-char SHA-256 — was truncated to 16, giving only 64 bits of entropy
  return `${ticketId}:${signature}`;
}

/**
 * Generates a random secure token.
 */
export function generateSecureToken(length = 16) {
  return randomBytes(length).toString('hex');
}

/**
 * Validates a share bundle's status and expiration.
 */
export function validateBundle(bundle) {
  const now = new Date();
  if (bundle.status !== 'active') return { valid: false, reason: 'Bundle is not active' };
  if (bundle.remainingSlots <= 0) return { valid: false, reason: 'No slots remaining' };
  if (new Date(bundle.expiresAt) < now) return { valid: false, reason: 'Bundle expired' };
  return { valid: true };
}

/**
 * Validates a transfer's status and expiration.
 */
export function validateTransfer(transfer, recipientId) {
  const now = new Date();
  if (transfer.status !== 'pending') return { valid: false, reason: 'Transfer is not pending' };
  if (new Date(transfer.expiresAt) < now) return { valid: false, reason: 'Transfer expired' };
  if (transfer.senderId === recipientId)
    return { valid: false, reason: 'Sender and recipient are the same' };
  return { valid: true };
}

/**
 * Fetches tickets directly from the tickets collection for a user
 * and groups them into upcoming and past arrays with event details.
 */
export async function getUserTicketsFromCollection(userId) {
  const { getAdminDb } = await import('./admin.js');
  const db = getAdminDb();
  
  const ticketsSnap = await db.collection('tickets').where('userId', '==', userId).get();
  
  const upcomingTickets = [];
  const pastTickets = [];
  
  if (ticketsSnap.empty) {
    return { upcomingTickets, pastTickets };
  }

  // Extract unique event IDs
  const eventIds = [...new Set(ticketsSnap.docs.map(doc => doc.data().eventId).filter(Boolean))];
  const eventsMap = {};
  
  if (eventIds.length > 0) {
    // Firestore 'in' queries are limited to 30 items
    const chunks = [];
    for (let i = 0; i < eventIds.length; i += 30) {
      chunks.push(eventIds.slice(i, i + 30));
    }
    
    await Promise.all(chunks.map(async (chunk) => {
      const eventsSnap = await db.collection('events').where('__name__', 'in', chunk).get();
      eventsSnap.forEach(doc => {
        eventsMap[doc.id] = doc.data();
      });
    }));
  }

  const now = new Date();

  ticketsSnap.forEach(doc => {
    const ticket = doc.data();
    const event = eventsMap[ticket.eventId];
    
    let eventDetails = null;
    let isPast = false;

    if (event) {
      eventDetails = {
        title: event.title,
        poster: event.poster || event.image || null,
        date: event.startDate || event.startAt,
        venue: event.venue || event.venueName || event.location || 'TBD',
      };
      
      const eventEndDate = event.endDate 
        ? new Date(event.endDate) 
        : new Date(event.startDate || event.startAt);
      
      isPast = eventEndDate < now;
    }

    const ticketData = {
      id: doc.id,
      ...ticket,
      qrMode: ticket.qrMode || 'jwt',
      qrPayload: ticket.qrPayload || ticket.qrJwt || null,
      event: eventDetails
    };

    if (isPast || ticket.status === 'used') {
      pastTickets.push(ticketData);
    } else {
      upcomingTickets.push(ticketData);
    }
  });

  return { upcomingTickets, pastTickets };
}

/**
 * Initiates a group ticket transfer by generating a transfer token.
 */
export async function initiateGroupTransfer(userId, ticketId) {
  const { getAdminDb } = await import('./admin.js');
  const db = getAdminDb();

  const ticketRef = db.collection('tickets').doc(ticketId);
  const ticketDoc = await ticketRef.get();

  if (!ticketDoc.exists) {
    throw new Error('Ticket not found');
  }

  const ticket = ticketDoc.data();
  if (ticket.userId !== userId) {
    throw new Error('Unauthorized: You do not own this ticket');
  }

  if (ticket.status === 'used' || ticket.status === 'voided') {
    throw new Error('Ticket is no longer active and cannot be transferred');
  }

  const transferToken = generateSecureToken(32);
  
  await ticketRef.update({
    status: 'transfer_pending',
    transferToken,
    updatedAt: new Date().toISOString()
  });

  return { transferToken };
}

/**
 * Claims a group ticket transfer using a transfer token.
 */
export async function claimGroupTransfer(userId, transferToken) {
  const { getAdminDb } = await import('./admin.js');
  const { ensureEventChatMembership } = await import('./guest-chat-service.js');
  const db = getAdminDb();

  const ticketsSnap = await db.collection('tickets')
    .where('transferToken', '==', transferToken)
    .where('status', '==', 'transfer_pending')
    .limit(1)
    .get();

  if (ticketsSnap.empty) {
    throw new Error('Invalid or expired transfer token');
  }

  const ticketRef = ticketsSnap.docs[0].ref;
  let eventId = null;

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ticketRef);
    if (!doc.exists) {
      throw new Error('Ticket not found');
    }

    const ticket = doc.data();
    if (ticket.status !== 'transfer_pending' || ticket.transferToken !== transferToken) {
      throw new Error('Ticket is no longer available for transfer');
    }

    if (ticket.userId === userId) {
      throw new Error('You already own this ticket');
    }

    eventId = ticket.eventId;

    transaction.update(ticketRef, {
      userId,
      status: 'active',
      transferToken: null,
      updatedAt: new Date().toISOString()
    });
  });

  // Ensure the new owner is added to the event group chat
  if (eventId) {
    try {
      await ensureEventChatMembership(db, eventId, userId);
    } catch (err) {
      console.error(`Failed to add user ${userId} to event chat for ${eventId}:`, err);
      // Non-fatal, we still successfully transferred the ticket
    }
  }

  return { success: true, eventId, ticketId: ticketRef.id };
}

export default {
  signTicketId,
  generateSecureToken,
  validateBundle,
  validateTransfer,
  getUserTicketsFromCollection,
  initiateGroupTransfer,
  claimGroupTransfer,
};
