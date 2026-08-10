import React from 'react';

// Compact 90x90 gauge for the sidebar column
const R = 36;
const CIRC = 2 * Math.PI * R;
const ARC  = CIRC * 0.75;

export default function HealthGauge({ score = 0, cbActive = false, size = 90 }) {
  const fill   = Math.min(1, score);
  const offset = ARC - fill * ARC;
  const color  = cbActive ? '#B36A55' : score >= 0.7 ? '#B36A55' : score >= 0.4 ? '#b45309' : '#6A9479';
  const label  = cbActive ? 'BLOCKED' : score >= 0.7 ? 'THREAT' : score >= 0.4 ? 'HIGH' : 'NOMINAL';
  const pct    = Math.round(fill * 100);
  const vb     = `0 0 ${size} ${size}`;
  const cx = size / 2, cy = size / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg width={size} height={size} viewBox={vb}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth={7}
          strokeDasharray={`${ARC} ${CIRC}`} strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${ARC} ${CIRC}`} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
          className="gauge-ring" />
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, fill: color }}>
          {pct}%
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: 7.5, letterSpacing: '0.07em', fill: 'var(--text-faint)', textTransform: 'uppercase' }}>
          {label}
        </text>
      </svg>
    </div>
  );
}
