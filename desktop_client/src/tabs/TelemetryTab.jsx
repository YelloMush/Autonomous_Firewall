import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';

const SAGE  = '#6A9479';
const EMBER = '#B36A55';
const AMBER = '#b45309';
const BLUE  = '#3b82f6';

function MetricWidget({ label, value, unit, sub, colour, barFill, barColor, alert: isAlert }) {
  return (
    <div className="metric-widget" style={{ borderColor: isAlert ? 'var(--ember)' : 'var(--border)' }}>
      <div className="metric-label">{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
        <span className="metric-value" style={{ color: colour }}>{value}</span>
        {unit && <span style={{ fontSize:9, color:'var(--text-faint)' }}>{unit}</span>}
      </div>
      <div className="metric-bar">
        <div className="metric-bar-fill" style={{ width:`${Math.min(100,(barFill??0)*100).toFixed(1)}%`, background: barColor ?? 'var(--sage)' }} />
      </div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function Waiting({ h = 100 }) {
  return <div style={{ height:h, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-faint)', fontSize:10 }}>Waiting for data…</div>;
}

const TTStyle = {
  contentStyle: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:2, fontSize:9, fontFamily:'Inter', padding:'3px 6px' },
  labelFormatter: () => '',
};

export default function TelemetryTab({ metrics, history, alerts }) {
  const pkt       = metrics?.packet_count ?? 0;
  const entropy   = metrics?.entropy ?? 0;
  const threshold = metrics?.threshold ?? 0;
  const cbActive  = metrics?.circuit_breaker_active ?? false;
  const score     = metrics?.anomaly_score ?? 0;
  const originLoad= cbActive ? 0 : Math.max(0, pkt - Math.floor(pkt * 0.08));

  const scoreColour   = score >= 0.8 ? EMBER : score >= 0.4 ? AMBER : SAGE;
  const entropyColour = entropy >= 6  ? SAGE  : entropy >= 3 ? AMBER : EMBER;

  const chartData = useMemo(() =>
    history.slice(-60).map((h, i) => ({
      i,
      pkt:   h.packet_count ?? 0,
      ent:   parseFloat((h.entropy ?? 0).toFixed(2)),
      score: parseFloat(((h.anomaly_score ?? 0) * 100).toFixed(1)),
      thr:   h.threshold ?? 0,
    })),
    [history]
  );

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:6, padding:8, height:'100%', overflowY:'auto' }}>

      {/* Circuit breaker banner */}
      {cbActive && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(179,106,85,0.08)', border:'1px solid var(--ember)', borderRadius:2, padding:'4px 10px', flexShrink:0 }}>
          <span className="dot dot-blink" style={{ background:EMBER, width:6, height:6 }} />
          <span style={{ fontSize:11, fontWeight:600, color:EMBER }}>NACL CIRCUIT BREAKER ACTIVE</span>
          <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>AWS VPC ingress blocked — anomaly confirmed</span>
        </div>
      )}

      {/* 4-metric row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, flexShrink:0 }}>
        <MetricWidget
          label="Edge Rate (λ)" value={pkt.toLocaleString()} unit="pkts"
          sub={`SQS · thr ${threshold>0?threshold.toFixed(1):'cal'}`}
          colour={cbActive?EMBER:'var(--text-primary)'} barFill={threshold>0?Math.min(1,pkt/(threshold*2)):0} barColor={cbActive?EMBER:SAGE} alert={cbActive}
        />
        <MetricWidget
          label="Anomaly s(x,n)" value={`${(score*100).toFixed(1)}%`} unit=""
          sub={`IsoForest · thr 0.60 · ${score>=0.6?'ANOMALY':'normal'}`}
          colour={scoreColour} barFill={score} barColor={scoreColour} alert={score>=0.6}
        />
        <MetricWidget
          label="Entropy H(x)" value={parseFloat(entropy).toFixed(2)} unit="bits"
          sub={entropy>=6?'Diverse — legitimate':entropy>=3?'Moderate':'Narrow — botnet'}
          colour={entropyColour} barFill={Math.min(1,entropy/14)} barColor={entropyColour}
        />
        <MetricWidget
          label="Origin Load" value={originLoad.toLocaleString()} unit="req"
          sub={cbActive?'NACL block active':'Clean fwd traffic'}
          colour={cbActive?EMBER:SAGE} barFill={threshold>0?Math.min(1,originLoad/(threshold*2)):0} barColor={cbActive?EMBER:BLUE}
        />
      </div>

      {/* Charts 2x2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, flex:1, minHeight:0 }}>

        {/* Packet chart */}
        <div className="surface" style={{ padding:'6px 8px', display:'flex', flexDirection:'column' }}>
          <div className="section-label" style={{ marginBottom:3 }}>Packet Ingestion — 60s</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={chartData} margin={{ top:2, right:4, bottom:0, left:-28 }}>
                <defs><linearGradient id="pkG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SAGE} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={SAGE} stopOpacity={0}/>
                </linearGradient></defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize:8, fill:'var(--text-faint)', fontFamily:'Inter' }} />
                <Tooltip {...TTStyle} formatter={v=>[v,'Pkts']} />
                {threshold>0 && <ReferenceLine y={threshold} stroke={AMBER} strokeDasharray="3 2" label={{ value:'thr', position:'right', fontSize:7, fill:AMBER }} />}
                <Area type="monotone" dataKey="pkt" stroke={SAGE} strokeWidth={1.2} fill="url(#pkG)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Waiting h={130} />}
        </div>

        {/* Entropy chart */}
        <div className="surface" style={{ padding:'6px 8px', display:'flex', flexDirection:'column' }}>
          <div className="section-label" style={{ marginBottom:3 }}>IP Entropy H(x)</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData} margin={{ top:2, right:4, bottom:0, left:-28 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize:8, fill:'var(--text-faint)', fontFamily:'Inter' }} domain={[0,'auto']} />
                <Tooltip {...TTStyle} formatter={v=>[v+' bits','Entropy']} />
                <ReferenceLine y={6} stroke={SAGE}  strokeDasharray="3 2" label={{ value:'diverse', position:'right', fontSize:7, fill:SAGE }} />
                <ReferenceLine y={3} stroke={EMBER} strokeDasharray="3 2" label={{ value:'botnet',  position:'right', fontSize:7, fill:EMBER }} />
                <Line type="monotone" dataKey="ent" stroke={AMBER} strokeWidth={1.2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Waiting h={130} />}
        </div>

        {/* Anomaly score chart */}
        <div className="surface" style={{ padding:'6px 8px', display:'flex', flexDirection:'column' }}>
          <div className="section-label" style={{ marginBottom:3 }}>Anomaly Score s(x,n) %</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top:2, right:4, bottom:0, left:-28 }}>
                <defs><linearGradient id="scG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={EMBER} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={EMBER} stopOpacity={0}/>
                </linearGradient></defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize:8, fill:'var(--text-faint)', fontFamily:'Inter' }} domain={[0,100]} />
                <Tooltip {...TTStyle} formatter={v=>[v+'%','Score']} />
                <ReferenceLine y={60} stroke={EMBER} strokeDasharray="3 2" label={{ value:'alert', position:'right', fontSize:7, fill:EMBER }} />
                <Area type="monotone" dataKey="score" stroke={EMBER} strokeWidth={1.2} fill="url(#scG)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Waiting h={120} />}
        </div>

        {/* Alert list */}
        <div className="surface" style={{ padding:'6px 8px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div className="section-label" style={{ marginBottom:3 }}>System Alerts ({alerts.length})</div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {alerts.length === 0 ? <Waiting h={80} /> : alerts.slice(0,14).map(a => (
              <div key={a.id} style={{ display:'flex', gap:6, padding:'2px 0', borderBottom:'1px solid var(--border)', alignItems:'baseline' }}>
                <span style={{ fontFamily:'JetBrains Mono', fontSize:9, color:'var(--text-faint)', flexShrink:0 }}>{a.ts}</span>
                <span style={{ fontSize:10, color:'var(--text-primary)', lineHeight:1.3 }}>{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
