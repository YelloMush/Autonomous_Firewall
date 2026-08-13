import React from 'react';

// Circular gauge dedicated to the AI Anomaly Score. Unlike HealthGauge, this
// renders a threshold tick on the arc marking the exact point the AI circuit
// breaker fires, since that crossing is the single most consequential event
// in the telemetry tab.
export default function AnomalyGauge({ score = 0, threshold = 0.6, size = 84, cbActive = false }) {
  const R    = size * 0.4;
  const CIRC = 2 * Math.PI * R;
  const ARC  = CIRC * 0.75;

  const fill   = Math.min(1, Math.max(0, score));
  const offset = ARC - fill * ARC;
  const cx = size / 2, cy = size / 2;
  const strokeWidth = Math.max(5, Math.round(size * 0.075));

  const breached  = cbActive || score >= threshold;
  const elevated  = !breached && score >= threshold * 0.65;
  const color      = breached ? 'var(--ember)' : elevated ? 'var(--amber)' : 'var(--sage)';
  const stateLabel = cbActive ? 'BREACHED' : score >= threshold ? 'ELEVATED' : 'ANOMALY';

  const pct = Math.round(fill * 100);
  const pctFontSize = Math.max(14, Math.min(22, Math.round(size * 0.205)));

  // Same 270deg sweep convention as HealthGauge: the arc (pre-rotation) runs
  // from angle 0 through 270deg, then the whole thing is rotated 135deg. So a
  // fraction f along the arc sits at screen angle (135 + f*270) degrees,
  // measured clockwise from the positive x-axis.
  const tf  = Math.min(1, Math.max(0, threshold));
  const rad = ((135 + tf * 270) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const tickInner = R + 2;
  const tickOuter = R + 7;
  const tx1 = cx + tickInner * cos, ty1 = cy + tickInner * sin;
  const tx2 = cx + tickOuter * cos, ty2 = cy + tickOuter * sin;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth={strokeWidth}
          strokeDasharray={`${ARC} ${CIRC}`} strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${ARC} ${CIRC}`} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
          className="gauge-ring" />
        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2}
          stroke="var(--text-faint)" strokeWidth={2} strokeLinecap="round" />
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: pctFontSize, fontWeight: 600, fill: color, fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: 7.5, letterSpacing: '0.07em', fill: 'var(--text-faint)', textTransform: 'uppercase' }}>
          {stateLabel}
        </text>
      </svg>
    </div>
  );
}
