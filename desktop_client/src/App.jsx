import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider }  from './hooks/useTheme';
import { useTelemetry }   from './hooks/useTelemetry';
import SplashScreen       from './components/SplashScreen';
import IconRail           from './components/IconRail';
import CommandPalette     from './components/CommandPalette';
import StatusBar          from './components/StatusBar';
import OverviewTab        from './tabs/OverviewTab';
import DeployTab          from './tabs/DeployTab';
import TelemetryTab       from './tabs/TelemetryTab';
import ToolsTab           from './tabs/ToolsTab';

function AegisApp() {
  const [tab, setTab]               = useState('overview');
  const [splashDone, setSplashDone] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { status, metrics, alerts, history } = useTelemetry();

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const handleSetTab = useCallback((t) => {
    setTab(t);
    closePalette();
  }, [closePalette]);

  return (
    <div className="app-shell" style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

      {/* Splash screen — overlays everything until booted */}
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      {/* Main layout: icon rail + content */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
        <IconRail activeTab={tab} setTab={setTab} />

        {/* Tab content — key prop forces re-mount (triggers tab-in animation) */}
        <main style={{ flex:1, overflow:'hidden', minWidth:0 }} key={tab}>
          {tab === 'overview'  && <OverviewTab  metrics={metrics} alerts={alerts} />}
          {tab === 'deploy'    && <DeployTab />}
          {tab === 'telemetry' && <TelemetryTab metrics={metrics} history={history} alerts={alerts} />}
          {tab === 'tools'     && <ToolsTab />}
        </main>
      </div>

      {/* Pinned status bar */}
      <StatusBar wsStatus={status} metrics={metrics} />

      {/* Command Palette overlay (Cmd+K) */}
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        setTab={handleSetTab}
      />
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
