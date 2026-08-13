import React, { useState, useEffect } from 'react';
import TickNumber from './TickNumber';

const isElectron = !!(window.aegis);

export default function StatusBar({ wsStatus, metrics }) {
  const [pid, setPid] = useState(null);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    const poll = async () => {
      try { const s = await window.aegis.getBackendStatus(); setPid(s.running ? s.pid : null); } catch (_) {}
    };
    poll(); const id = setInterval(poll, 6000); return () => clearInterval(id);
  }, []);

  const score    = metrics?.anomaly_score ?? 0;
  const cbActive = metrics?.circuit_breaker_active ?? false;
  const hColor   = cbActive || score >= 0.7 ? 'var(--ember)' : score >= 0.4 ? 'var(--amber)' : 'var(--sage)';
  const hLabel   = cbActive ? 'NACL ACTIVE' : score >= 0.7 ? 'THREAT' : score >= 0.4 ? 'ELEVATED' : 'Nominal';

  return (
    <footer className="statusbar">
      <span className="dot" style={{ background: hColor }} />
      <span>Net: <b style={{ color: hColor }}>{hLabel}</b></span>
      <div className="statusbar-sep" />
      <span>WS: {wsStatus}</span>
      {isElectron && <><div className="statusbar-sep" /><span>API: {pid ? `pid ${pid}` : 'off'}</span></>}
      <div className="statusbar-sep" />
      {/* Anomaly bar */}
      <span>Anomaly:</span>
      <div style={{ width: 60, height: 3, background: 'var(--border)', borderRadius: 1.5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, score * 100).toFixed(0)}%`, background: hColor, transition: 'width 0.5s', borderRadius: 1.5 }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}><TickNumber value={score * 100} duration={350} />%</span>
      {metrics && <><div className="statusbar-sep" /><span style={{ fontFamily: 'JetBrains Mono' }}>H={parseFloat(metrics.entropy ?? 0).toFixed(2)}b</span></>}
      <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono' }}>{clock}</span>
    </footer>
  );
}
