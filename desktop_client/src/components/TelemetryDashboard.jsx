import React, { useMemo } from 'react';
import MetricCard from './MetricCard';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const SAGE  = '#6A9479';
const EMBER = '#B36A55';
const AMBER = '#b45309';

export default function TelemetryDashboard({ metrics, history, alerts }) {
  const pkt       = metrics?.packet_count ?? 0;
  const entropy   = metrics?.entropy ?? 0;
  const threshold = metrics?.threshold ?? 0;
  const cbActive  = metrics?.circuit_breaker_active ?? false;
  const score     = metrics?.anomaly_score ?? 0;

  // Derived metrics
  const edgeRate     = pkt;                      // packets / window
  const originLoad   = cbActive ? 0 : Math.max(0, pkt - Math.floor(pkt * 0.08)); // approx — blocked packets filtered
  const anomalyPct   = (score * 100).toFixed(1);
  const entropyBits  = parseFloat(entropy).toFixed(3);

  const scoreColour  = score >= 0.80 ? EMBER : score >= 0.40 ? AMBER : SAGE;
  const entropyColour = entropy >= 6 ? SAGE  : entropy >= 3  ? AMBER : EMBER;

  // Chart data (last 60 samples)
  const chartData = useMemo(() =>
    history.slice(-60).map((h, i) => ({
      i,
      pkt:  h.packet_count,
      ent:  parseFloat(h.entropy?.toFixed(2) ?? '0'),
      thr:  h.threshold,
    })),
    [history]
  );

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto animate-fade-in">
      {/* ── Alert Banner ────────────────────────────────────────────── */}
      {cbActive && (
        <div className="flex items-center gap-3 bg-white border border-ember px-5 py-3 rounded-sm">
          <span className="dot-blink" style={{ background: EMBER }} />
          <span className="text-sm font-medium text-stone-800">NACL Circuit Breaker Active</span>
          <span className="text-xs text-stone-500 ml-auto">VPC ingress blocked — AI anomaly confirmed</span>
        </div>
      )}

      {/* ── Metric Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Edge Ingestion Rate"
          value={edgeRate.toLocaleString()}
          unit="pkts / window"
          sub={`λ = ${pkt} · SQS queue depth`}
          colour={cbActive ? EMBER : '#1c1917'}
          barFill={threshold > 0 ? Math.min(1, pkt / (threshold * 2)) : 0}
          alert={cbActive}
        />
        <MetricCard
          label="AI Anomaly Score"
          value={anomalyPct}
          unit="%"
          sub={`Isolation Forest · threshold ${threshold > 0 ? threshold.toFixed(1) : '—'} pkts`}
          colour={scoreColour}
          barFill={score}
          alert={score >= 0.80}
        />
        <MetricCard
          label="Origin Server Load"
          value={originLoad.toLocaleString()}
          unit="req / window"
          sub={cbActive ? 'NACL block active — traffic isolated' : 'Unfiltered clean traffic'}
          colour={cbActive ? EMBER : SAGE}
          barFill={threshold > 0 ? Math.min(1, originLoad / (threshold * 2)) : 0}
        />
        <MetricCard
          label="IP Distribution Entropy"
          value={entropyBits}
          unit="bits"
          sub={`H(x) = -Σ P(x) log₂P(x) · ${entropy >= 6 ? 'Diverse — Legitimate' : entropy >= 3 ? 'Moderate' : 'Narrow — Botnet Pattern'}`}
          colour={entropyColour}
          barFill={Math.min(1, entropy / 14)}
        />
      </div>

      {/* ── Traffic History Chart ─────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-4">Packet Ingestion History — 60s window</div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#f5f5f4" strokeDasharray="2 4" />
              <XAxis dataKey="i" hide />
              <YAxis tick={{ fontSize: 10, fill: '#a8a29e', fontFamily: 'Inter' }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 2, fontSize: 11, fontFamily: 'Inter' }}
                labelFormatter={() => ''}
                formatter={(v, n) => [v, n === 'pkt' ? 'Packets' : n === 'ent' ? 'Entropy' : 'Threshold']}
              />
              {threshold > 0 && (
                <ReferenceLine y={threshold} stroke="#b45309" strokeDasharray="4 2"
                  label={{ value: 'threshold', position: 'right', fontSize: 9, fill: '#b45309', fontFamily: 'Inter' }} />
              )}
              <Line type="monotone" dataKey="pkt" stroke={SAGE} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 flex items-center justify-center text-stone-300 text-sm">
            Waiting for telemetry data…
          </div>
        )}
      </div>

      {/* ── Entropy History ───────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-4">IP Entropy History — H(x) bits</div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#f5f5f4" strokeDasharray="2 4" />
              <XAxis dataKey="i" hide />
              <YAxis tick={{ fontSize: 10, fill: '#a8a29e', fontFamily: 'Inter' }} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 2, fontSize: 11, fontFamily: 'Inter' }}
                labelFormatter={() => ''}
                formatter={(v) => [v + ' bits', 'Entropy H(x)']}
              />
              <ReferenceLine y={6} stroke={SAGE} strokeDasharray="4 2"
                label={{ value: 'diverse', position: 'right', fontSize: 9, fill: SAGE, fontFamily: 'Inter' }} />
              <ReferenceLine y={3} stroke={EMBER} strokeDasharray="4 2"
                label={{ value: 'botnet risk', position: 'right', fontSize: 9, fill: EMBER, fontFamily: 'Inter' }} />
              <Line type="monotone" dataKey="ent" stroke={AMBER} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-36 flex items-center justify-center text-stone-300 text-sm">
            Waiting for entropy data…
          </div>
        )}
      </div>

      {/* ── Recent Alerts ─────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="card p-5">
          <div className="text-xs uppercase tracking-widest text-stone-400 mb-4">System Alerts</div>
          <div className="flex flex-col gap-1.5">
            {alerts.slice(0, 6).map(a => (
              <div key={a.id} className="flex items-baseline gap-3 border-b border-stone-50 pb-1.5">
                <span className="font-mono text-xs text-stone-300 flex-shrink-0">{a.ts}</span>
                <span className="text-sm text-stone-700">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
