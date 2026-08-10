import React from 'react';
import { useTheme } from '../hooks/useTheme';

const TABS = [
  { id: 'overview',   label: 'Overview',         icon: ShieldIco },
  { id: 'deploy',     label: '1-Click Deploy',   icon: CloudIco  },
  { id: 'telemetry', label: 'Live Telemetry',    icon: PulseIco  },
  { id: 'tools',     label: 'Advanced Tools',    icon: WrenchIco },
];

export default function TopBar({ activeTab, setTab, wsStatus }) {
  const { dark, toggle } = useTheme();
  const wsColor = wsStatus === 'live' ? 'var(--sage)' : wsStatus === 'connecting' ? 'var(--amber)' : 'var(--ember)';

  return (
    <header className="topbar drag-region">
      {/* Brand mark */}
      <div className="flex items-center gap-1.5 pr-3 no-drag" style={{ borderRight: '1px solid var(--border)', height: '100%', flexShrink: 0 }}>
        <ShieldIco size={12} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>AEGIS</span>
        <span className="badge badge-muted" style={{ fontSize: 8 }}>M-B</span>
      </div>

      {/* Tab ribbon */}
      <nav className="flex h-full no-drag">
        {TABS.map(t => {
          const Ic = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`topbar-tab ${activeTab === t.id ? 'active' : ''}`}>
              <Ic size={11} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2.5 no-drag" style={{ marginLeft: 'auto' }}>
        <div className="flex items-center gap-1">
          <span className="dot dot-blink" style={{ background: wsColor }} />
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            {wsStatus === 'live' ? 'Live' : wsStatus === 'connecting' ? 'Conn…' : 'Off'}
          </span>
        </div>
        <div className="divider-v" style={{ height: 14 }} />
        <div className="flex items-center gap-1.5 no-drag" style={{ cursor: 'pointer' }} onClick={toggle}>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{dark ? '☽' : '☀'}</span>
          <div className={`toggle-track ${dark ? 'on' : ''}`}><div className="toggle-thumb" /></div>
        </div>
      </div>
    </header>
  );
}

function ShieldIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function CloudIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
}
function PulseIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}
function WrenchIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}
