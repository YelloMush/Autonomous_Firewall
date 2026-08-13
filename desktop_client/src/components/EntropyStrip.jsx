import React from 'react';

const MAX_BITS = 14;

export default function EntropyStrip({ entropy = 0, segments = 16 }) {
  const safeEntropy = Number.isFinite(entropy) ? entropy : 0;
  const ratio = Math.max(0, Math.min(1, safeEntropy / MAX_BITS));

  const tierColor = safeEntropy >= 6 ? 'var(--sage)' : safeEntropy >= 3 ? 'var(--amber)' : 'var(--ember)';
  const tierLabel = safeEntropy >= 6 ? 'Diverse' : safeEntropy >= 3 ? 'Moderate' : 'Narrow';

  const cells = [];
  for (let i = 0; i < segments; i++) {
    const seed = Math.sin(i * 12.9898 + safeEntropy * 78.233) * 43758.5453;
    const noise = seed - Math.floor(seed);
    const lit = noise < ratio;
    cells.push(
      <div
        key={i}
        className="entropy-seg"
        style={{
          background: lit ? tierColor : 'var(--border-mid)',
          opacity: lit ? 1 : 0.15,
        }}
      />
    );
  }

  return (
    <div>
      <div className="entropy-strip">
        {cells}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
        <span style={{ fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: 9, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
          {safeEntropy.toFixed(2)} bits
        </span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: 'var(--text-faint)' }}>&middot;</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: tierColor }}>
          {tierLabel}
        </span>
      </div>
    </div>
  );
}
