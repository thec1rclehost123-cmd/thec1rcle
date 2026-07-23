type MessageHandler = (msg: WSMessage) => void;

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

const GATEWAY_URL = (
  process.env.EXPO_PUBLIC_GATEWAY_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/^https?/, (m: string) => (m === 'https' ? 'wss' : 'ws'));

interface WebSocketManagerConfig {
  onAuthFailure?: () => void;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private token: string | null = null;
  private enabled = false;
  private authFailureCallback: (() => void) | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;

  constructor(config?: WebSocketManagerConfig) {
    this.authFailureCallback = config?.onAuthFailure ?? null;
  }

  setConfig(config: WebSocketManagerConfig) {
    this.authFailureCallback = config.onAuthFailure ?? null;
  }

  start(token?: string | null) {
    if (this.ws) {
      this.ws.close(1000, 'restarting');
      this.ws = null;
    }
    this.token = token ?? null;
    this.enabled = true;
    this.retries = 0;
    this.connect();
  }

  stop() {
    this.enabled = false;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.reconnectTimer = null;
    this.connectTimeout = null;
    this.ws?.close(1000, 'app_background');
    this.ws = null;
    this.authenticated = false;
    this.subscriptions.clear();
  }

  updateToken(token: string | null) {
    this.token = token;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'token_updated');
    }
  }

  subscribe(topic: string, handler: MessageHandler) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
        this.ws.send(JSON.stringify({ type: 'SUBSCRIBE', topic }));
      }
    }
    this.subscriptions.get(topic)!.add(handler);
    return () => this.unsubscribe(topic, handler);
  }

  unsubscribe(topic: string, handler: MessageHandler) {
    const handlers = this.subscriptions.get(topic);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.subscriptions.delete(topic);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'UNSUBSCRIBE', topic }));
      }
    }
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onAppForeground() {
    if (this.enabled && !this.isConnected && !this.reconnectTimer) {
      if (__DEV__) console.log('[WS] App foregrounded, reconnecting...');
      this.retries = 0;
      this.connect();
    }
  }

  private connect() {
    if (!this.enabled) return;

    const url = `${GATEWAY_URL}/ws/updates`;

    const ws = new WebSocket(url);
    this.ws = ws;
    this.authenticated = false;

    this.connectTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close(4000, 'connect_timeout');
      }
    }, 10_000);

    ws.onopen = () => {
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
      this.retries = 0;
      this.startPing();
      if (this.token) {
        ws.send(JSON.stringify({ type: 'AUTH', token: this.token }));
      }
    };

    ws.onmessage = (event) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(event.data as string) as WSMessage;
      } catch {
        return;
      }
      if (msg.type === 'welcome') return;
      if (msg.type === 'AUTH_SUCCESS') {
        this.authenticated = true;
        for (const topic of this.subscriptions.keys()) {
          ws.send(JSON.stringify({ type: 'SUBSCRIBE', topic }));
        }
        return;
      }
      if (msg.type === 'SUBSCRIBE_DENIED') {
        if (__DEV__) console.warn('[WS] Subscription denied', msg.payload?.topic);
        return;
      }

      const topics = new Set<string>();
      if (typeof msg.payload?.eventId === 'string') {
        topics.add(`event:${msg.payload.eventId}`);
      }
      if (typeof msg.payload?.conversationId === 'string') {
        topics.add(`dm:${msg.payload.conversationId}`);
      }
      if (typeof msg.payload?.topic === 'string') {
        topics.add(msg.payload.topic);
      }
      topics.forEach((topic) => {
        this.subscriptions.get(topic)?.forEach((h) => {
          try {
            h(msg);
          } catch {}
        });
      });

      this.subscriptions.get('*')?.forEach((h) => {
        try {
          h(msg);
        } catch {}
      });
    };

    ws.onclose = (event) => {
      this.stopPing();
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
      this.ws = null;
      this.authenticated = false;
      if (!this.enabled) return;
      if (event.code === 4001 || event.code === 4003) {
        this.authFailureCallback?.();
        return;
      }
      const baseDelay = Math.min(1000 * 2 ** this.retries, 30_000);
      const delay = baseDelay * (0.5 + Math.random() * 0.5);
      this.retries += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => ws.close();
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const wsManager = new WebSocketManager();
