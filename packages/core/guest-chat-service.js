import { randomUUID } from 'crypto';

const CHATS_COLLECTION = 'chats';
const CHAT_MEMBERS_COLLECTION = 'chatMembers';
const CHAT_MESSAGES_COLLECTION = 'chatMessages';
const CHAT_MESSAGE_REPORTS_COLLECTION = 'chatMessageReports';
const PRIVATE_CONVERSATIONS_COLLECTION = 'privateConversations';
const DIRECT_MESSAGES_COLLECTION = 'directMessages';
const EVENT_GROUP_MESSAGES_COLLECTION = 'eventGroupMessages';

const ACTIVE_ORDER_STATUSES = ['confirmed', 'checked_in', 'paid'];
const MAX_EVENT_CHAT_ROOM_MEMBERS = 250;
const REPORTED_MESSAGE_PLACEHOLDER = 'This message is under review';
const MESSAGE_REPORT_HIDE_THRESHOLD = 3;
const CHAT_STRIKE_BAN_THRESHOLD = 3;

function nowIso() {
  return new Date().toISOString();
}

function serializeDoc(doc) {
  if (!doc?.exists && !doc?.data) return null;
  const data = typeof doc.data === 'function' ? doc.data() || {} : {};
  return { id: doc.id, ...data };
}

function eventChatId(eventId, roomNumber = 1) {
  const normalizedRoomNumber = Math.max(1, Number(roomNumber) || 1);
  return normalizedRoomNumber === 1
    ? `event_${eventId}`
    : `event_${eventId}_room_${normalizedRoomNumber}`;
}

function memberId(chatId, userId) {
  return `${chatId}_${userId}`;
}

function displayNameFromProfile(profile = {}, fallback = 'C1RCLE member') {
  return (
    profile.displayName ||
    profile.name ||
    profile.fullName ||
    profile.userName ||
    profile.email ||
    fallback
  );
}

function avatarFromProfile(profile = {}) {
  return profile.photoURL || profile.avatar || profile.image || profile.profileImage || null;
}

function isPremiumProfile(profile = {}) {
  const subscription = profile.subscription || profile.membership || {};
  const status = String(
    profile.subscriptionStatus || profile.membershipStatus || subscription.status || '',
  ).toLowerCase();

  return (
    profile.isPremium === true ||
    profile.c1rclePlus === true ||
    subscription.isPremium === true ||
    status === 'active' ||
    status === 'trialing'
  );
}

function firstNameOnly(name) {
  const cleaned = String(name || '').trim();
  if (!cleaned) return 'C1RCLE member';
  return cleaned.split(/\s+/)[0] || cleaned;
}

async function getUserProfile(db, userId) {
  if (!userId) return {};
  try {
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? doc.data() || {} : {};
  } catch {
    return {};
  }
}

function normalizeReportedBy(message = {}) {
  if (Array.isArray(message.reportedBy)) {
    return [...new Set(message.reportedBy.filter(Boolean).map(String))];
  }
  if (message.reportedBy) return [String(message.reportedBy)];
  return [];
}

function messageSenderId(message = {}, fallbackSenderId = null) {
  return message.senderId || message.userId || fallbackSenderId || null;
}

function sanitizeReportReason(reason) {
  if (!reason) return null;
  const cleaned = String(reason).trim();
  return cleaned ? cleaned.slice(0, 300) : null;
}

function isMessageVisibleToUser(message = {}, userId) {
  if (message.isHidden === true) return false;
  return !normalizeReportedBy(message).includes(String(userId));
}

export async function assertUserCanSendChatMessage(db, userId) {
  const profile = await getUserProfile(db, userId);
  if (profile.isChatBanned === true) {
    throw new Error('Chat banned');
  }
  return profile;
}

