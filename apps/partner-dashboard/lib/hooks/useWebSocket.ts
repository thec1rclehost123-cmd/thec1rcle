'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const GATEWAY_WS_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(
  /^https?/,
  (m) => (m === 'https' ? 'wss' : 'ws'),
);

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface UseWebSocketOptions {
  /** Topics to subscribe to on connect, e.g. ["event:abc", "workspace:xyz"] */
  topics?: string[];
  /** Optional async function that returns a Firebase ID token for auth. */
  getToken?: () => Promise<string | null>;
  /** Called for every non-welcome message received. */
  onMessage?: (msg: WSMessage) => void;
  /** Set false to skip connecting (e.g. while eventId is not yet known). */
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

  // Keep latest callbacks stable so reconnect doesn't need to be in deps
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
      // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
      retriesRef.current += 1;
      // eslint-disable-next-line react-hooks/immutability
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [enabled, subscribeAll]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close(1000, 'unmounted');
    };
  }, [connect]);

  // Re-subscribe when topics change while already connected
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
