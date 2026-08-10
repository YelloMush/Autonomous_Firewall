import React, { useState } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import StatusBar from './components/StatusBar';
import TelemetryDashboard from './components/TelemetryDashboard';
import LoadTesterPanel from './components/LoadTesterPanel';
import SystemLog from './components/SystemLog';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',    icon: DashIco },
  { id: 'tester',   label: 'Load Tester',   icon: TestIco },
  { id: 'log',      label: 'Event Log',     icon: LogIco  },
];

export default function App() {
  const [view, setView] = useState('dashboard');
  const { status, metrics, alerts, history } = useTelemetry();

  return (
    <div className="flex flex-col h-screen bg-stone-50 font-sans">
      {/* Top status bar */}
      <StatusBar wsStatus={status} />

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 bg-white border-r border-stone-200 flex flex-col py-6">
          <div className="px-5 mb-6">
            <div className="text-xs uppercase tracking-widest text-stone-400">Navigation</div>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV.map(n => {
              const Ic = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex items-center gap-2.5 text-sm px-3 py-2 rounded-sm transition-colors text-left w-full ${
                    active
                      ? 'bg-stone-100 text-stone-900 font-medium'
                      : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <Ic active={active} />
                  {n.label}
                </button>
              );
            })}
          </nav>

          {/* Bottom: Live status dot */}
          <div className="mt-auto px-5">
            <div className="border-t border-stone-100 pt-4">
              <div className="flex items-center gap-2">
                <span className="dot-blink" style={{ background: status === 'live' ? '#6A9479' : '#B36A55' }} />
                <span className="text-xs text-stone-400">
                  {status === 'live' ? 'Telemetry live' : 'Reconnecting…'}
                </span>
              </div>
              {metrics && (
                <div className="font-mono text-xs text-stone-300 mt-1.5">
                  {metrics.packet_count ?? 0} pkts · H={parseFloat(metrics.entropy ?? 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {view === 'dashboard' && (
            <TelemetryDashboard metrics={metrics} history={history} alerts={alerts} />
          )}
          {view === 'tester' && <LoadTesterPanel />}
          {view === 'log'     && <SystemLog alerts={alerts} metrics={metrics} />}
        </main>
      </div>
    </div>
  );
}

// ── Icon Components ──────────────────────────────────────────────────────────
function DashIco({ active }) {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function TestIco() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function LogIco() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
