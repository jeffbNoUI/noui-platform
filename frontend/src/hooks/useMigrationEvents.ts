import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WSEvent } from '@/types/Migration';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/migration`;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const POLL_INTERVAL = 5000;
/** While in polling fallback, attempt a WebSocket reconnect every 30s. */
const FALLBACK_RETRY_INTERVAL = 30_000;

export function useMigrationEvents(engagementId: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const fallbackRetryTimer = useRef<ReturnType<typeof setInterval>>();
  const queryClient = useQueryClient();
  const [useFallback, setUseFallback] = useState(false);

  const invalidateQueries = useCallback(
    (event: WSEvent) => {
      // Invalidate relevant queries based on event type
      switch (event.type) {
        case 'batch_started':
        case 'batch_completed':
        case 'batch_halted':
          queryClient.invalidateQueries({ queryKey: ['migration', 'engagement'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
          break;
        case 'reconciliation_complete':
          queryClient.invalidateQueries({ queryKey: ['migration', 'reconciliation'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'recon-summary'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'p1-issues'] });
          break;
        case 'risk_detected':
        case 'risk_resolved':
          queryClient.invalidateQueries({ queryKey: ['migration', 'risks'] });
          break;
        case 'engagement_status_changed':
          queryClient.invalidateQueries({ queryKey: ['migration', 'engagement'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'engagements'] });
          break;
        case 'exception_cluster':
          queryClient.invalidateQueries({ queryKey: ['migration', 'clusters'] });
          break;
        case 'mapping_agreement_updated':
          queryClient.invalidateQueries({ queryKey: ['migration', 'mappings'] });
          break;
      }
    },
    [queryClient],
  );

  const handleMessage = useCallback(
    (event: WSEvent) => {
      setLastEvent(event);
      setEvents((prev) => [event, ...prev].slice(0, 100)); // keep last 100
      invalidateQueries(event);
    },
    [invalidateQueries],
  );

  // Attempt a single WebSocket connection. On success, clears fallback state
  // so the main effect takes over. On failure, silently returns to polling.
  const attemptReconnect = useCallback(() => {
    if (!engagementId || wsRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/${engagementId}`);

    ws.onopen = () => {
      // Successful reconnect — hand off to main effect
      ws.close();
      reconnectAttempts.current = 0;
      setUseFallback(false);
    };

    ws.onerror = () => {
      ws.close();
    };

    // Timeout: if the socket hasn't opened in 5s, abandon the probe
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
      }
    }, 5000);

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  }, [engagementId]);

  // WebSocket connection
  useEffect(() => {
    if (!engagementId || useFallback) return;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/${engagementId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const event: WSEvent = JSON.parse(e.data);
          handleMessage(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        } else {
          // Switch to polling fallback
          setUseFallback(true);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [engagementId, useFallback, handleMessage]);

  // Polling fallback with periodic WebSocket reconnect probes
  useEffect(() => {
    if (!engagementId || !useFallback) return;

    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'events', engagementId] });
    }, POLL_INTERVAL);

    // Periodically probe whether WebSocket is available again
    fallbackRetryTimer.current = setInterval(attemptReconnect, FALLBACK_RETRY_INTERVAL);

    return () => {
      clearInterval(poll);
      clearInterval(fallbackRetryTimer.current);
    };
  }, [engagementId, useFallback, queryClient, attemptReconnect]);

  // Reconnect on tab visibility change (laptop wake, network restore)
  useEffect(() => {
    if (!engagementId) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      // In fallback mode — probe immediately instead of waiting for interval
      if (useFallback) {
        attemptReconnect();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [engagementId, useFallback, attemptReconnect]);

  return { connected, events, lastEvent, useFallback };
}
