import { describe, expect, it } from 'vitest';
import {
  ensureEventChatMembership,
  getEventAttendees,
  getChatMessages,
  listUserChats,
  reportChatMessage,
  sendChatMessage,
} from './guest-chat-service.js';

function createDoc(collection, id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => data,
    ref: { collection, id },
  };
}

function createDb(seed = {}) {
  const store = new Map();
  for (const [collection, docs] of Object.entries(seed)) {
    store.set(collection, new Map(Object.entries(docs)));
  }

  function getCollection(name) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  }

  function query(name, filters = [], sort = null, limitValue = null) {
    return {
      where(field, op, value) {
        return query(name, [...filters, { field, op, value }], sort, limitValue);
      },
      orderBy(field, direction = 'asc') {
        return query(name, filters, { field, direction }, limitValue);
      },
      limit(value) {
        return query(name, filters, sort, value);
      },
      async get() {
        let docs = [...getCollection(name).entries()].map(([id, data]) =>
          createDoc(name, id, data),
        );
        docs = docs.filter((doc) =>
          filters.every((filter) => {
            const data = doc.data();
            const actual = filter.field === '__name__' ? doc.id : data?.[filter.field];
            if (filter.op === '==') return actual === filter.value;
            if (filter.op === 'in') return filter.value.includes(actual);
            if (filter.op === 'array-contains')
              return Array.isArray(actual) && actual.includes(filter.value);
            if (filter.op === '<') return actual < filter.value;
            return false;
          }),
        );
        if (sort) {
          docs.sort((a, b) => {
            const left = a.data()?.[sort.field] || '';
            const right = b.data()?.[sort.field] || '';
            return sort.direction === 'desc'
              ? right.localeCompare(left)
              : left.localeCompare(right);
          });
        }
        if (limitValue !== null) docs = docs.slice(0, limitValue);
        return { empty: docs.length === 0, docs };
      },
    };
  }

  return {
    store,
    collection(name) {
      return {
        ...query(name),
        doc(id) {
          return {
            collection: name,
            id,
            async get() {
              return createDoc(name, id, getCollection(name).get(id));
            },
            async set(data, options = {}) {
              const current = getCollection(name).get(id) || {};
              getCollection(name).set(id, options.merge ? { ...current, ...data } : data);
            },
            async update(data) {
              const current = getCollection(name).get(id);
              if (!current) throw new Error('not found');
              getCollection(name).set(id, { ...current, ...data });
            },
          };
        },
        async add(data) {
          const id = `${name}_${getCollection(name).size + 1}`;
          getCollection(name).set(id, data);
          return { id };
        },
      };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data, options = {}) {
          ops.push({ type: 'set', ref, data, options });
        },
        update(ref, data) {
          ops.push({ type: 'update', ref, data });
        },
        async commit() {
          for (const op of ops) {
            const current = getCollection(op.ref.collection).get(op.ref.id) || {};
            getCollection(op.ref.collection).set(
              op.ref.id,
              op.type === 'set' && !op.options?.merge ? op.data : { ...current, ...op.data },
            );
          }
        },
      };
    },
  };
}

