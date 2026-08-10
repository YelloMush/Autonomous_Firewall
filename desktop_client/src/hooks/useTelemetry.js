import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws/live';
const RECONNECT_MS = 3000;
const HISTORY_MAX = 120; // 2 minutes at 1-sample/sec

export function useTelemetry() {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'live' | 'disconnected'
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]); // [{t, packet_count, entropy, anomaly_score}]
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} }

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('live');
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'ping') return;

        if (msg.type === 'metrics') {
          // Compute normalised anomaly score [0, 1]
          const pkt = msg.packet_count ?? 0;
          const thr = msg.threshold ?? 1;
          let score;
          if (msg.circuit_breaker_active) {
            score = 1.0;
          } else if (thr > 0) {
            score = Math.min(0.98, pkt / (thr * 2));
          } else {
            score = 0.0;
          }
          const enriched = { ...msg, anomaly_score: score };
          setMetrics(enriched);
          setHistory(prev => {
            const next = [...prev, { t: Date.now(), ...enriched }];
            return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
          });
        }

        if (msg.type === 'alert') {
          const entry = { id: Date.now(), message: msg.message, ts: new Date().toLocaleTimeString() };
          setAlerts(prev => [entry, ...prev].slice(0, 50));
        }
      } catch (_) {}
    };

    ws.onerror = () => { if (!mountedRef.current) return; setStatus('disconnected'); };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      // Attempt reconnect
      timerRef.current = setTimeout(connect, RECONNECT_MS);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} }
    };
  }, [connect]);

  return { status, metrics, alerts, history };
}
