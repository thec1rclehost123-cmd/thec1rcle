import { useEffect, useRef, useState, useCallback } from "react";

import { wsManager, type WSMessage } from "@/lib/websocket";

interface UseWebSocketOptions {
    /** Topic to subscribe to, e.g. "event:abc123". Use "*" for all messages. */
    topic: string;
    /** Called whenever a message arrives for this topic. */
    onMessage: (msg: WSMessage) => void;
    /** Set false to pause this subscription without tearing down the shared connection. */
    enabled?: boolean;
}

/**
 * Subscribes to one topic on the shared WebSocket manager.
 * The underlying connection is shared across all hook instances.
 */
export function useWebSocket({ topic, onMessage, enabled = true }: UseWebSocketOptions) {
    const [connected, setConnected] = useState(wsManager.isConnected);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const stableHandler = useCallback((msg: WSMessage) => {
        onMessageRef.current(msg);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        const unsub = wsManager.subscribe(topic, stableHandler);
        return unsub;
    }, [topic, enabled, stableHandler]);

    // Reflect connection state changes
    useEffect(() => {
        const interval = setInterval(() => {
            setConnected(wsManager.isConnected);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return { connected };
}