describe('guest chat service', () => {
  it('creates an event chat membership when a ticket is fulfilled', async () => {
    const db = createDb({
      events: {
        event_1: {
          title: 'Neon District',
          image: 'cover.jpg',
          startDate: '2099-01-01T20:00:00.000Z',
        },
      },
      users: {
        user_1: { displayName: 'Aayush', photoURL: 'avatar.jpg' },
      },
    });

    const result = await ensureEventChatMembership(db, {
      eventId: 'event_1',
      userId: 'user_1',
      source: 'ticket',
      orderId: 'ord_1',
    });

    expect(result.chat).toMatchObject({ id: 'event_event_1', type: 'event' });
    expect(result.member).toMatchObject({
      chatId: 'event_event_1',
      userId: 'user_1',
      displayName: 'Aayush',
      source: 'ticket',
    });
  });

  it('lists active event chats and fetches messages 50 at a time', async () => {
    const messages = {};
    for (let i = 1; i <= 55; i += 1) {
      messages[`msg_${i}`] = {
        chatId: 'event_event_1',
        senderId: 'user_1',
        senderName: 'Aayush',
        content: `Message ${i}`,
        type: 'text',
        createdAt: `2099-01-01T00:${String(i).padStart(2, '0')}:00.000Z`,
      };
    }

    const db = createDb({
      chats: {
        event_event_1: {
          id: 'event_event_1',
          type: 'event',
          eventId: 'event_1',
          title: 'Neon District',
          lastMessage: {
            content: 'Message 55',
            senderId: 'user_1',
            createdAt: '2099-01-01T00:55:00.000Z',
          },
        },
      },
      chatMembers: {
        event_event_1_user_1: {
          chatId: 'event_event_1',
          userId: 'user_1',
          status: 'active',
          type: 'event',
        },
      },
      chatMessages: messages,
    });

    const inbox = await listUserChats(db, 'user_1');
    const page = await getChatMessages(db, 'user_1', 'event_event_1', { limit: 50 });

    expect(inbox.eventChats).toHaveLength(1);
    expect(page.messages).toHaveLength(50);
    expect(page.messages[0].content).toBe('Message 6');
    expect(page.messages[49].content).toBe('Message 55');
    expect(page.pagination.hasMore).toBe(true);
    expect(page.pagination.nextCursor).toBe('2099-01-01T00:06:00.000Z');
  });

  it('blocks non-members and stores sent messages for active members', async () => {
    const db = createDb({
      chats: {
        event_event_1: {
          id: 'event_event_1',
          type: 'event',
          eventId: 'event_1',
          title: 'Neon District',
        },
      },
      chatMembers: {
        event_event_1_user_1: {
          chatId: 'event_event_1',
          userId: 'user_1',
          status: 'active',
          type: 'event',
        },
      },
      users: {
        user_1: { displayName: 'Aayush' },
      },
    });

    await expect(getChatMessages(db, 'user_2', 'event_event_1', { limit: 50 })).rejects.toThrow(
      'Forbidden',
    );

    const sent = await sendChatMessage(db, 'user_1', 'event_event_1', { text: 'See you inside' });

    expect(sent.message).toMatchObject({
      chatId: 'event_event_1',
      senderId: 'user_1',
      content: 'See you inside',
      type: 'text',
    });
    expect(db.store.get('chatMessages').size).toBe(1);
  });

  it('places ticket buyers into a new event room after 250 active members', async () => {
    const chatMembers = {};
    for (let i = 1; i <= 250; i += 1) {
      chatMembers[`event_event_1_user_${i}`] = {
        chatId: 'event_event_1',
        eventId: 'event_1',
        userId: `user_${i}`,
        status: 'active',
        type: 'event',
      };
    }

    const db = createDb({
      events: {
        event_1: {
          title: 'Neon District',
          image: 'cover.jpg',
          startDate: '2099-01-01T20:00:00.000Z',
        },
      },
      chats: {
        event_event_1: {
          id: 'event_event_1',
          type: 'event',
          eventId: 'event_1',
          title: 'Neon District',
          eventTitle: 'Neon District',
          roomNumber: 1,
          roomCapacity: 250,
        },
      },
      chatMembers,
      users: {
        user_251: { displayName: 'Room Two Buyer' },
      },
    });

    const result = await ensureEventChatMembership(db, {
      eventId: 'event_1',
      userId: 'user_251',
      source: 'ticket',
    });

    expect(result.chat).toMatchObject({
      id: 'event_event_1_room_2',
      title: 'Neon District - Room 2',
      roomNumber: 2,
      roomMemberCount: 1,
    });
    expect(result.member).toMatchObject({
      chatId: 'event_event_1_room_2',
      roomNumber: 2,
      userId: 'user_251',
    });
  });

  it('hides reported messages from the reporter and globally hides at three reports', async () => {
    const db = createDb({
      chats: {
        event_event_1: {
          id: 'event_event_1',
          type: 'event',
          eventId: 'event_1',
          title: 'Neon District',
        },
      },
      chatMembers: {
        event_event_1_user_1: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_1',
          status: 'active',
          type: 'event',
        },
        event_event_1_user_2: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_2',
          status: 'active',
          type: 'event',
        },
        event_event_1_user_3: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_3',
          status: 'active',
          type: 'event',
        },
        event_event_1_user_4: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_4',
          status: 'active',
          type: 'event',
        },
      },
      users: {
        user_1: { displayName: 'Aayush' },
      },
      chatMessages: {
        msg_1: {
          id: 'msg_1',
          chatId: 'event_event_1',
          eventId: 'event_1',
          senderId: 'user_1',
          senderName: 'Aayush',
          content: 'Bad message',
          imageUrl: 'https://example.com/photo.jpg',
          type: 'image',
          createdAt: '2099-01-01T00:01:00.000Z',
        },
      },
    });

    const report = await reportChatMessage(db, 'user_2', 'event_event_1', 'msg_1', {
      reason: 'unsafe',
    });
    const duplicateReport = await reportChatMessage(db, 'user_2', 'event_event_1', 'msg_1', {
      reason: 'unsafe',
    });
    const reporterPage = await getChatMessages(db, 'user_2', 'event_event_1', { limit: 50 });
    const senderPage = await getChatMessages(db, 'user_1', 'event_event_1', { limit: 50 });

    expect(report.report).toMatchObject({ messageId: 'msg_1', status: 'pending', reportCount: 1 });
    expect(duplicateReport.report).toMatchObject({
      messageId: 'msg_1',
      status: 'already_reported',
      reportCount: 1,
    });
    expect(reporterPage.messages).toHaveLength(0);
    expect(senderPage.messages[0]).toMatchObject({
      id: 'msg_1',
      content: 'Bad message',
      imageUrl: 'https://example.com/photo.jpg',
      type: 'image',
      isReported: true,
      isHidden: false,
      reportCount: 1,
    });

    await reportChatMessage(db, 'user_3', 'event_event_1', 'msg_1', { reason: 'unsafe' });
    const thirdReport = await reportChatMessage(db, 'user_4', 'event_event_1', 'msg_1', {
      reason: 'unsafe',
    });
    const hiddenPage = await getChatMessages(db, 'user_1', 'event_event_1', { limit: 50 });

    expect(thirdReport.moderation).toMatchObject({
      reportCount: 3,
      hidden: true,
      strikeApplied: true,
      chatStrikes: 1,
      chatBanned: false,
    });
    expect(hiddenPage.messages).toHaveLength(0);
    expect(db.store.get('chatMessages').get('msg_1')).toMatchObject({
      isHidden: true,
      reportCount: 3,
      reportedBy: ['user_2', 'user_3', 'user_4'],
    });
    expect(db.store.get('users').get('user_1').chatStrikes).toBe(1);
    expect(db.store.get('users').get('user_1').isChatBanned).toBeUndefined();
  });

  it('bans senders after their third chat strike', async () => {
    const db = createDb({
      chats: {
        event_event_1: {
          id: 'event_event_1',
          type: 'event',
          eventId: 'event_1',
          title: 'Neon District',
        },
      },
      chatMembers: {
        event_event_1_user_1: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_1',
          status: 'active',
          type: 'event',
        },
        event_event_1_user_2: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_2',
          status: 'active',
          type: 'event',
        },
        event_event_1_user_3: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_3',
          status: 'active',
          type: 'event',
        },
        event_event_1_user_4: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'user_4',
          status: 'active',
          type: 'event',
        },
      },
      users: {
        user_1: { displayName: 'Aayush', chatStrikes: 2 },
      },
      chatMessages: {
        msg_1: {
          id: 'msg_1',
          chatId: 'event_event_1',
          eventId: 'event_1',
          senderId: 'user_1',
          senderName: 'Aayush',
          content: 'Another bad message',
          type: 'text',
          createdAt: '2099-01-01T00:01:00.000Z',
        },
      },
    });

    await reportChatMessage(db, 'user_2', 'event_event_1', 'msg_1', { reason: 'unsafe' });
    await reportChatMessage(db, 'user_3', 'event_event_1', 'msg_1', { reason: 'unsafe' });
    await reportChatMessage(db, 'user_4', 'event_event_1', 'msg_1', { reason: 'unsafe' });

    expect(db.store.get('users').get('user_1')).toMatchObject({
      chatStrikes: 3,
      isChatBanned: true,
    });
    await expect(
      sendChatMessage(db, 'user_1', 'event_event_1', { text: 'Can I send?' }),
    ).rejects.toThrow('Chat banned');
  });

  it('returns full attendees for premium users and teaser attendees for free users', async () => {
    const db = createDb({
      events: {
        event_1: {
          title: 'Neon District',
          startDate: '2099-01-01T20:00:00.000Z',
        },
      },
      chatMembers: {
        event_event_1_attendee_1: {
          chatId: 'event_event_1',
          eventId: 'event_1',
          userId: 'attendee_1',
          displayName: 'Riya Kapoor',
          photoURL: 'riya.jpg',
          status: 'active',
          type: 'event',
        },
      },
      users: {
        viewer_free: { displayName: 'Free Viewer', isPremium: false },
        viewer_premium: { displayName: 'Premium Viewer', isPremium: true },
        attendee_1: { displayName: 'Riya Kapoor', photoURL: 'riya.jpg' },
      },
    });

    const freeResult = await getEventAttendees(db, 'event_1', 'viewer_free');
    const premiumResult = await getEventAttendees(db, 'event_1', 'viewer_premium');

    expect(freeResult).toMatchObject({
      access: 'tease',
      isPremium: false,
      attendees: [
        {
          userId: 'attendee_1',
          name: 'Riya',
          avatar: null,
          isBlurred: true,
        },
      ],
    });
    expect(premiumResult).toMatchObject({
      access: 'full',
      isPremium: true,
      attendees: [
        {
          userId: 'attendee_1',
          name: 'Riya Kapoor',
          avatar: 'riya.jpg',
          isBlurred: false,
        },
      ],
    });
  });
});
