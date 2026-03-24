import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WSEvent } from '@/types/Migration';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/migration`;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const POLL_INTERVAL = 5000;

export function useMigrationEvents(engagementId: string | null, token?: string) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();
  const [useFallback, setUseFallback] = useState(false);

  const invalidateQueries = useCallback(
    (event: WSEvent) => {
      // Invalidate relevant queries based on event type
      switch (event.type) {
        case 'batch_started':
        case 'batch_completed':
        case 'batch_failed':
        case 'batch_halted':
          queryClient.invalidateQueries({ queryKey: ['migration', 'engagement'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
          break;
        case 'reconciliation_complete':
        case 'reconciliation_completed':
          queryClient.invalidateQueries({ queryKey: ['migration', 'reconciliation'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'recon-summary'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'p1-issues'] });
          break;
        case 'risk_detected':
        case 'risk_resolved':
        case 'risk_created':
        case 'risk_updated':
          queryClient.invalidateQueries({ queryKey: ['migration', 'risks'] });
          break;
        case 'engagement_status_changed':
        case 'phase_changed':
          queryClient.invalidateQueries({ queryKey: ['migration', 'engagement'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'engagements'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'gate-status'] });
          queryClient.invalidateQueries({ queryKey: ['migration', 'gate-history'] });
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

  // WebSocket connection
  useEffect(() => {
    if (!engagementId || useFallback) return;

    const connect = () => {
      const url = token
        ? `${WS_BASE}/${engagementId}?token=${encodeURIComponent(token)}`
        : `${WS_BASE}/${engagementId}`;
      const ws = new WebSocket(url);
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
    };
  }, [engagementId, useFallback, handleMessage, token]);

  // Polling fallback
  useEffect(() => {
    if (!engagementId || !useFallback) return;

    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'events', engagementId] });
    }, POLL_INTERVAL);

    return () => clearInterval(poll);
  }, [engagementId, useFallback, queryClient]);

  return { connected, events, lastEvent, useFallback };
}
