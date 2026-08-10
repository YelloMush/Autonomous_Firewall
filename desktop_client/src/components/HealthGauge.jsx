import React from 'react';

const R = 52;
const CIRC = 2 * Math.PI * R;
// We only use 75% of the circle (270 deg arc)
const ARC = CIRC * 0.75;

export default function HealthGauge({ score = 0, cbActive = false }) {
  const fill = Math.min(1, score);
  const offset = ARC - fill * ARC;

  const color = cbActive ? '#B36A55'
    : score >= 0.7 ? '#B36A55'
    : score >= 0.4 ? '#b45309'
    : '#6A9479';

  const label = cbActive ? 'BLOCKED'
    : score >= 0.7 ? 'THREAT'
    : score >= 0.4 ? 'ELEVATED'
    : 'NOMINAL';

  const pct = Math.round(fill * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Background arc */}
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeDasharray={`${ARC} ${CIRC}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
        />
        {/* Foreground arc */}
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${ARC} ${CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
          className="gauge-ring"
        />
        {/* Center text */}
        <text x="70" y="65" textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 500, fill: color }}>
          {pct}%
        </text>
        <text x="70" y="86" textAnchor="middle"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, letterSpacing: '0.08em', fill: 'var(--text-faint)', textTransform: 'uppercase' }}>
          {label}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>System Health Score</div>
    </div>
  );
}
