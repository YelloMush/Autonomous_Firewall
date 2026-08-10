import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';

const SAGE  = '#6A9479';
const EMBER = '#B36A55';
const AMBER = '#b45309';
const BLUE  = '#3b82f6';

export default function TelemetryTab({ metrics, history, alerts }) {
  const pkt       = metrics?.packet_count ?? 0;
  const entropy   = metrics?.entropy ?? 0;
  const threshold = metrics?.threshold ?? 0;
  const cbActive  = metrics?.circuit_breaker_active ?? false;
  const score     = metrics?.anomaly_score ?? 0;
  const originLoad = cbActive ? 0 : Math.max(0, pkt - Math.floor(pkt * 0.08));

  const scoreColour   = score >= 0.8 ? EMBER : score >= 0.4 ? AMBER : SAGE;
  const entropyColour = entropy >= 6  ? SAGE  : entropy >= 3 ? AMBER : EMBER;

  const chartData = useMemo(() =>
    history.slice(-90).map((h, i) => ({
      i,
      pkt:  h.packet_count ?? 0,
      ent:  parseFloat((h.entropy ?? 0).toFixed(3)),
      thr:  h.threshold ?? 0,
      score: parseFloat(((h.anomaly_score ?? 0) * 100).toFixed(1)),
    })),
    [history]
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, height: '100%', overflowY: 'auto' }}>

      {/* ── Circuit Breaker Banner ─────────────────────────────────── */}
      {cbActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(179,106,85,0.1)', border: '1px solid var(--ember)', borderRadius: 2, padding: '8px 14px' }}>
          <span className="dot dot-blink" style={{ background: EMBER, width: 8, height: 8 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: EMBER }}>NACL CIRCUIT BREAKER ACTIVE</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>AWS VPC ingress blocked — anomaly confirmed by IsolationForest</span>
        </div>
      )}

      {/* ── 4-Metric Widget Row ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <MetricWidget
          label="Edge Ingestion Rate (λ)"
          value={pkt.toLocaleString()}
          unit="pkts / window"
          sub={`SQS queue depth · threshold ${threshold > 0 ? threshold.toFixed(1) : 'calibrating'}`}
          colour={cbActive ? EMBER : 'var(--text-primary)'}
          barFill={threshold > 0 ? Math.min(1, pkt / (threshold * 2)) : 0}
          barColor={cbActive ? EMBER : SAGE}
          alert={cbActive}
        />
        <MetricWidget
          label="AI Anomaly Score s(x,n)"
          value={`${(score * 100).toFixed(1)}%`}
          unit=""
          sub={`IsolationForest · threshold 0.60 · ${score >= 0.6 ? 'ANOMALY' : 'normal'}`}
          colour={scoreColour}
          barFill={score}
          barColor={scoreColour}
          alert={score >= 0.6}
        />
        <MetricWidget
          label="IP Distribution Entropy H(x)"
          value={parseFloat(entropy).toFixed(3)}
          unit="bits"
          sub={`-Σ P(x)·log₂P(x) · ${entropy >= 6 ? 'Diverse — legitimate' : entropy >= 3 ? 'Moderate' : 'Narrow — botnet risk'}`}
          colour={entropyColour}
          barFill={Math.min(1, entropy / 14)}
          barColor={entropyColour}
        />
        <MetricWidget
          label="Origin Server Load"
          value={originLoad.toLocaleString()}
          unit="req / window"
          sub={cbActive ? 'NACL block active — traffic isolated' : 'Clean traffic forwarded'}
          colour={cbActive ? EMBER : SAGE}
          barFill={threshold > 0 ? Math.min(1, originLoad / (threshold * 2)) : 0}
          barColor={cbActive ? EMBER : BLUE}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Packet ingestion chart */}
        <div className="surface" style={{ padding: 12 }}>
          <div className="section-label">Packet Ingestion — 90s window</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="pkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SAGE} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={SAGE} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'Inter' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 2, fontSize: 10, fontFamily: 'Inter' }} labelFormatter={() => ''} formatter={(v) => [v, 'Packets']} />
                {threshold > 0 && <ReferenceLine y={threshold} stroke={AMBER} strokeDasharray="4 2" label={{ value: 'threshold', position: 'right', fontSize: 8, fill: AMBER }} />}
                <Area type="monotone" dataKey="pkt" stroke={SAGE} strokeWidth={1.5} fill="url(#pkGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Waiting h={160} />}
        </div>

        {/* Entropy chart */}
        <div className="surface" style={{ padding: 12 }}>
          <div className="section-label">IP Entropy H(x) — bits</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'Inter' }} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 2, fontSize: 10, fontFamily: 'Inter' }} labelFormatter={() => ''} formatter={(v) => [v + ' bits', 'Entropy H(x)']} />
                <ReferenceLine y={6} stroke={SAGE} strokeDasharray="3 2" label={{ value: 'diverse', position: 'right', fontSize: 8, fill: SAGE }} />
                <ReferenceLine y={3} stroke={EMBER} strokeDasharray="3 2" label={{ value: 'botnet', position: 'right', fontSize: 8, fill: EMBER }} />
                <Line type="monotone" dataKey="ent" stroke={AMBER} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Waiting h={160} />}
        </div>

        {/* Anomaly score chart */}
        <div className="surface" style={{ padding: 12 }}>
          <div className="section-label">Anomaly Score s(x,n) — %</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="scGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={EMBER} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={EMBER} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'Inter' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 2, fontSize: 10 }} labelFormatter={() => ''} formatter={(v) => [v + '%', 'Score']} />
                <ReferenceLine y={60} stroke={EMBER} strokeDasharray="4 2" label={{ value: 'alert threshold', position: 'right', fontSize: 8, fill: EMBER }} />
                <Area type="monotone" dataKey="score" stroke={EMBER} strokeWidth={1.5} fill="url(#scGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Waiting h={140} />}
        </div>

        {/* Alert list */}
        <div className="surface" style={{ padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="section-label">System Alerts ({alerts.length})</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <Waiting h={100} label="No alerts yet" />
            ) : (
              alerts.slice(0, 12).map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{a.ts}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{a.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricWidget({ label, value, unit, sub, colour, barFill, barColor, alert: isAlert }) {
  return (
    <div className="metric-widget" style={{ borderColor: isAlert ? 'var(--ember)' : 'var(--border)' }}>
      <div className="metric-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="metric-value" style={{ fontSize: 22, color: colour }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'Inter' }}>{unit}</span>}
      </div>
      <div className="metric-bar">
        <div className="metric-bar-fill" style={{ width: `${Math.min(100, (barFill ?? 0) * 100).toFixed(1)}%`, background: barColor ?? 'var(--sage)' }} />
      </div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function Waiting({ h = 120, label = 'Waiting for telemetry…' }) {
  return (
    <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 11 }}>
      {label}
    </div>
  );
}
