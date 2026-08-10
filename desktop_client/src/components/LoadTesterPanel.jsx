import React, { useState, useEffect, useRef } from 'react';

const MODES = [
  {
    id: 'flash',
    label: 'Viral Launch — Flash Crowd',
    sub: 'High Entropy · 50,000 IP pool',
    description: 'Simulates a legitimate surge. Diverse source IPs → Shannon Entropy > 10 bits → AI classifies as benign.',
    colour: '#6A9479',
  },
  {
    id: 'botnet',
    label: 'Botnet DDoS Attack',
    sub: 'Low Entropy · 5–10 IP cluster',
    description: 'Simulates a coordinated botnet. Fixed IP cluster → Entropy < 3 bits → Isolation Forest triggers NACL block.',
    colour: '#B36A55',
  },
];

const isElectron = !!(window.aegis);

export default function LoadTesterPanel() {
  const [running, setRunning]   = useState(false);
  const [activeMode, setActive] = useState(null);
  const [duration, setDuration] = useState(20);
  const [workers,  setWorkers]  = useState(8);
  const [lines, setLines]       = useState([]);
  const termRef = useRef(null);
  const unsubRef = useRef(null);

  // Subscribe to tester output
  useEffect(() => {
    if (!isElectron) return;
    unsubRef.current = window.aegis.onTesterLine(({ stream, line }) => {
      setLines(prev => {
        const entry = { id: Date.now() + Math.random(), stream, text: line };
        const next = [...prev, entry];
        return next.length > 500 ? next.slice(-500) : next;
      });
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const launch = async (mode) => {
    if (!isElectron) {
      setLines(prev => [...prev, { id: Date.now(), stream: 'system', text: '[ERROR] Not running in Electron — IPC unavailable.\n' }]);
      return;
    }
    setLines([{ id: Date.now(), stream: 'system', text: `[ Launching ${mode} test — ${workers} workers × ${duration}s ]\n` }]);
    setRunning(true);
    setActive(mode);
    try {
      const result = await window.aegis.runTester(mode, duration, workers);
      if (!result.ok) throw new Error('Tester spawn failed');
    } catch (e) {
      setLines(prev => [...prev, { id: Date.now(), stream: 'stderr', text: `[ERROR] ${e.message}\n` }]);
      setRunning(false);
      setActive(null);
    }
  };

  const stop = async () => {
    if (!isElectron) return;
    await window.aegis.killTester();
    setLines(prev => [...prev, { id: Date.now(), stream: 'system', text: '[ Test terminated by user ]\n' }]);
    setRunning(false);
    setActive(null);
  };

  const runDemo = async () => {
    if (!isElectron) return;
    setLines([{ id: Date.now(), stream: 'system', text: '[ Running offline entropy demo ]\n' }]);
    await window.aegis.runDemo();
  };

  const lineColour = (stream) => {
    if (stream === 'stderr') return '#B36A55';
    if (stream === 'system') return '#78716c';
    return '#1c1917';
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto animate-fade-in">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-1">Load Tester</div>
        <h2 className="font-serif text-2xl font-medium text-stone-900">Traffic Simulation Control</h2>
        <p className="text-sm text-stone-500 mt-1 max-w-lg">Fire real HTTP traffic at the local Aegis EC2 edge sensor and observe how the AI discriminates traffic patterns based on Shannon Entropy.</p>
      </div>

      {/* ── Config ─────────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-4">Test Parameters</div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">Duration (seconds)</label>
            <input
              type="number" min="5" max="120" value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              disabled={running}
              className="w-full border border-stone-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-400 bg-white disabled:bg-stone-50"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">Worker Processes</label>
            <input
              type="number" min="1" max="32" value={workers}
              onChange={e => setWorkers(Number(e.target.value))}
              disabled={running}
              className="w-full border border-stone-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-400 bg-white disabled:bg-stone-50"
            />
          </div>
        </div>
      </div>

      {/* ── Scenario Buttons ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => launch(m.id)}
            disabled={running}
            className={`card p-5 text-left transition-all hover:shadow-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              activeMode === m.id ? 'border-stone-400' : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-serif text-base font-medium text-stone-900">{m.label}</div>
                <div className="text-xs text-stone-400 mt-0.5">{m.sub}</div>
              </div>
              {activeMode === m.id && running && (
                <span className="dot-blink" style={{ background: m.colour }} />
              )}
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">{m.description}</p>
            <div className="mt-4 text-xs font-medium" style={{ color: m.colour }}>
              {activeMode === m.id && running ? 'Running…' : 'Launch →'}
            </div>
          </button>
        ))}
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {running ? (
          <button onClick={stop} className="btn-danger">Stop Test</button>
        ) : (
          <button onClick={runDemo} className="btn-outline">Run Entropy Demo (Offline)</button>
        )}
        <button
          onClick={() => setLines([])}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors ml-auto"
        >
          Clear terminal
        </button>
      </div>

      {/* ── Terminal ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-2">Live Execution Terminal</div>
        <div
          ref={termRef}
          className="terminal h-64"
          style={{ fontFamily: "'JetBrains Mono', 'Menlo', monospace", fontSize: '11px' }}
        >
          {lines.length === 0 ? (
            <span style={{ color: '#a8a29e' }}>No output yet. Launch a scenario above.\n</span>
          ) : (
            lines.map(l => (
              <span key={l.id} style={{ color: lineColour(l.stream) }}>{l.text}</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
