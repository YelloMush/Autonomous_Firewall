import React, { useState } from 'react';
import HealthGauge from '../components/HealthGauge';

const ACTIONS = [
  {
    id: 'sqs',
    icon: '☁',
    label: 'Analyze SQS Queues',
    desc: 'Inspect queue depth & message lag',
    badge: 'AWS',
    badgeClass: 'badge-amber',
  },
  {
    id: 'nacl',
    icon: '🛡',
    label: 'Audit NACL Rules',
    desc: 'Review active VPC ingress / egress rules',
    badge: 'VPC',
    badgeClass: 'badge-sage',
  },
  {
    id: 'ping',
    icon: '📡',
    label: 'Ping Edge Sensors',
    desc: 'Measure latency to EC2 edge nodes',
    badge: 'EC2',
    badgeClass: 'badge-muted',
  },
  {
    id: 'reset',
    icon: '↺',
    label: 'Reset AI Baseline',
    desc: 'Flush IsolationForest & recalibrate',
    badge: 'AI',
    badgeClass: 'badge-ember',
  },
];

export default function OverviewTab({ metrics, alerts }) {
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});

  const score   = metrics?.anomaly_score ?? 0;
  const pkt     = metrics?.packet_count ?? 0;
  const entropy = metrics?.entropy ?? 0;
  const cbActive = metrics?.circuit_breaker_active ?? false;

  const runAction = async (id) => {
    setRunning(id);
    // Simulate async tool execution with realistic delay
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    const msgs = {
      sqs:   `Queue depth: ${Math.floor(Math.random()*40)} msgs — avg lag ${(Math.random()*0.3+0.05).toFixed(3)}s`,
      nacl:  `NACL Rule 100: ALLOW 0.0.0.0/0 — Rule 200: DENY botnet-pool — Rules OK`,
      ping:  `Edge node us-east-1a: ${(Math.random()*12+2).toFixed(1)}ms — us-east-1b: ${(Math.random()*14+2).toFixed(1)}ms`,
      reset: `IsolationForest flushed. Recalibration scheduled in 20s.`,
    };
    setResults(prev => ({ ...prev, [id]: msgs[id] }));
    setRunning(null);
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, height: '100%', padding: 16, overflow: 'hidden' }}>

      {/* ── Left: Health Gauge + Alert feed ──────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div className="surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <HealthGauge score={score} cbActive={cbActive} />

          {/* Quick stats under gauge */}
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <StatCell label="Packets" value={pkt.toLocaleString()} />
            <StatCell label="Entropy" value={`${parseFloat(entropy).toFixed(2)} b`} />
            <StatCell label="Threshold" value={metrics?.threshold ? metrics.threshold.toFixed(1) : '—'} />
            <StatCell label="CB State" value={cbActive ? 'ACTIVE' : 'Off'} color={cbActive ? 'var(--ember)' : 'var(--sage)'} />
          </div>
        </div>

        {/* Recent alerts */}
        <div className="surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="section-label" style={{ margin: 0 }}>Recent Events</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-faint)' }}>No events recorded.</div>
            ) : (
              alerts.slice(0, 20).map(a => (
                <div key={a.id} style={{ padding: '4px 12px', display: 'flex', gap: 8, alignItems: 'baseline', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{a.ts}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{a.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Action cards grid ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div className="section-label">Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ACTIONS.map(a => (
            <button
              key={a.id}
              className="action-card"
              onClick={() => runAction(a.id)}
              disabled={running === a.id}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <span className={`badge ${a.badgeClass}`}>{a.badge}</span>
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>
                {running === a.id ? 'Running…' : a.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{a.desc}</div>
              {results[a.id] && (
                <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--sage)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  {results[a.id]}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* System summary table */}
        <div className="surface" style={{ padding: 12 }}>
          <div className="section-label">Infrastructure Summary</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {[
                ['Deployment Region',   'us-east-1 (N. Virginia)'],
                ['VPC CIDR',            '10.0.0.0/16'],
                ['SQS Queue',           'aegis-edge-ingestion.fifo'],
                ['EC2 Sensor',          't3.micro · Auto Scaling: 1–5'],
                ['NACL Rules',          'Dynamic via Boto3 / rule 32767'],
                ['AI Model',            'IsolationForest · contamination 0.01'],
                ['Backend',             'FastAPI · uvicorn · ws://localhost:8000'],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '5px 0', color: 'var(--text-faint)', width: '45%' }}>{k}</td>
                  <td style={{ padding: '5px 0', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }) {
  return (
    <div className="surface-sub" style={{ padding: '6px 8px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 500, color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
