import React from 'react';

// "AI is thinking" indicator. Deliberately NOT a circular loading spinner —
// a slowly-rotating triangular lattice (outer triangle + midpoint triangle,
// forming 4 smaller triangular facets), evoking a scholarly instrument
// rather than a web spinner. Rotation is handled entirely by the global
// .lattice-spinner CSS class (latticeRotate 8s linear infinite), which is
// already reduced-motion-safe via the app's global media query.
function LatticeGlyph({ size = 28 }) {
  return (
    <svg
      className="lattice-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ color: 'var(--text-muted)', display: 'block' }}
    >
      <polygon points="12,2.5 21.5,19 2.5,19" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points="12,10.75 16.75,19 7.25,19" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <line x1="12" y1="2.5" x2="12" y2="10.75" stroke="currentColor" strokeWidth="1" />
      <line x1="21.5" y1="19" x2="16.75" y2="19" stroke="currentColor" strokeWidth="1" />
      <line x1="2.5" y1="19" x2="7.25" y2="19" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function LatticeSpinner({ size = 28, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <LatticeGlyph size={size} />
      {label && (
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 9,
            letterSpacing: '0.04em',
            color: 'var(--text-faint)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
