import React from 'react';

export default function SegmentedBar({ value = 0, segments = 12, color = 'var(--sage)', trackColor = 'var(--border)' }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const ratio = Math.max(0, Math.min(1, safeValue));
  const litCount = Math.round(ratio * segments);

  const cells = [];
  for (let i = 0; i < segments; i++) {
    const lit = i < litCount;
    cells.push(
      <div
        key={i}
        className="entropy-seg"
        style={{
          background: lit ? color : trackColor,
          opacity: lit ? 1 : 0.5,
        }}
      />
    );
  }

  return (
    <div className="entropy-strip">
      {cells}
    </div>
  );
}
