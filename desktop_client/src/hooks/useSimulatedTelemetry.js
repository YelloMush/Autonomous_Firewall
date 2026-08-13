import { useState, useEffect, useRef, useCallback } from 'react';

const HISTORY_MAX = 120;
const TICK_MS = 180;
const THRESHOLD = 300;

// Target profiles per phase. Flash crowds run hot (high packet volume) but stay
// high-entropy (diverse legitimate IPs), so score stays low — the whole point of
// the demo is that the AI tells the two apart instead of just reacting to volume.
const PROFILES = {
  nominal:    { pkt: 55,  entropy: 9.6,  score: 0.05, cb: false },
  flashCrowd: { pkt: 950, entropy: 11.4, score: 0.16, cb: false },
  botnet:     { pkt: 520, entropy: 1.8,  score: 0.83, cb: false },
  mitigating: { pkt: 25,  entropy: 1.6,  score: 0.95, cb: true  },
};

// How long to sit in a phase before auto-advancing (ms), keyed by phase name.
const HOLD_MS = { flashCrowd: 7000, botnet: 1500, mitigating: 8000 };
const NEXT_PHASE = { flashCrowd: 'nominal', botnet: 'mitigating', mitigating: 'nominal' };

const lerp = (a, b, t) => a + (b - a) * t;

export function useSimulatedTelemetry(active) {
  const [phase, setPhase] = useState('nominal');
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);

  const currentRef = useRef({ ...PROFILES.nominal });
  const phaseRef = useRef('nominal');
  const holdTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const pushAlert = useCallback((message) => {
    setAlerts(prev => [{ id: Date.now() + Math.random(), message, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  }, []);

  const advanceTo = useCallback((next) => {
    if (!mountedRef.current) return;
    phaseRef.current = next;
    setPhase(next);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    if (next === 'flashCrowd') pushAlert('Edge sensor: sustained surge detected — 950 req/s, entropy 11.4b (diverse)');
    if (next === 'botnet')     pushAlert('Edge sensor: volumetric anomaly — entropy collapsed to 1.8b (narrow IP cluster)');
    if (next === 'mitigating') {
      pushAlert('IsolationForest: anomaly score 0.83 — threshold 0.60 breached');
      pushAlert('boto3 → ec2.create_network_acl_entry · rule 32767 · DENY ALL · ingress+egress');
    }
    if (next === 'nominal' && (phaseRef.current !== 'nominal')) pushAlert('NACL rule cleared — traffic nominal, baseline restored');

    const holdMs = HOLD_MS[next];
    if (holdMs) {
      holdTimerRef.current = setTimeout(() => advanceTo(NEXT_PHASE[next]), holdMs);
    }
  }, [pushAlert]);

  const trigger = useCallback((name) => {
    if (!PROFILES[name]) return;
    advanceTo(name);
  }, [advanceTo]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
      return;
    }

    tickTimerRef.current = setInterval(() => {
      const target = PROFILES[phaseRef.current];
      const cur = currentRef.current;
      const wobble = () => (Math.random() - 0.5);

      cur.pkt     = lerp(cur.pkt,     target.pkt,     0.12) + wobble() * (target.pkt * 0.02);
      cur.entropy = lerp(cur.entropy, target.entropy, 0.12) + wobble() * 0.08;
      cur.score   = lerp(cur.score,   target.score,   0.15);
      cur.cb      = target.cb;

      const enriched = {
        packet_count: Math.max(0, Math.round(cur.pkt)),
        entropy: Math.max(0, cur.entropy),
        threshold: THRESHOLD,
        circuit_breaker_active: cur.cb,
        anomaly_score: Math.max(0, Math.min(0.99, cur.score)),
      };

      setMetrics(enriched);
      setHistory(prev => {
        const next = [...prev, { t: Date.now(), ...enriched }];
        return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
      });
    }, TICK_MS);

    return () => { if (tickTimerRef.current) clearInterval(tickTimerRef.current); };
  }, [active]);

  return { status: active ? 'live' : 'disconnected', metrics, alerts, history, phase, trigger };
}