async function getEvent(db, eventId) {
  const doc = await db.collection('events').doc(eventId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

function buildEventChat(event, roomNumber = 1) {
  const title = event?.title || event?.eventTitle || 'Event chat';
  const normalizedRoomNumber = Math.max(1, Number(roomNumber) || 1);
  const roomTitle = normalizedRoomNumber === 1 ? title : `${title} - Room ${normalizedRoomNumber}`;
  const cover =
    event?.eventCover ||
    event?.coverImage ||
    event?.coverPhoto ||
    event?.poster ||
    event?.image ||
    event?.photoURL ||
    null;
  const eventDate = event?.startDate || event?.eventDate || event?.date || null;
  const participantCount =
    Number(event?.stats?.ticketsSold || event?.participantCount || event?.ticketsSold || 0) || 0;

  return {
    id: eventChatId(event.id, normalizedRoomNumber),
    type: 'event',
    eventId: event.id,
    eventTitle: roomTitle,
    baseEventTitle: title,
    title: roomTitle,
    eventCover: cover,
    image: cover,
    eventDate,
    participantCount,
    roomNumber: normalizedRoomNumber,
    roomLabel: `Room ${normalizedRoomNumber}`,
    roomCapacity: MAX_EVENT_CHAT_ROOM_MEMBERS,
    roomMemberCount: 0,
    totalEventParticipantCount: participantCount,
    activeAvatars: Array.isArray(event?.activeAvatars) ? event.activeAvatars.slice(0, 6) : [],
    status: 'active',
  };
}

async function getChatDoc(db, chatId) {
  const doc = await db.collection(CHATS_COLLECTION).doc(chatId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function createEventChatIfNeeded(db, eventId, roomNumber = 1) {
  const chatId = eventChatId(eventId, roomNumber);
  const existing = await getChatDoc(db, chatId);
  if (existing) return existing;

  const event = await getEvent(db, eventId);
  if (!event) throw new Error('Event not found');

  const now = nowIso();
  const chat = {
    ...buildEventChat(event, roomNumber),
    createdAt: now,
    updatedAt: now,
    lastMessage: null,
    lastMessageAt: null,
  };

  await db.collection(CHATS_COLLECTION).doc(chatId).set(chat, { merge: true });
  return chat;
}

async function getEventChatRooms(db, eventId) {
  const snapshot = await db
    .collection(CHATS_COLLECTION)
    .where('type', '==', 'event')
    .where('eventId', '==', eventId)
    .get()
    .catch(() => ({ docs: [] }));

  return (snapshot.docs || [])
    .map((doc) => serializeDoc(doc))
    .filter(Boolean)
    .sort((a, b) => Number(a.roomNumber || 1) - Number(b.roomNumber || 1));
}

async function countQueryFallback(query) {
  if (typeof query.count === 'function') {
    try {
      const snapshot = await query.count().get();
      const value = snapshot.data?.().count;
      if (Number.isFinite(Number(value))) return Number(value);
    } catch {
      // Older Firestore mocks and emulator paths may not expose aggregate counts.
    }
  }

  const snapshot = await query.get().catch(() => ({ docs: [] }));
  return (snapshot.docs || []).length;
}

async function countActiveMembers(db, chatId) {
  return countQueryFallback(
    db
      .collection(CHAT_MEMBERS_COLLECTION)
      .where('chatId', '==', chatId)
      .where('status', '==', 'active'),
  );
}

async function countActiveEventMembers(db, eventId) {
  return countQueryFallback(
    db
      .collection(CHAT_MEMBERS_COLLECTION)
      .where('eventId', '==', eventId)
      .where('status', '==', 'active'),
  );
}

async function getExistingEventMember(db, eventId, userId) {
  const snapshot = await db
    .collection(CHAT_MEMBERS_COLLECTION)
    .where('eventId', '==', eventId)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get()
    .catch(() => ({ empty: true, docs: [] }));

  if (snapshot.empty || !snapshot.docs?.length) return null;
  return serializeDoc(snapshot.docs[0]);
}

async function resolveEventChatForNewMember(db, event) {
  let rooms = await getEventChatRooms(db, event.id);
  if (rooms.length === 0) {
    rooms = [await createEventChatIfNeeded(db, event.id, 1)];
  }

  const currentRoom = rooms[rooms.length - 1];
  const currentRoomCount = await countActiveMembers(db, currentRoom.id);

  if (currentRoomCount < MAX_EVENT_CHAT_ROOM_MEMBERS) {
    return { chat: currentRoom, memberCount: currentRoomCount };
  }

  const nextRoomNumber = Number(currentRoom.roomNumber || rooms.length || 1) + 1;
  const nextRoom = await createEventChatIfNeeded(db, event.id, nextRoomNumber);
  return { chat: nextRoom, memberCount: 0 };
}

async function getMember(db, chatId, userId) {
  const doc = await db.collection(CHAT_MEMBERS_COLLECTION).doc(memberId(chatId, userId)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function hasActiveEventEntitlement(db, userId, eventId) {
  if (!userId || !eventId) return false;

  const queries = [
    db
      .collection('orders')
      .where('userId', '==', userId)
      .where('eventId', '==', eventId)
      .where('status', 'in', ACTIVE_ORDER_STATUSES)
      .limit(1)
      .get(),
    db
      .collection('rsvp_orders')
      .where('userId', '==', userId)
      .where('eventId', '==', eventId)
      .where('status', 'in', ACTIVE_ORDER_STATUSES)
      .limit(1)
      .get(),
    db
      .collection('guestlist')
      .where('userId', '==', userId)
      .where('eventId', '==', eventId)
      .where('status', '==', 'approved')
      .limit(1)
      .get(),
    db
      .collection('ticket_assignments')
      .where('redeemerId', '==', userId)
      .where('eventId', '==', eventId)
      .where('status', '==', 'active')
      .limit(1)
      .get(),
    db
      .collection('entitlements')
      .where('ownerUserId', '==', userId)
      .where('eventId', '==', eventId)
      .where('state', 'in', ['ISSUED', 'ACTIVE'])
      .limit(1)
      .get(),
  ];

  const snapshots = await Promise.all(queries.map((query) => query.catch(() => ({ empty: true }))));
  return snapshots.some((snapshot) => !snapshot.empty);
}

export async function ensureEventChatMembership(
  db,
  { eventId, userId, userName, userEmail, userAvatar = null, source = 'ticket', orderId = null },
) {
  if (!eventId || !userId) throw new Error('eventId and userId are required');

  const existingMember = await getExistingEventMember(db, eventId, userId);
  if (existingMember?.chatId) {
    const existingChat = await getChatDoc(db, existingMember.chatId);
    if (existingChat) return { chat: existingChat, member: existingMember };
  }

  const event = await getEvent(db, eventId);
  if (!event) throw new Error('Event not found');

  const { chat, memberCount } = await resolveEventChatForNewMember(db, event);
  const profile = await getUserProfile(db, userId);
  const now = nowIso();
  const member = {
    id: memberId(chat.id, userId),
    chatId: chat.id,
    type: 'event',
    eventId,
    roomNumber: Number(chat.roomNumber || 1),
    userId,
    displayName: userName || displayNameFromProfile(profile, userEmail || 'C1RCLE member'),
    photoURL: userAvatar || avatarFromProfile(profile),
    status: 'active',
    source,
    orderId,
    joinedAt: now,
    lastReadAt: null,
    unreadCount: 0,
    updatedAt: now,
  };

  const nextRoomMemberCount = memberCount + 1;
  const batch = db.batch();
  batch.set(db.collection(CHAT_MEMBERS_COLLECTION).doc(member.id), member, { merge: true });
  batch.set(
    db.collection(CHATS_COLLECTION).doc(chat.id),
    {
      roomMemberCount: nextRoomMemberCount,
      participantCount: nextRoomMemberCount,
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();

  return {
    chat: {
      ...chat,
      roomMemberCount: nextRoomMemberCount,
      participantCount: nextRoomMemberCount,
    },
    member,
  };
}

async function resolveChat(db, rawChatId) {
  const direct = await getChatDoc(db, rawChatId);
  if (direct) return { chatId: direct.id, chat: direct, source: 'chats' };

  const eventId = rawChatId.startsWith('event_') ? rawChatId.slice('event_'.length) : rawChatId;
  const eventChat = await getChatDoc(db, eventChatId(eventId));
  if (eventChat) return { chatId: eventChat.id, chat: eventChat, source: 'chats' };

  const privateDoc = await db.collection(PRIVATE_CONVERSATIONS_COLLECTION).doc(rawChatId).get();
  if (privateDoc.exists) {
    const data = privateDoc.data() || {};
    return {
      chatId: privateDoc.id,
      chat: {
        id: privateDoc.id,
        type: 'direct',
        title: 'Private chat',
        status: data.status || 'pending',
        participants: data.participants || [],
        eventId: data.eventId || null,
        lastMessage: data.lastMessage || null,
        lastMessageAt: data.lastMessage?.createdAt || data.updatedAt || data.createdAt || null,
        createdAt: data.createdAt || null,
      },
      source: 'legacy-direct',
    };
  }

  const event = await getEvent(db, eventId).catch(() => null);
  if (event) {
    const chat = await createEventChatIfNeeded(db, eventId);
    return { chatId: chat.id, chat, source: 'chats' };
  }

  return null;
}

function toInboxChat(chat, member = {}) {
  const lastMessage = chat.lastMessage || null;
  return {
    id: chat.id,
    type: chat.type || member.type || 'direct',
    eventId: chat.eventId || member.eventId || null,
    eventTitle: chat.eventTitle || chat.title || '',
    eventCover: chat.eventCover || chat.image || null,
    eventDate: chat.eventDate || null,
    title: chat.title || chat.eventTitle || member.displayName || 'Chat',
    participantCount: Number(chat.participantCount || chat.roomMemberCount || 0),
    roomNumber: Number(chat.roomNumber || member.roomNumber || 1),
    roomLabel: chat.roomLabel || `Room ${Number(chat.roomNumber || member.roomNumber || 1)}`,
    roomCapacity: Number(chat.roomCapacity || MAX_EVENT_CHAT_ROOM_MEMBERS),
    roomMemberCount: Number(chat.roomMemberCount || chat.participantCount || 0),
    activeAvatars: Array.isArray(chat.activeAvatars) ? chat.activeAvatars : [],
    lastMessage: lastMessage?.content || chat.lastMessageText || '',
    lastMessageType: lastMessage?.type || null,
    lastMessageTime:
      lastMessage?.createdAt || chat.lastMessageAt || chat.updatedAt || chat.createdAt || null,
    lastMessageAt: lastMessage?.createdAt || chat.lastMessageAt || null,
    unreadCount: Number(member.unreadCount || 0),
    status: chat.status || member.status || 'active',
    participants: Array.isArray(chat.participants) ? chat.participants : [],
  };
}

async function fetchChatsByIds(db, chatIds) {
  const uniqueIds = [...new Set(chatIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      db
        .collection(CHATS_COLLECTION)
        .where('__name__', 'in', chunk)
        .get()
        .catch(() => ({
          docs: [],
        })),
    ),
  );

  const map = new Map();
  snapshots
    .flatMap((snapshot) => snapshot.docs || [])
    .forEach((doc) => map.set(doc.id, { id: doc.id, ...doc.data() }));
  return map;
}

async function listLegacyDirectChats(db, userId, limit) {
  const snapshot = await db
    .collection(PRIVATE_CONVERSATIONS_COLLECTION)
    .where('participants', 'array-contains', userId)
    .limit(limit)
    .get()
    .catch(() => ({ docs: [] }));

  return (snapshot.docs || []).map((doc) => {
    const data = doc.data() || {};
    return toInboxChat({
      id: doc.id,
      type: 'direct',
      title: data.otherUserName || 'Private chat',
      status: data.status || 'pending',
      participants: data.participants || [],
      eventId: data.eventId || null,
      lastMessage: data.lastMessage || null,
      lastMessageAt: data.lastMessage?.createdAt || data.updatedAt || data.createdAt || null,
      createdAt: data.createdAt || null,
    });
  });
}

export async function listUserChats(db, userId, { type = 'all', limit = 50 } = {}) {
  if (!userId) throw new Error('userId is required');

  const memberSnapshot = await db
    .collection(CHAT_MEMBERS_COLLECTION)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(limit)
    .get();

  const members = (memberSnapshot.docs || []).map((doc) => ({ id: doc.id, ...doc.data() }));
  const chatMap = await fetchChatsByIds(
    db,
    members.map((member) => member.chatId),
  );

  const chats = members
    .map((member) => {
      const chat = chatMap.get(member.chatId);
      return chat ? toInboxChat(chat, member) : null;
    })
    .filter(Boolean);

  if (type !== 'event') {
    const existing = new Set(chats.map((chat) => chat.id));
    for (const chat of await listLegacyDirectChats(db, userId, limit)) {
      if (!existing.has(chat.id)) chats.push(chat);
    }
  }

  const filtered = chats
    .filter((chat) => type === 'all' || chat.type === type)
    .sort((a, b) => {
      const bTime = new Date(b.lastMessageTime || b.createdAt || 0).getTime();
      const aTime = new Date(a.lastMessageTime || a.createdAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);

  const eventChats = filtered.filter((chat) => chat.type === 'event');
  const privateChats = filtered.filter((chat) => chat.type === 'direct');
  const totalUnread = filtered.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0);

  return { chats: filtered, eventChats, privateChats, totalUnread };
}

async function assertChatAccess(db, resolved, userId, { forSend = false } = {}) {
  const { chatId, chat, source } = resolved;

  if (source === 'legacy-direct') {
    if (!Array.isArray(chat.participants) || !chat.participants.includes(userId)) {
      throw new Error('Forbidden');
    }
    if (forSend && chat.status !== 'accepted') throw new Error('Chat is not open');
    return { chatId, chat, source };
  }

  const member = await getMember(db, chatId, userId);
  if (member?.status === 'active') {
    if (
      forSend &&
      chat.type === 'event' &&
      (chat.isActive === false ||
        ['archived', 'inactive', 'closed'].includes(String(chat.status || '').toLowerCase()))
    ) {
      throw new Error('Chat is not open');
    }
    return { chatId, chat, member, source };
  }

  if (chat.type === 'event' && (await hasActiveEventEntitlement(db, userId, chat.eventId))) {
    const healed = await ensureEventChatMembership(db, {
      eventId: chat.eventId,
      userId,
      source: 'entitlement_self_heal',
    });
    return { chatId, chat: healed.chat, member: healed.member, source };
  }

  throw new Error('Forbidden');
}

function normalizeMessage(doc, chat) {
  const data = typeof doc.data === 'function' ? doc.data() || {} : doc || {};
  const rawType = data.type || (data.imageUrl ? 'image' : 'text');
  const isHidden = Boolean(data.isHidden);
  const reportCount = Number(data.reportCount || normalizeReportedBy(data).length || 0);
  const isReported = Boolean(data.isReported || reportCount > 0);
  const content = isHidden
    ? REPORTED_MESSAGE_PLACEHOLDER
    : data.content || data.text || data.imageUrl || '';

  return {
    id: doc.id || data.id,
    chatId: data.chatId || chat.id,
    eventId: data.eventId || chat.eventId || undefined,
    conversationId: data.conversationId || (chat.type === 'direct' ? chat.id : undefined),
    senderId: data.senderId || data.userId,
    senderName: data.senderName || data.userName || 'Attendee',
    senderAvatar: data.senderAvatar || data.senderPhoto || data.userAvatar || undefined,
    senderBadge: data.senderBadge || data.userBadge || undefined,
    content,
    imageUrl: isHidden ? null : data.imageUrl || (rawType === 'image' ? data.content : undefined),
    type: isHidden ? 'text' : rawType,
    createdAt: data.createdAt,
    isDeleted: Boolean(data.isDeleted),
    isReported,
    isHidden,
    reportCount,
    replyTo: data.replyTo || data.replyToId || undefined,
  };
}

export async function getChatMessages(db, userId, chatId, { limit = 50, before = null } = {}) {
  const resolved = await resolveChat(db, chatId);
  if (!resolved) throw new Error('Chat not found');
  const access = await assertChatAccess(db, resolved, userId);

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 50));
  let query;

  if (access.source === 'legacy-direct') {
    query = db
      .collection(DIRECT_MESSAGES_COLLECTION)
      .where('conversationId', '==', access.chatId)
      .orderBy('createdAt', 'desc');
  } else {
    query = db
      .collection(CHAT_MESSAGES_COLLECTION)
      .where('chatId', '==', access.chatId)
      .orderBy('createdAt', 'desc');
  }

  if (before) {
    query = query.where('createdAt', '<', before);
  }

  const snapshot = await query.limit(safeLimit + 1).get();
  const docs = snapshot.docs || [];
  const hasMore = docs.length > safeLimit;
  const pageDocs = docs
    .filter((doc) => isMessageVisibleToUser(doc.data?.() || {}, userId))
    .slice(0, safeLimit);
  const messages = pageDocs.map((doc) => normalizeMessage(doc, access.chat)).reverse();
  const nextCursor =
    hasMore && pageDocs.length ? pageDocs[pageDocs.length - 1].data().createdAt : null;

  return {
    chat: toInboxChat(access.chat, access.member),
    messages,
    pagination: {
      limit: safeLimit,
      nextCursor,
      hasMore,
    },
  };
}

export async function countApprovedEventMedia(db, eventId) {
  if (!eventId) throw new Error('eventId is required');

  const query = db
    .collection('eventMedia')
    .where('eventId', '==', eventId)
    .where('isApproved', '==', true);
  if (typeof query.count === 'function') {
    const aggregate = await query.count().get();
    return Number(aggregate.data()?.count || 0);
  }

  const snapshot = await query.get();
  return snapshot.docs?.length || 0;
}

async function assertCanSendEventMessage(db, chat, userId) {
  const [removedSnap, mutedSnap] = await Promise.all([
    db
      .collection('eventChatRemovals')
      .where('eventId', '==', chat.eventId)
      .where('userId', '==', userId)
      .limit(1)
      .get()
      .catch(() => ({ empty: true })),
    db
      .collection('eventMutes')
      .where('eventId', '==', chat.eventId)
      .where('userId', '==', userId)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  if (!removedSnap.empty) throw new Error('Removed from chat');
  const now = Date.now();
  const activeMute = (mutedSnap.docs || []).some((doc) => {
    const mutedUntil = new Date(doc.data()?.mutedUntil || 0).getTime();
    return mutedUntil > now;
  });
  if (activeMute) throw new Error('Muted in chat');
}

function validatePayload({ text, imageUrl, type }) {
  const normalizedType = type || (imageUrl ? 'image' : 'text');
  const content = normalizedType === 'image' ? imageUrl : text;
  if (!content || !String(content).trim()) throw new Error('Message content is required');
  if (normalizedType === 'text' && String(content).length > 1000) {
    throw new Error('Message is too long');
  }
  return { type: normalizedType, content: String(content).trim() };
}

export async function sendChatMessage(
  db,
  userId,
  chatId,
  { text = null, imageUrl = null, type = null, metadata = {} } = {},
) {
  const resolved = await resolveChat(db, chatId);
  if (!resolved) throw new Error('Chat not found');
  const access = await assertChatAccess(db, resolved, userId, { forSend: true });
  const profile = await assertUserCanSendChatMessage(db, userId);
  const { content, type: messageType } = validatePayload({ text, imageUrl, type });

  if (access.chat.type === 'event') {
    await assertCanSendEventMessage(db, access.chat, userId);
  }

  const createdAt = nowIso();
  const id = `msg_${randomUUID().slice(0, 12)}`;
  const senderName = displayNameFromProfile(profile, 'Attendee');
  const senderAvatar = avatarFromProfile(profile);
  const previewContent = messageType === 'image' ? 'Photo' : content;
  const message = {
    id,
    chatId: access.chatId,
    eventId: access.chat.eventId || null,
    conversationId: access.chat.type === 'direct' ? access.chatId : null,
    senderId: userId,
    senderName,
    senderAvatar,
    senderBadge: metadata.senderBadge || null,
    content,
    imageUrl: messageType === 'image' ? content : null,
    type: messageType,
    createdAt,
    isDeleted: false,
    replyTo: metadata.replyTo || null,
  };

  const batch = db.batch();
  batch.set(db.collection(CHAT_MESSAGES_COLLECTION).doc(id), message);

  if (access.source === 'legacy-direct') {
    batch.set(db.collection(DIRECT_MESSAGES_COLLECTION).doc(id), {
      id,
      conversationId: access.chatId,
      senderId: userId,
      content,
      type: messageType,
      createdAt,
      readAt: null,
      isDeleted: false,
    });
    batch.update(db.collection(PRIVATE_CONVERSATIONS_COLLECTION).doc(access.chatId), {
      lastMessage: {
        content: previewContent,
        senderId: userId,
        createdAt,
        type: messageType,
      },
      updatedAt: createdAt,
    });
  } else {
    batch.set(
      db.collection(CHATS_COLLECTION).doc(access.chatId),
      {
        lastMessage: {
          content: previewContent,
          senderId: userId,
          createdAt,
          type: messageType,
        },
        lastMessageAt: createdAt,
        updatedAt: createdAt,
      },
      { merge: true },
    );
  }

  batch.set(
    db.collection(CHAT_MEMBERS_COLLECTION).doc(memberId(access.chatId, userId)),
    { lastReadAt: createdAt, unreadCount: 0, updatedAt: createdAt },
    { merge: true },
  );

  if (access.chat.type === 'event') {
    batch.set(db.collection(EVENT_GROUP_MESSAGES_COLLECTION).doc(id), {
      id,
      eventId: access.chat.eventId,
      userId,
      senderName: 'Attendee',
      senderPhoto: null,
      text: messageType === 'text' ? content : '',
      imageUrl: messageType === 'image' ? content : null,
      createdAt,
      metadata: { isAnonymous: true },
    });
  }

  await batch.commit();
  return {
    message: normalizeMessage(message, access.chat),
    chat: toInboxChat(access.chat, access.member),
  };
}

async function applyMessageReport(
  db,
  {
    messageRef,
    messageDoc,
    reporterId,
    reportId,
    chatId = null,
    eventId = null,
    conversationId = null,
    fallbackSenderId = null,
    reason = null,
    details = null,
    mirrorRefs = [],
    chat = {},
  } = {},
) {
  if (!messageRef || !messageDoc?.exists) throw new Error('Message not found');

  const message = messageDoc.data() || {};
  const reportedBy = normalizeReportedBy(message);
  const messageId = messageDoc.id || message.id;
  const reportedUserId = messageSenderId(message, fallbackSenderId);
  const alreadyReported = reportedBy.includes(String(reporterId));
  const now = nowIso();
  const safeReportId = reportId || `${messageId}_${reporterId}`;
  const currentReportCount = Number(message.reportCount || reportedBy.length || 0);

  if (alreadyReported) {
    return {
      report: {
        id: safeReportId,
        chatId,
        eventId,
        conversationId,
        messageId,
        status: 'already_reported',
        reportCount: currentReportCount,
        createdAt: now,
      },
      moderation: {
        reportCount: currentReportCount,
        hidden: message.isHidden === true,
        strikeApplied: false,
        chatStrikes: null,
        chatBanned: false,
      },
      message: normalizeMessage({ id: messageId, data: () => message }, chat),
    };
  }

  const nextReportedBy = [...reportedBy, String(reporterId)];
  const reportCount = nextReportedBy.length;
  const shouldHide = reportCount >= MESSAGE_REPORT_HIDE_THRESHOLD && message.isHidden !== true;
  const update = {
    isReported: true,
    moderationStatus: shouldHide ? 'hidden_by_community_reports' : 'pending_review',
    reportedAt: now,
    reportedBy: nextReportedBy,
    reportCount,
    updatedAt: now,
  };

  if (shouldHide) {
    update.isHidden = true;
    update.hiddenAt = now;
    update.hiddenReason = 'community_reports';
  }

  const batch = db.batch();
  batch.set(messageRef, update, { merge: true });
  mirrorRefs.forEach((ref) => batch.set(ref, update, { merge: true }));
  batch.set(
    db.collection(CHAT_MESSAGE_REPORTS_COLLECTION).doc(safeReportId),
    {
      id: safeReportId,
      chatId,
      eventId,
      conversationId,
      messageId,
      reporterId,
      reportedUserId,
      reason: sanitizeReportReason(reason),
      details: details ? String(details).trim().slice(0, 1000) : null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  let strikeUpdate = null;
  if (shouldHide && reportedUserId) {
    const senderRef = db.collection('users').doc(reportedUserId);
    const senderDoc = await senderRef.get().catch(() => null);
    const senderProfile = senderDoc?.exists ? senderDoc.data() || {} : {};
    const nextStrikes = Number(senderProfile.chatStrikes || 0) + 1;
    strikeUpdate = {
      chatStrikes: nextStrikes,
      lastChatStrikeAt: now,
      updatedAt: now,
    };

    if (nextStrikes >= CHAT_STRIKE_BAN_THRESHOLD) {
      strikeUpdate.isChatBanned = true;
      strikeUpdate.chatBannedAt = senderProfile.chatBannedAt || now;
    }

    batch.set(senderRef, strikeUpdate, { merge: true });
  }

  await batch.commit();

  return {
    report: {
      id: safeReportId,
      chatId,
      eventId,
      conversationId,
      messageId,
      status: 'pending',
      reportCount,
      createdAt: now,
    },
    moderation: {
      reportCount,
      hidden: Boolean(shouldHide || message.isHidden === true),
      strikeApplied: Boolean(strikeUpdate),
      chatStrikes: strikeUpdate?.chatStrikes ?? null,
      chatBanned: strikeUpdate?.isChatBanned === true,
    },
    message: normalizeMessage({ id: messageId, data: () => ({ ...message, ...update }) }, chat),
  };
}

export async function reportChatMessage(db, userId, chatId, messageId, { reason = null } = {}) {
  if (!userId || !chatId || !messageId)
    throw new Error('userId, chatId and messageId are required');

  const resolved = await resolveChat(db, chatId);
  if (!resolved) throw new Error('Chat not found');
  const access = await assertChatAccess(db, resolved, userId);

  const messageRef = db.collection(CHAT_MESSAGES_COLLECTION).doc(messageId);
  const messageDoc = await messageRef.get();
  if (!messageDoc.exists) throw new Error('Message not found');

  const message = messageDoc.data() || {};
  if (message.chatId !== access.chatId) throw new Error('Message not found');

  const mirrorRefs = [];
  if (access.source === 'legacy-direct') {
    mirrorRefs.push(db.collection(DIRECT_MESSAGES_COLLECTION).doc(messageId));
  }
  if (access.chat.type === 'event') {
    mirrorRefs.push(db.collection(EVENT_GROUP_MESSAGES_COLLECTION).doc(messageId));
  }

  return applyMessageReport(db, {
    messageRef,
    messageDoc,
    reporterId: userId,
    reportId: `${messageId}_${userId}`,
    chatId: access.chatId,
    eventId: access.chat.eventId || message.eventId || null,
    conversationId: access.chat.type === 'direct' ? access.chatId : message.conversationId || null,
    reason,
    mirrorRefs,
    chat: access.chat,
  });
}

export async function reportSocialMessage(
  db,
  userId,
  {
    messageId,
    senderId = null,
    eventId = null,
    conversationId = null,
    chatId = null,
    reason = null,
    details = null,
  } = {},
) {
  if (!userId || !messageId) throw new Error('userId and messageId are required');
  if (chatId) {
    return reportChatMessage(db, userId, chatId, messageId, { reason });
  }

  let collectionName = null;
  let chat = {};

  if (eventId) {
    collectionName = EVENT_GROUP_MESSAGES_COLLECTION;
    chat = { id: eventChatId(eventId), type: 'event', eventId };
  } else if (conversationId) {
    const conversationDoc = await db
      .collection(PRIVATE_CONVERSATIONS_COLLECTION)
      .doc(conversationId)
      .get();
    if (!conversationDoc.exists) throw new Error('Message not found');
    const conversation = conversationDoc.data() || {};
    if (!Array.isArray(conversation.participants) || !conversation.participants.includes(userId)) {
      throw new Error('Forbidden');
    }
    collectionName = DIRECT_MESSAGES_COLLECTION;
    chat = { id: conversationId, type: 'direct', conversationId };
  } else {
    throw new Error('eventId, conversationId or chatId is required');
  }

  const messageRef = db.collection(collectionName).doc(messageId);
  const messageDoc = await messageRef.get();
  if (!messageDoc.exists) throw new Error('Message not found');

  const message = messageDoc.data() || {};
  if (eventId && message.eventId !== eventId) throw new Error('Message not found');
  if (conversationId && message.conversationId !== conversationId)
    throw new Error('Message not found');

  const mirrorRefs = [];
  const canonicalMessageRef = db.collection(CHAT_MESSAGES_COLLECTION).doc(messageId);
  const canonicalMessageDoc = await canonicalMessageRef.get().catch(() => ({ exists: false }));
  if (canonicalMessageDoc.exists) {
    mirrorRefs.push(canonicalMessageRef);
  }

  return applyMessageReport(db, {
    messageRef,
    messageDoc,
    reporterId: userId,
    reportId: `${collectionName}_${messageId}_${userId}`,
    chatId: chat.id || null,
    eventId: eventId || message.eventId || null,
    conversationId: conversationId || message.conversationId || null,
    fallbackSenderId: senderId,
    reason,
    details,
    mirrorRefs,
    chat,
  });
}

async function fetchUsersByIds(db, userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      db
        .collection('users')
        .where('__name__', 'in', chunk)
        .get()
        .catch(() => ({ docs: [] })),
    ),
  );

  const profiles = new Map();
  snapshots
    .flatMap((snapshot) => snapshot.docs || [])
    .forEach((doc) => profiles.set(doc.id, { id: doc.id, ...doc.data() }));
  return profiles;
}

function dedupeAttendeeSeeds(seeds) {
  const seen = new Map();
  for (const seed of seeds) {
    if (!seed?.userId || seen.has(seed.userId)) continue;
    seen.set(seed.userId, seed);
  }
  return [...seen.values()];
}

async function listEventAttendeeSeeds(db, eventId, limit) {
  const memberSnapshot = await db
    .collection(CHAT_MEMBERS_COLLECTION)
    .where('eventId', '==', eventId)
    .where('status', '==', 'active')
    .limit(limit)
    .get()
    .catch(() => ({ docs: [] }));

  const memberSeeds = (memberSnapshot.docs || []).map((doc) => {
    const data = doc.data() || {};
    return {
      userId: data.userId,
      name: data.displayName,
      avatar: data.photoURL,
      badge: data.badge,
      joinedAt: data.joinedAt,
      source: 'chat_member',
    };
  });

  if (memberSeeds.length > 0) return dedupeAttendeeSeeds(memberSeeds).slice(0, limit);

  const snapshots = await Promise.all(
    [
      db
        .collection('orders')
        .where('eventId', '==', eventId)
        .where('status', 'in', ACTIVE_ORDER_STATUSES)
        .limit(limit)
        .get(),
      db
        .collection('rsvp_orders')
        .where('eventId', '==', eventId)
        .where('status', 'in', ACTIVE_ORDER_STATUSES)
        .limit(limit)
        .get(),
      db
        .collection('guestlist')
        .where('eventId', '==', eventId)
        .where('status', '==', 'approved')
        .limit(limit)
        .get(),
    ].map((query) => query.catch(() => ({ docs: [] }))),
  );

  const orderSeeds = snapshots.flatMap((snapshot) =>
    (snapshot.docs || []).map((doc) => {
      const data = doc.data() || {};
      return {
        userId: data.userId,
        name: data.userName || data.customerName || data.name,
        avatar: data.userAvatar || null,
        badge: data.ticketTier || data.tierName || null,
        joinedAt: data.createdAt || data.updatedAt || null,
        source: 'ticket_order',
      };
    }),
  );

  return dedupeAttendeeSeeds(orderSeeds).slice(0, limit);
}

function buildAttendee(seed, profile, hasPremiumAccess) {
  const fullName = seed.name || displayNameFromProfile(profile, 'C1RCLE member');
  const avatar = seed.avatar || avatarFromProfile(profile);
  const badge = seed.badge || profile.badge || profile.roleBadge || 'Verified attendee';

  if (hasPremiumAccess) {
    return {
      userId: seed.userId,
      name: fullName,
      avatar,
      badge,
      isBlurred: false,
      canMessage: true,
    };
  }

  return {
    userId: seed.userId,
    name: firstNameOnly(fullName),
    avatar: null,
    blurredAvatar: avatar,
    badge: 'Verified attendee',
    isBlurred: true,
    canMessage: false,
  };
}

export async function getEventAttendees(db, eventId, userId, { limit = 100 } = {}) {
  if (!eventId || !userId) throw new Error('eventId and userId are required');

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
  const [event, viewerProfile] = await Promise.all([
    getEvent(db, eventId),
    getUserProfile(db, userId),
  ]);
  if (!event) throw new Error('Event not found');

  const hasPremiumAccess = isPremiumProfile(viewerProfile);
  const seeds = await listEventAttendeeSeeds(db, eventId, safeLimit);
  const profiles = await fetchUsersByIds(
    db,
    seeds.map((seed) => seed.userId),
  );
  const totalFromMembers = await countActiveEventMembers(db, eventId);
  const attendees = seeds.map((seed) =>
    buildAttendee(seed, profiles.get(seed.userId) || {}, hasPremiumAccess),
  );

  return {
    eventId,
    access: hasPremiumAccess ? 'full' : 'tease',
    isPremium: hasPremiumAccess,
    total: totalFromMembers || attendees.length,
    attendees,
  };
}

function eventEndMillis(event = {}) {
  const raw =
    event.endAt ||
    event.endDate ||
    event.endDateTime ||
    event.eventEndDate ||
    event.startAt ||
    event.startDate ||
    event.startDateTime;
  if (!raw) return 0;
  const iso = typeof raw?.toDate === 'function' ? raw.toDate().toISOString() : raw;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

async function listEventsEndedBefore(db, cutoffTime, limit) {
  const cutoffIso = new Date(cutoffTime).toISOString();
  const snapshots = await Promise.all(
    ['endAt', 'endDate', 'startAt', 'startDate'].map((field) =>
      db
        .collection('events')
        .where(field, '<=', cutoffIso)
        .limit(limit)
        .get()
        .catch(() => ({ docs: [] })),
    ),
  );

  const events = new Map();
  snapshots
    .flatMap((snapshot) => snapshot.docs || [])
    .forEach((doc) => {
      if (!events.has(doc.id)) events.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
    });

  return [...events.values()]
    .filter((event) => eventEndMillis(event) > 0 && eventEndMillis(event) <= cutoffTime)
    .slice(0, limit);
}

export async function archiveExpiredEventChats(
  db,
  { now = new Date(), olderThanHours = 48, limit = 200, dryRun = false } = {},
) {
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowTime)) throw new Error('Invalid now');

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const cutoffTime = nowTime - Math.max(1, Number(olderThanHours) || 48) * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffTime).toISOString();
  const events = await listEventsEndedBefore(db, cutoffTime, safeLimit);
  const archivedEventIds = [];
  const archivedChatIds = [];
  const nowIsoValue = new Date(nowTime).toISOString();

  for (const event of events) {
    const chatSnapshot = await db
      .collection(CHATS_COLLECTION)
      .where('type', '==', 'event')
      .where('eventId', '==', event.id)
      .get()
      .catch(() => ({ docs: [] }));

    const activeChats = (chatSnapshot.docs || [])
      .map((doc) => serializeDoc(doc))
      .filter(
        (chat) => chat && chat.isActive !== false && String(chat.status || 'active') !== 'archived',
      );

    if (activeChats.length === 0) continue;
    archivedEventIds.push(event.id);

    if (dryRun) {
      archivedChatIds.push(...activeChats.map((chat) => chat.id));
      continue;
    }

    const batch = db.batch();
    activeChats.forEach((chat) => {
      archivedChatIds.push(chat.id);
      batch.set(
        db.collection(CHATS_COLLECTION).doc(chat.id),
        {
          isActive: false,
          status: 'archived',
          archivedAt: nowIsoValue,
          archivedReason: 'event_ended_48h',
          updatedAt: nowIsoValue,
        },
        { merge: true },
      );
    });
    await batch.commit();
  }

  return {
    archivedEvents: archivedEventIds.length,
    archivedChats: archivedChatIds.length,
    eventIds: archivedEventIds,
    chatIds: archivedChatIds,
    cutoffIso,
    dryRun: Boolean(dryRun),
  };
}
