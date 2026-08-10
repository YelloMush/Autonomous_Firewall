import React, { useState, useEffect } from 'react';

export default function StatusBar({ wsStatus }) {
  const [backendStatus, setBackendStatus] = useState(null);
  const isElectron = !!(window.aegis);

  useEffect(() => {
    if (!isElectron) return;
    const poll = async () => {
      try { setBackendStatus(await window.aegis.getBackendStatus()); } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [isElectron]);

  const wsColour = wsStatus === 'live' ? '#6A9479' : wsStatus === 'connecting' ? '#b45309' : '#B36A55';
  const wsLabel  = wsStatus === 'live' ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Disconnected';

  return (
    <div className="h-10 bg-white border-b border-stone-200 flex items-center justify-between px-6 flex-shrink-0 drag-region select-none">
      {/* Brand */}
      <div className="flex items-center gap-2.5 no-drag">
        <svg className="w-3.5 h-3.5 text-stone-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span className="text-xs font-semibold tracking-tight text-stone-900">Aegis Enterprise</span>
        <span className="text-xs text-stone-300 border border-stone-200 px-1.5 py-0.5 rounded-full ml-1">Model B</span>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-4 no-drag">
        {/* WebSocket */}
        <div className="flex items-center gap-1.5">
          <span className="dot-blink" style={{ background: wsColour }} />
          <span className="text-xs text-stone-500">WS {wsLabel}</span>
        </div>
        {/* Python backend (only in Electron) */}
        {isElectron && backendStatus && (
          <div className="flex items-center gap-1.5">
            <span className="dot-blink"
              style={{ background: backendStatus.running ? '#6A9479' : '#B36A55', animationPlayState: backendStatus.running ? 'running' : 'paused' }} />
            <span className="text-xs text-stone-500">
              FastAPI {backendStatus.running ? `pid:${backendStatus.pid}` : 'offline'}
            </span>
          </div>
        )}
        {/* Time */}
        <ClockTick />
      </div>
    </div>
  );
}

function ClockTick() {
  const [t, setT] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-stone-400">{t}</span>;
}
