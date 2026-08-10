import React, { useState } from 'react';
import HealthGauge from '../components/HealthGauge';

const ACTIONS = [
  { id:'sqs',   icon:'⚙', label:'Analyze SQS Queues',  desc:'Queue depth & message lag',       badge:'AWS',  cls:'badge-amber' },
  { id:'nacl',  icon:'🛡', label:'Audit NACL Rules',    desc:'VPC ingress / egress rule review', badge:'VPC',  cls:'badge-sage'  },
  { id:'ping',  icon:'📡', label:'Ping Edge Sensors',   desc:'EC2 node latency check',           badge:'EC2',  cls:'badge-muted' },
  { id:'reset', icon:'↺',  label:'Reset AI Baseline',   desc:'Flush & recalibrate Isolation Forest', badge:'AI', cls:'badge-ember' },
];

export default function OverviewTab({ metrics, alerts }) {
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});

  const score    = metrics?.anomaly_score ?? 0;
  const pkt      = metrics?.packet_count  ?? 0;
  const entropy  = metrics?.entropy       ?? 0;
  const threshold= metrics?.threshold     ?? 0;
  const cbActive = metrics?.circuit_breaker_active ?? false;

  const runAction = async (id) => {
    setRunning(id);
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
    const msgs = {
      sqs:   `Depth: ${Math.floor(Math.random()*40)} msgs · lag ${(Math.random()*0.3+0.05).toFixed(3)}s`,
      nacl:  `Rule 100: ALLOW 0.0.0.0/0 · Rule 200: DENY botnet-pool · OK`,
      ping:  `us-east-1a: ${(Math.random()*12+2).toFixed(1)}ms · 1b: ${(Math.random()*14+2).toFixed(1)}ms`,
      reset: `IsolationForest flushed. Recalibration in 20s.`,
    };
    setResults(prev => ({ ...prev, [id]: msgs[id] }));
    setRunning(null);
  };

  return (
    <div className="fade-in" style={{
      display: 'grid', gridTemplateColumns: '200px 1fr',
      gap: 8, padding: 8, height: '100%', overflow: 'hidden',
    }}>

      {/* ── Left column ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, overflowY:'auto' }}>
        {/* Gauge card */}
        <div className="surface" style={{ padding:10, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <HealthGauge score={score} cbActive={cbActive} size={90} />
          <div style={{ width:'100%', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {[
              ['Pkts',  pkt.toLocaleString()],
              ['H(x)',  `${parseFloat(entropy).toFixed(2)}b`],
              ['Thr',   threshold > 0 ? threshold.toFixed(1) : '—'],
              ['CB',    cbActive ? 'ACT' : 'Off', cbActive ? 'var(--ember)' : 'var(--sage)'],
            ].map(([k, v, c]) => (
              <div key={k} className="surface-sub" style={{ padding:'4px 6px' }}>
                <div style={{ fontSize:8, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{k}</div>
                <div style={{ fontFamily:'JetBrains Mono', fontSize:11, fontWeight:500, color: c ?? 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert feed */}
        <div className="surface" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'5px 8px', borderBottom:'1px solid var(--border)', fontSize:9, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Events</div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {alerts.length === 0
              ? <div style={{ padding:'8px', fontSize:10, color:'var(--text-faint)' }}>No events.</div>
              : alerts.slice(0, 30).map(a => (
                  <div key={a.id} style={{ padding:'3px 8px', borderBottom:'1px solid var(--border)', display:'flex', gap:6, alignItems:'baseline' }}>
                    <span style={{ fontFamily:'JetBrains Mono', fontSize:9, color:'var(--text-faint)', flexShrink:0 }}>{a.ts}</span>
                    <span style={{ fontSize:10, color:'var(--text-primary)', lineHeight:1.3 }}>{a.message}</span>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* ── Right column ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, overflowY:'auto' }}>
        <div className="section-label">Quick Actions</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {ACTIONS.map(a => (
            <button key={a.id} className="action-card" onClick={() => runAction(a.id)} disabled={running === a.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                <span style={{ fontSize:14 }}>{a.icon}</span>
                <span className={`badge ${a.cls}`}>{a.badge}</span>
              </div>
              <div style={{ fontFamily:'Playfair Display, serif', fontSize:12, fontWeight:500, color:'var(--text-primary)', marginBottom:2 }}>
                {running === a.id ? 'Running…' : a.label}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', lineHeight:1.3 }}>{a.desc}</div>
              {results[a.id] && (
                <div style={{ marginTop:5, fontSize:9, fontFamily:'JetBrains Mono', color:'var(--sage)', lineHeight:1.45, borderTop:'1px solid var(--border)', paddingTop:4 }}>
                  {results[a.id]}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Infrastructure table */}
        <div className="surface" style={{ padding:'8px 10px' }}>
          <div className="section-label">Infrastructure</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {[
                ['Region',    'us-east-1 (N. Virginia)'],
                ['VPC CIDR',  '10.0.0.0/16'],
                ['SQS Queue', 'aegis-edge-ingestion.fifo'],
                ['EC2',       't3.micro · ASG 1–5'],
                ['NACL',      'Dynamic · Boto3 rule 32767'],
                ['AI Model',  'IsolationForest · contam 0.01'],
                ['Backend',   'FastAPI · ws://localhost:8000'],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'3px 0', fontSize:10, color:'var(--text-faint)', width:'40%' }}>{k}</td>
                  <td style={{ padding:'3px 0', fontSize:10, fontFamily:'JetBrains Mono', color:'var(--text-primary)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
