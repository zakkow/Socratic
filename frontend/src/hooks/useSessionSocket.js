/**
 * useSessionSocket.js
 *
 * Custom hook for real-time WebSocket connection to a study session.
 * Handles auto-reconnect with exponential backoff, graceful fallback,
 * and an `init` event to synchronize state on connect.
 *
 * Usage:
 *   const { send, lastEvent, isConnected } = useSessionSocket(sessionId, userId, {
 *     onInit: ({ scratchpad, canvas, messages }) => { ... },
 *     onChat: (msg) => { ... },
 *     onScratchpad: ({ content }) => { ... },
 *     onCanvas: ({ content }) => { ... },
 *   });
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE = `ws://${window.location.hostname}:${window.location.port === '5173' ? '5173' : '8000'}`;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export function useSessionSocket(sessionId, userId, handlers = {}) {
  const wsRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);

  // Keep handlers ref current without reconnecting
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (!sessionId || !mountedRef.current) return;

    const url = `${WS_BASE}/ws/session/${sessionId}?user_id=${encodeURIComponent(userId || '')}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        retryCountRef.current = 0;
        setIsConnected(true);
        // Heartbeat ping every 25s to keep connection alive
        ws._pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const event = JSON.parse(e.data);
          const h = handlersRef.current;
          switch (event.type) {
            case 'init':    h.onInit?.(event.payload);       break;
            case 'chat':    h.onChat?.(event.payload);       break;
            case 'scratchpad': h.onScratchpad?.(event.payload); break;
            case 'canvas':  h.onCanvas?.(event.payload);    break;
            case 'pong':    break; // heartbeat ack
            default: break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (e) => {
        clearInterval(ws._pingInterval);
        if (!mountedRef.current) return;
        setIsConnected(false);

        // Don't retry on intentional close (code 1000) or max retries exceeded
        if (e.code === 1000 || retryCountRef.current >= MAX_RETRIES) return;

        const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // Error will trigger onclose which handles retry
      };
    } catch {
      // WebSocket not available — silently degrade to polling
    }
  }, [sessionId, userId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'component unmounted');
      }
    };
  }, [connect]);

  const send = useCallback((event) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      return true;
    }
    return false; // caller should fall back to HTTP
  }, []);

  return { send, isConnected };
}
