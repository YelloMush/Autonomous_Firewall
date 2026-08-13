import React from 'react';

const TABS = [
  { id: 'overview',  label: 'Overview',         icon: GridIco   },
  { id: 'deploy',    label: '1-Click Deploy',   icon: CloudIco  },
  { id: 'telemetry', label: 'Live Telemetry',   icon: PulseIco  },
  { id: 'tools',     label: 'Advanced Tools',   icon: WrenchIco },
];

export default function IconRail({ activeTab, setTab, onOpenPalette }) {
  return (
    <nav className="icon-rail">
      <div className="rail-brand">
        <ShieldIco size={19} />
      </div>
      <div className="rail-divider" />

      {TABS.map(t => {
        const Ic = t.icon;
        return (
          <button
            key={t.id}
            className={`rail-item ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
            aria-current={activeTab === t.id}
          >
            <Ic size={18} />
            <span className="rail-tooltip">{t.label}</span>
          </button>
        );
      })}

      <div className="rail-bottom">
        <div className="rail-divider" />
        <button className="rail-item" onClick={onOpenPalette} aria-label="Command palette">
          <SearchIco size={17} />
          <span className="rail-tooltip">Command Palette · ⌘K</span>
        </button>
      </div>
    </nav>
  );
}

function ShieldIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function GridIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function CloudIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>;
}
function PulseIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function WrenchIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;
}
function SearchIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}
