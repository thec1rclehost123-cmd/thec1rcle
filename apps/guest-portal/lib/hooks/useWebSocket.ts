'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const GATEWAY_WS_URL = (() => {
  const base =
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    process.env.GUEST_API_GATEWAY_URL ||
    'http://localhost:4000';
  return base.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'));
})();

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface UseWebSocketOptions {
  topics?: string[];
  getToken?: () => Promise<string | null>;
  onMessage?: (msg: WSMessage) => void;
  enabled?: boolean;
}

export function useWebSocket({
  topics = [],
  getToken,
  onMessage,
  enabled = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const [connected, setConnected] = useState(false);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const topicsRef = useRef(topics);
  topicsRef.current = topics;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const subscribeAll = useCallback((ws: WebSocket) => {
    for (const topic of topicsRef.current) {
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', topic }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled) return;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);

    const url = new URL(`${GATEWAY_WS_URL}/ws/updates`);
    if (getTokenRef.current) {
      try {
        const token = await getTokenRef.current();
        if (token) url.searchParams.set('token', token);
      } catch {}
    }

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
      subscribeAll(ws);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        if (msg.type === 'welcome') return;
        onMessageRef.current?.(msg);
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
      retriesRef.current += 1;

      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [enabled, subscribeAll]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close(1000, 'unmounted');
    };
  }, [connect]);

  useEffect(() => {
    if (!connected || !wsRef.current) return;
    subscribeAll(wsRef.current);
  }, [connected, topics.join(','), subscribeAll]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}
