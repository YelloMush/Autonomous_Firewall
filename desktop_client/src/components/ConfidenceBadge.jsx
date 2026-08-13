import React from 'react';

// Small inline badge translating a raw 0..1 anomaly score into a
// plain-language confidence tier, aligned to the same threshold the AI
// circuit breaker uses elsewhere in the app.
export default function ConfidenceBadge({ score = 0, threshold = 0.6 }) {
  const safeScore = Number.isFinite(score) ? score : 0;
  const fill = Math.min(1, Math.max(0, safeScore));

  const tier = fill >= threshold ? 'high' : fill >= threshold * 0.65 ? 'mid' : 'low';
  const label = tier === 'high' ? 'High confidence' : tier === 'mid' ? 'Elevated' : 'Nominal';
  const pct = Math.round(fill * 100);

  return (
    <span className={`confidence-badge confidence-${tier}`}>
      {label}
      <span style={{ fontFamily: 'JetBrains Mono, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }}>· {pct}%</span>
    </span>
  );
}
