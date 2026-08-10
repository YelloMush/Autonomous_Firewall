import React, { useState, useEffect } from 'react';

const isElectron = !!(window.aegis);

export default function StatusBar({ wsStatus, metrics }) {
  const [backendPid, setBackendPid] = useState(null);
  const [clock, setClock] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    const poll = async () => {
      try {
        const s = await window.aegis.getBackendStatus();
        setBackendPid(s.running ? s.pid : null);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => clearInterval(id);
  }, []);

  const score = metrics?.anomaly_score ?? 0;
  const cbActive = metrics?.circuit_breaker_active ?? false;
  const healthLabel = cbActive ? 'NACL ACTIVE' : score >= 0.7 ? 'THREAT DETECTED' : score >= 0.4 ? 'ELEVATED' : 'Nominal';
  const healthColor = cbActive ? 'var(--ember)' : score >= 0.7 ? 'var(--ember)' : score >= 0.4 ? 'var(--amber)' : 'var(--sage)';

  return (
    <footer className="statusbar">
      {/* Network health */}
      <div className="flex items-center gap-1.5">
        <span className="dot" style={{ background: healthColor }} />
        <span>Network: <strong style={{ color: healthColor }}>{healthLabel}</strong></span>
      </div>

      <div className="statusbar-sep" />

      {/* WS */}
      <span>WS: {wsStatus}</span>

      <div className="statusbar-sep" />

      {/* FastAPI */}
      {isElectron && (
        <span>FastAPI: {backendPid ? `pid ${backendPid}` : 'offline'}</span>
      )}

      {isElectron && <div className="statusbar-sep" />}

      {/* Mini anomaly gauge */}
      <div className="flex items-center gap-1.5" style={{ flex: 1 }}>
        <span>Anomaly:</span>
        <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(score * 100).toFixed(0)}%`, background: healthColor, transition: 'width 0.5s', borderRadius: 2 }} />
        </div>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}>{(score * 100).toFixed(0)}%</span>
      </div>

      {/* Entropy */}
      {metrics && (
        <span style={{ fontFamily: 'JetBrains Mono' }}>H={parseFloat(metrics.entropy ?? 0).toFixed(2)} bits</span>
      )}

      <div className="statusbar-sep" />

      {/* Clock */}
      <span style={{ fontFamily: 'JetBrains Mono', marginLeft: 'auto' }}>{clock}</span>
    </footer>
  );
}
