import React, { useState, useEffect, useRef } from 'react';

const isElectron = !!(window.aegis);

const TOOLS = [
  {
    id: 'flash', label: 'Flash Crowd', category: 'Stress Test', icon: '⚡',
    colour: '#6A9479', badgeClass: 'badge-sage',
    desc: '50k IP pool · H > 10 bits · AI classifies as benign',
    defaultWorkers: 8, defaultDuration: 20, defaultRps: 500,
  },
  {
    id: 'botnet', label: 'Botnet DDoS', category: 'Attack Vector', icon: '☠',
    colour: '#B36A55', badgeClass: 'badge-ember',
    desc: '5–10 IP cluster · H < 3 bits · triggers NACL block',
    defaultWorkers: 8, defaultDuration: 20, defaultRps: 800,
  },
];

export default function ToolsTab() {
  const [selected, setSelected]   = useState('flash');
  const [running, setRunning]     = useState(false);
  const [workers, setWorkers]     = useState(8);
  const [duration, setDuration]   = useState(20);
  const [rps, setRps]             = useState(500);
  const [lines, setLines]         = useState([]);
  const termRef  = useRef(null);
  const unsubRef = useRef(null);

  const tool = TOOLS.find(t => t.id === selected);

  useEffect(() => {
    if (tool) { setWorkers(tool.defaultWorkers); setDuration(tool.defaultDuration); setRps(tool.defaultRps); }
  }, [selected]);

  useEffect(() => {
    if (!isElectron) return;
    unsubRef.current = window.aegis.onTesterLine(({ stream, line }) => {
      setLines(prev => { const e = { id: Date.now()+Math.random(), stream, text: line }; const n=[...prev,e]; return n.length>600?n.slice(-600):n; });
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [lines]);

  const launch = async () => {
    if (!isElectron) { setLines(p=>[...p,{id:Date.now(),stream:'system',text:'[ERROR] No Electron IPC.\n'}]); return; }
    setLines([{ id:Date.now(), stream:'system', text:`[ ${tool.label} · ${workers}w × ${duration}s @ ${rps} RPS ]\n` }]);
    setRunning(true);
    try {
      const r = await window.aegis.runTester(selected, duration, workers);
      if (!r.ok) throw new Error('Spawn failed');
    } catch(e) {
      setLines(p=>[...p,{id:Date.now(),stream:'stderr',text:`[ERROR] ${e.message}\n`}]);
      setRunning(false);
    }
  };

  const stop = async () => {
    if (!isElectron) return;
    await window.aegis.killTester();
    setLines(p=>[...p,{id:Date.now(),stream:'system',text:'[ Terminated by user ]\n'}]);
    setRunning(false);
  };

  const lc = (s) => s==='stderr'?'var(--ember)':s==='system'?'var(--text-muted)':'var(--text-primary)';

  return (
    <div className="fade-in" style={{ display:'grid', gridTemplateColumns:'180px 1fr', height:'100%', overflow:'hidden' }}>

      {/* ── Left: Tool selector ────────────────────────────────────── */}
      <div style={{ borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ padding:'5px 8px', borderBottom:'1px solid var(--border)', fontSize:9, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Test Suite</div>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => { setSelected(t.id); setLines([]); }}
            style={{
              display:'flex', flexDirection:'column', gap:2, padding:'7px 8px', textAlign:'left',
              background: selected===t.id ? 'var(--bg-subtle)' : 'transparent',
              border:'none',
              borderLeft: `2px solid ${selected===t.id ? t.colour : 'transparent'}`,
              borderBottom:'1px solid var(--border)',
              cursor:'pointer', color:'var(--text-primary)', transition:'background 0.1s',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:12 }}>{t.icon}</span>
              <span style={{ fontSize:11, fontWeight:600 }}>{t.label}</span>
            </div>
            <span className={`badge ${t.badgeClass}`} style={{ alignSelf:'flex-start' }}>{t.category}</span>
            <span style={{ fontSize:9, color:'var(--text-faint)', lineHeight:1.35, marginTop:1 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Right: Controls + terminal ─────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateRows:'auto 1fr', overflow:'hidden' }}>

        {/* Controls bar */}
        <div style={{ padding:'5px 8px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--bg-surface)', flexShrink:0 }}>
          {[['Duration (s)', duration, setDuration, 5, 120, 70],
            ['Workers',      workers,  setWorkers,  1, 32,  55],
            ['Target RPS',   rps,      setRps,      10,5000,70]
          ].map(([label, val, setter, min, max, w]) => (
            <div key={label} style={{ display:'flex', flexDirection:'column', gap:1 }}>
              <label className="form-label">{label}</label>
              <input type="number" className="form-input" style={{ width:w }} min={min} max={max}
                value={val} onChange={e=>setter(+e.target.value)} disabled={running} />
            </div>
          ))}
          <div style={{ display:'flex', gap:5, marginLeft:4, alignItems:'flex-end', paddingBottom:0 }}>
            {running
              ? <button className="btn btn-danger" onClick={stop}>⏹ Stop</button>
              : <button className="btn" style={{ background:tool.colour, color:'#fff' }} onClick={launch}>{tool.icon} Launch</button>
            }
            <button className="btn btn-outline" onClick={()=>setLines([])} disabled={running}>Clear</button>
          </div>
          {running && (
            <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:4 }}>
              <span className="dot dot-blink" style={{ background:tool.colour }} />
              <span style={{ fontSize:10, color:'var(--text-muted)' }}>{tool.label} running…</span>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <div className="section-label" style={{ margin:0 }}>Execution Terminal</div>
            <span style={{ fontFamily:'JetBrains Mono', fontSize:9, color:'var(--text-faint)' }}>← real_world_tester.py stdout</span>
          </div>
          <div ref={termRef} className="terminal" style={{ flex:1 }}>
            {lines.length === 0
              ? <span style={{ color:'var(--text-faint)' }}>Select a tool and click Launch.\nOutput streams here via IPC.</span>
              : lines.map(l => <span key={l.id} style={{ color:lc(l.stream) }}>{l.text}</span>)
            }
            {running && <span style={{ color:tool.colour }}>▌</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
