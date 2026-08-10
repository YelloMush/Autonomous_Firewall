import React, { useState } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { useTelemetry } from './hooks/useTelemetry';
import TopBar    from './components/TopBar';
import StatusBar from './components/StatusBar';
import OverviewTab   from './tabs/OverviewTab';
import DeployTab     from './tabs/DeployTab';
import TelemetryTab  from './tabs/TelemetryTab';
import ToolsTab      from './tabs/ToolsTab';

function AegisApp() {
  const [tab, setTab] = useState('overview');
  const { status, metrics, alerts, history } = useTelemetry();

  return (
    <div
      className="app-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* ── Top navigation ribbon ───────────────────────────────────────── */}
      <TopBar activeTab={tab} setTab={setTab} wsStatus={status} />

      {/* ── Main content area ────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {tab === 'overview'   && <OverviewTab  metrics={metrics} alerts={alerts} />}
        {tab === 'deploy'     && <DeployTab />}
        {tab === 'telemetry'  && <TelemetryTab metrics={metrics} history={history} alerts={alerts} />}
        {tab === 'tools'      && <ToolsTab />}
      </main>

      {/* ── Persistent status bar ────────────────────────────────────────── */}
      <StatusBar wsStatus={status} metrics={metrics} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AegisApp />
    </ThemeProvider>
  );
}
