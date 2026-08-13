import React from 'react';
import { useTheme } from '../hooks/useTheme';
import AccountMenu from './AccountMenu';

export default function Header({ archMode, setArchMode, dataSource, setDataSource }) {
  const { dark, toggle } = useTheme();

  return (
    <header className="app-header">
      <div className="flex items-center gap-1.5 no-drag" style={{ flexShrink: 0 }}>
        <ShieldIco size={15} />
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          AEGIS
        </span>
      </div>

      <div className="divider-v" style={{ height: 16 }} />

      <div className="flex items-center gap-2 no-drag">
        <span style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Architecture</span>
        <div className="seg-control">
          <button
            className={`seg-btn ${archMode === 'A' ? 'active' : ''}`}
            onClick={() => setArchMode('A')}
            title="Managed Edge Proxy — CNAME onto our shared ingress"
          >
            Model A · Edge Proxy
          </button>
          <button
            className={`seg-btn ${archMode === 'B' ? 'active' : ''}`}
            onClick={() => setArchMode('B')}
            title="Private Cloud IaC — deploys into your own AWS VPC"
          >
            Model B · Private VPC
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 no-drag" style={{ marginLeft: 'auto' }}>
        <span style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Source</span>
        <div className="seg-control">
          <button
            className={`seg-btn ${dataSource === 'live' ? 'active' : ''}`}
            onClick={() => setDataSource('live')}
            title="Bind to the real FastAPI backend at ws://localhost:8000"
          >
            Live Backend
          </button>
          <button
            className={`seg-btn ${dataSource === 'sim' ? 'active' : ''}`}
            onClick={() => setDataSource('sim')}
            title="Self-contained demo loop — no backend required"
          >
            Presentation Sim
          </button>
        </div>
      </div>

      <div className="divider-v no-drag" style={{ height: 16 }} />

      <button
        className="no-drag"
        onClick={toggle}
        aria-label="Toggle theme"
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '3px 6px', borderRadius: 4, flexShrink: 0,
          fontSize: 13, lineHeight: 1, color: 'var(--text-muted)',
        }}
      >
        {dark ? '☽' : '☀'}
      </button>

      <AccountMenu onTierSync={setArchMode} />
    </header>
  );
}

function ShieldIco({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-faint)' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
