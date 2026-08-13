import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import TickNumber from '../components/TickNumber';
import AnomalyGauge from '../components/AnomalyGauge';
import EntropyStrip from '../components/EntropyStrip';
import Sparkline from '../components/Sparkline';
import SegmentedBar from '../components/SegmentedBar';
import ConfidenceBadge from '../components/ConfidenceBadge';
import PacketTopology from '../components/PacketTopology';

const SAGE  = '#6A9479';
const EMBER = '#B36A55';
const AMBER = '#b45309';
const BLUE  = '#3b82f6';

function MetricFrame({ label, alert, children }) {
  return (
    <div className="metric-widget" style={{ borderColor: alert ? 'var(--ember)' : 'var(--border)' }}>
      <div className="metric-label">{label}</div>
      {children}
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

export default function TelemetryTab({ metrics, history, alerts, dataSource = 'live', simPhase, onTriggerSim }) {
  const pkt       = metrics?.packet_count ?? 0;
  const entropy   = metrics?.entropy ?? 0;
  const threshold = metrics?.threshold ?? 0;
  const cbActive  = metrics?.circuit_breaker_active ?? false;
  const score     = metrics?.anomaly_score ?? 0;
  const originLoad= cbActive ? 0 : Math.max(0, pkt - Math.floor(pkt * 0.08));
  const packetRate= threshold > 0 ? Math.min(1, pkt / (threshold * 2)) : 0;

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
        <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:3, background:'rgba(179,106,85,0.08)', border:'1px solid var(--ember)', borderRadius:2, padding:'5px 10px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="dot dot-blink" style={{ background:EMBER, width:6, height:6 }} />
            <span style={{ fontSize:11, fontWeight:600, color:EMBER }}>NACL CIRCUIT BREAKER ACTIVE</span>
            <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>AWS VPC ingress blocked — anomaly confirmed</span>
          </div>
          <div style={{ fontFamily:'JetBrains Mono, Menlo, monospace', fontSize:9, color:'var(--text-faint)', paddingLeft:14 }}>
            boto3 → ec2.create_network_acl_entry · rule 32767 · DENY ALL · ingress+egress
          </div>
        </div>
      )}

      {/* 4-metric row — each metric gets a visualization matched to what it means */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, flexShrink:0 }}>

        {/* Edge Ingestion Rate — big number + sparkline */}
        <MetricFrame label="Edge Rate (λ)" alert={cbActive}>
          <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
            <span className="metric-value" style={{ color: cbActive ? EMBER : 'var(--text-primary)' }}><TickNumber value={pkt} /></span>
            <span style={{ fontSize:9, color:'var(--text-faint)' }}>pkts</span>
          </div>
          <div style={{ margin:'4px 0 2px' }}>
            <Sparkline data={chartData.map(d => d.pkt)} color={cbActive ? 'var(--ember)' : 'var(--sage)'} width={68} height={22} />
          </div>
          <div className="metric-sub">SQS · thr {threshold>0?threshold.toFixed(1):'cal'}</div>
        </MetricFrame>

        {/* AI Anomaly Score — circular gauge with breach threshold marker + confidence badge */}
        <MetricFrame label="Anomaly s(x,n)" alert={score>=0.6}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <AnomalyGauge score={score} threshold={0.6} size={54} cbActive={cbActive} />
            <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>
              <ConfidenceBadge score={score} threshold={0.6} />
              <div className="metric-sub">IsoForest · thr 0.60</div>
            </div>
          </div>
        </MetricFrame>

        {/* IP Entropy — big number + Shannon-entropy heat strip */}
        <MetricFrame label="Entropy H(x)">
          <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
            <span className="metric-value" style={{ color: entropyColour }}><TickNumber value={parseFloat(entropy)} decimals={2} /></span>
            <span style={{ fontSize:9, color:'var(--text-faint)' }}>bits</span>
          </div>
          <div style={{ margin:'4px 0 2px' }}>
            <EntropyStrip entropy={entropy} segments={14} />
          </div>
        </MetricFrame>

        {/* Origin Server Load — big number + segmented meter (drops to empty/ember on mitigation) */}
        <MetricFrame label="Origin Load" alert={cbActive}>
          <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
            <span className="metric-value" style={{ color: cbActive ? EMBER : SAGE }}><TickNumber value={originLoad} /></span>
            <span style={{ fontSize:9, color:'var(--text-faint)' }}>req</span>
          </div>
          <div style={{ margin:'4px 0 2px' }}>
            <SegmentedBar value={threshold>0?Math.min(1,originLoad/(threshold*2)):0} segments={10} color={cbActive ? 'var(--ember)' : 'var(--sage)'} />
          </div>
          <div className="metric-sub">{cbActive?'NACL block active':'Clean fwd traffic'}</div>
        </MetricFrame>
      </div>

      {/* Live Packet Topology — the presentation visualizer */}
      <div className="surface" style={{ padding:'6px 10px 4px', flexShrink:0, position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <div className="section-label" style={{ margin:0 }}>Live Packet Topology</div>
          {dataSource === 'sim' && (
            <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
              <button className="btn btn-outline" style={{ padding:'1px 6px', fontSize:9 }}
                onClick={() => onTriggerSim?.('nominal')} disabled={simPhase === 'nominal'}>Reset</button>
              <button className="btn" style={{ padding:'1px 6px', fontSize:9, background:SAGE, color:'#fff' }}
                onClick={() => onTriggerSim?.('flashCrowd')} disabled={simPhase === 'flashCrowd'}>⚡ Flash Crowd</button>
              <button className="btn" style={{ padding:'1px 6px', fontSize:9, background:EMBER, color:'#fff' }}
                onClick={() => onTriggerSim?.('botnet')} disabled={simPhase === 'botnet' || simPhase === 'mitigating'}>☠ Botnet DDoS</button>
            </div>
          )}
        </div>
        <PacketTopology score={score} entropy={entropy} cbActive={cbActive} packetRate={packetRate} />
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
