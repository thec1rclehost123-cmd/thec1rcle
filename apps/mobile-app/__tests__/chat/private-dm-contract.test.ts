const mockApiFetch = jest.fn();

jest.mock('../../lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
}));

jest.mock('../../lib/websocket', () => ({
  wsManager: {
    isConnected: false,
    subscribe: jest.fn(() => jest.fn()),
  },
}));

import { AppState } from 'react-native';
import { wsManager } from '../../lib/websocket';
import { sendDirectMessage, subscribeToDirectMessages } from '../../lib/social/privateDM';

describe('private DM API contract', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    (wsManager.subscribe as jest.Mock).mockClear();
    Object.defineProperty(wsManager, 'isConnected', {
      configurable: true,
      writable: true,
      value: false,
    });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
  });

  it('sends text using the gateway field name', async () => {
    mockApiFetch.mockResolvedValue({ success: true, messageId: 'message_1' });

    await expect(
      sendDirectMessage('conversation_1', 'sender_1', 'See you inside', 'message_0'),
    ).resolves.toMatchObject({ success: true, messageId: 'message_1' });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/dm/conversation_1/send', {
      method: 'POST',
      body: JSON.stringify({ text: 'See you inside', replyToId: 'message_0' }),
      requireAuth: true,
    });
  });

  it('hydrates REST history once even when the websocket is already connected', async () => {
    Object.defineProperty(wsManager, 'isConnected', {
      configurable: true,
      writable: true,
      value: true,
    });
    mockApiFetch.mockResolvedValue({
      messages: [
        {
          id: 'message_1',
          conversationId: 'conversation_1',
          senderId: 'sender_2',
          content: 'Earlier message',
          createdAt: '2026-07-17T10:00:00.000Z',
        },
      ],
    });
    const onMessages = jest.fn();

    const unsubscribe = subscribeToDirectMessages('conversation_1', onMessages);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/v1/social/dm/conversation_1/messages?limit=50',
      { requireAuth: true },
    );
    expect(wsManager.subscribe).toHaveBeenCalledWith('dm:conversation_1', expect.any(Function));
    expect(onMessages).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'message_1', content: 'Earlier message' }),
    ]);

    unsubscribe();
  });

  it('does not lose initial history when the app state is not active yet', async () => {
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(wsManager, 'isConnected', {
      configurable: true,
      writable: true,
      value: true,
    });
    mockApiFetch.mockResolvedValue({ messages: [] });

    const unsubscribe = subscribeToDirectMessages('conversation_cold_start', jest.fn());
    await Promise.resolve();
    await Promise.resolve();

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/v1/social/dm/conversation_cold_start/messages?limit=50',
      { requireAuth: true },
    );

    unsubscribe();
  });
});
