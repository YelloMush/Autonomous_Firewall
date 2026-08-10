import React, { useState, useEffect, useRef } from 'react';

const isElectron = !!(window.aegis);

const TOOLS = [
  {
    id: 'flash',
    label: 'Flash Crowd Simulator',
    category: 'Stress Test',
    icon: '⚡',
    colour: '#6A9479',
    badgeClass: 'badge-sage',
    desc: 'Legitimate surge simulation. Diverse 50k IP pool → Shannon Entropy > 10 bits → AI classifies as benign traffic.',
    defaultWorkers: 8,
    defaultDuration: 20,
    defaultRps: 500,
  },
  {
    id: 'botnet',
    label: 'Botnet DDoS Simulator',
    category: 'Attack Vector',
    icon: '☠',
    colour: '#B36A55',
    badgeClass: 'badge-ember',
    desc: 'Coordinated botnet simulation. Fixed 5-10 IP cluster → Entropy < 3 bits → IsolationForest triggers NACL block.',
    defaultWorkers: 8,
    defaultDuration: 20,
    defaultRps: 800,
  },
];

export default function ToolsTab() {
  const [selected, setSelected] = useState('flash');
  const [running, setRunning]   = useState(false);
  const [workers, setWorkers]   = useState(8);
  const [duration, setDuration] = useState(20);
  const [rps, setRps]           = useState(500);
  const [lines, setLines]       = useState([]);
  const termRef   = useRef(null);
  const unsubRef  = useRef(null);

  const tool = TOOLS.find(t => t.id === selected);

  useEffect(() => {
    // Update defaults when tool changes
    if (tool) { setWorkers(tool.defaultWorkers); setDuration(tool.defaultDuration); setRps(tool.defaultRps); }
  }, [selected]);

  // Subscribe to tester IPC stream
  useEffect(() => {
    if (!isElectron) return;
    unsubRef.current = window.aegis.onTesterLine(({ stream, line }) => {
      setLines(prev => {
        const entry = { id: Date.now() + Math.random(), stream, text: line };
        const next = [...prev, entry];
        return next.length > 600 ? next.slice(-600) : next;
      });
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const launch = async () => {
    if (!isElectron) {
      setLines(prev => [...prev, { id: Date.now(), stream: 'system', text: '[ERROR] Not running in Electron — IPC unavailable.\n' }]);
      return;
    }
    setLines([{ id: Date.now(), stream: 'system', text: `[ Launching ${tool.label} — ${workers} workers × ${duration}s @ ${rps} RPS ]\n` }]);
    setRunning(true);
    try {
      const result = await window.aegis.runTester(selected, duration, workers);
      if (!result.ok) throw new Error('Tester spawn failed');
    } catch (e) {
      setLines(prev => [...prev, { id: Date.now(), stream: 'stderr', text: `[ERROR] ${e.message}\n` }]);
      setRunning(false);
    }
  };

  const stop = async () => {
    if (!isElectron) return;
    await window.aegis.killTester();
    setLines(prev => [...prev, { id: Date.now(), stream: 'system', text: '[ Test terminated by user ]\n' }]);
    setRunning(false);
  };

  const lineColor = (stream) => {
    if (stream === 'stderr') return 'var(--ember)';
    if (stream === 'system') return 'var(--text-muted)';
    return 'var(--text-primary)';
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100%', overflow: 'hidden' }}>

      {/* ── Left: Tool Selector ────────────────────────────────────── */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div className="section-label" style={{ margin: 0 }}>Test Suite</div>
        </div>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => { setSelected(t.id); setLines([]); }}
            style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '10px 12px',
              textAlign: 'left', cursor: 'pointer',
              background: selected === t.id ? 'var(--bg-subtle)' : 'transparent',
              borderLeft: `3px solid ${selected === t.id ? t.colour : 'transparent'}`,
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.12s',
              border: 'none',
              borderLeft: `3px solid ${selected === t.id ? t.colour : 'transparent'}`,
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
            </div>
            <span className={`badge ${t.badgeClass}`} style={{ alignSelf: 'flex-start' }}>{t.category}</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.4, marginTop: 2 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Right: Controls + Terminal ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        {/* Controls bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label className="form-label">Duration (s)</label>
            <input type="number" className="form-input" style={{ width: 80 }} min={5} max={120} value={duration} onChange={e => setDuration(+e.target.value)} disabled={running} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label className="form-label">Workers</label>
            <input type="number" className="form-input" style={{ width: 70 }} min={1} max={32} value={workers} onChange={e => setWorkers(+e.target.value)} disabled={running} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label className="form-label">Target RPS</label>
            <input type="number" className="form-input" style={{ width: 80 }} min={10} max={5000} value={rps} onChange={e => setRps(+e.target.value)} disabled={running} />
          </div>

          <div style={{ marginLeft: 8, display: 'flex', gap: 8 }}>
            {running ? (
              <button className="btn btn-danger" onClick={stop}>⏹  Stop</button>
            ) : (
              <button className="btn" style={{ background: tool.colour, color: '#fff' }} onClick={launch}>
                {tool.icon} Launch {tool.label}
              </button>
            )}
            <button className="btn btn-outline" onClick={() => setLines([])} disabled={running}>Clear</button>
          </div>

          {running && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <span className="dot dot-blink" style={{ background: tool.colour }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Running {tool.label}…</span>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
          <div style={{ paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>Live Execution Terminal</div>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)' }}>stdout/stderr ← real_world_tester.py</span>
          </div>
          <div
            ref={termRef}
            className="terminal"
            style={{ flex: 1 }}
          >
            {lines.length === 0 ? (
              <span style={{ color: 'var(--text-faint)' }}>Select a tool and click Launch to begin.\nOutput from real_world_tester.py will stream here.</span>
            ) : (
              lines.map(l => (
                <span key={l.id} style={{ color: lineColor(l.stream) }}>{l.text}</span>
              ))
            )}
            {running && <span style={{ color: tool.colour }}>▌</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
