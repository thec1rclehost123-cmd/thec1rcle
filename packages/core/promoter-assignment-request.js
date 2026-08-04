const ACTIVE_EVENT_STATES = new Set(['scheduled', 'published', 'active', 'live', 'upcoming']);

export class PromoterAssignmentRequestError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'PromoterAssignmentRequestError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function requireId(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new PromoterAssignmentRequestError('BAD_REQUEST', `${field} is required`, 400);
  }
  return normalized;
}

function resolveEventOwner(event) {
  if (event.hostId) return { partnerId: String(event.hostId), partnerType: 'host' };
  if (event.venueId) return { partnerId: String(event.venueId), partnerType: 'venue' };
  if (event.creatorId) {
    return {
      partnerId: String(event.creatorId),
      partnerType: String(event.creatorRole || 'partner').toLowerCase(),
    };
  }
  if (event.ownerId) {
    return {
      partnerId: String(event.ownerId),
      partnerType: String(event.ownerType || 'partner').toLowerCase(),
    };
  }
  return null;
}

export async function requestPromoterAssignment(db, { promoterId, eventId, promoterName = '' }) {
  if (!db) throw new Error('Missing Firestore instance');
  const normalizedPromoterId = requireId(promoterId, 'promoterId');
  const normalizedEventId = requireId(eventId, 'eventId');
  const requestId = `${normalizedPromoterId}_${normalizedEventId}`;
  const eventRef = db.collection('events').doc(normalizedEventId);
  const assignmentRef = db.collection('promoter_assignments').doc(requestId);
  const requestRef = db.collection('promoter_assignment_requests').doc(requestId);
  const notificationRef = db
    .collection('notifications')
    .doc(`promoter_assignment_request_${requestId}`);

  return db.runTransaction(async (transaction) => {
    const [eventDoc, assignmentDoc, requestDoc] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(assignmentRef),
      transaction.get(requestRef),
    ]);

    if (!eventDoc.exists) {
      throw new PromoterAssignmentRequestError('NOT_FOUND', 'Event not found', 404);
    }

    const event = eventDoc.data() || {};
    const lifecycle = String(event.lifecycle || event.status || 'draft').toLowerCase();
    if (!ACTIVE_EVENT_STATES.has(lifecycle) || event.promotersEnabled !== true) {
      throw new PromoterAssignmentRequestError(
        'PROMOTION_NOT_AVAILABLE',
        'This event is not accepting promoter requests',
        409,
      );
    }

    const assignment = assignmentDoc.exists ? assignmentDoc.data() || {} : null;
    if (assignment?.status === 'active') {
      return { status: 'assigned', requestId, alreadyAssigned: true };
    }

    const existingRequest = requestDoc.exists ? requestDoc.data() || {} : null;
    if (existingRequest?.status === 'pending') {
      return { status: 'pending', requestId, duplicate: true };
    }

    const owner = resolveEventOwner(event);
    if (!owner?.partnerId) {
      throw new PromoterAssignmentRequestError(
        'EVENT_OWNER_UNAVAILABLE',
        'This event cannot receive promoter requests yet',
        409,
      );
    }

    const now = new Date().toISOString();
    const request = {
      id: requestId,
      promoterId: normalizedPromoterId,
      promoterName: String(promoterName || '').trim() || null,
      eventId: normalizedEventId,
      eventTitle: String(event.title || event.name || 'Event'),
      targetPartnerId: owner.partnerId,
      targetPartnerType: owner.partnerType,
      status: 'pending',
      createdAt: existingRequest?.createdAt || now,
      updatedAt: now,
    };

    transaction.set(requestRef, request, { merge: true });
    transaction.set(
      notificationRef,
      {
        recipientId: owner.partnerId,
        recipientType: owner.partnerType,
        type: 'promoter_assignment_request',
        title: 'New promoter request',
        message: `${request.promoterName || 'A promoter'} wants to promote ${request.eventTitle}`,
        read: false,
        createdAt: now,
        updatedAt: now,
        data: {
          requestId,
          promoterId: normalizedPromoterId,
          eventId: normalizedEventId,
        },
      },
      { merge: true },
    );

    return { status: 'pending', requestId, duplicate: false };
  });
}
