/**
 * Singleton WebSocket manager for the mobile app.
 * React Native has a built-in WebSocket global — no extra package needed.
 *
 * Usage: import { wsManager } from "@/lib/websocket";
 *        wsManager.subscribe("event:abc123", handler);
 */

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

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private token: string | null = null;
  private enabled = false;

  start(token?: string | null) {
    this.token = token ?? null;
    this.enabled = true;
    this.connect();
  }

  stop() {
    this.enabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, 'app_background');
    this.ws = null;
  }

  updateToken(token: string | null) {
    this.token = token;
  }

  subscribe(topic: string, handler: MessageHandler) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      // Subscribe on the wire if already connected
      if (this.ws?.readyState === WebSocket.OPEN) {
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

  private connect() {
    if (!this.enabled) return;

    const url = `${GATEWAY_URL}/ws/updates`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      // Authenticate via message instead of query param to avoid token leakage
      if (this.token) {
        ws.send(JSON.stringify({ type: 'AUTH', token: this.token }));
      }
      // Re-subscribe all active topics on reconnect
      for (const topic of this.subscriptions.keys()) {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', topic }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        if (msg.type === 'welcome') return;

        // Dispatch to topic-specific handlers.
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
          this.subscriptions.get(topic)?.forEach((h) => h(msg));
        });

        // Also dispatch to wildcard (empty topic = all messages)
        this.subscriptions.get('*')?.forEach((h) => h(msg));
      } catch {}
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.enabled) return;
      const delay = Math.min(1000 * 2 ** this.retries, 30_000);
      this.retries += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => ws.close();
  }
}

export const wsManager = new WebSocketManager();
