import React, { useState, useEffect } from 'react';

const STAGES = [
  'Initializing backend…',
  'Loading AI core…',
  'Connecting telemetry…',
  'Armed.',
];

// 180° speedometer arc geometry
const R = 60;
const CIRC = Math.PI * R; // half-circle

export default function SplashScreen({ onDone }) {
  const [stage, setStage]     = useState(0);
  const [arcPct, setArcPct]   = useState(0);
  const [fading, setFading]   = useState(false);
  const [titleIn, setTitleIn] = useState(false);
  const [subIn, setSubIn]     = useState(false);
  const [gaugeIn, setGaugeIn] = useState(false);

  useEffect(() => {
    // Shield draw-on completes at ~1.2s, then cascade
    const t1 = setTimeout(() => setTitleIn(true),  800);
    const t2 = setTimeout(() => setSubIn(true),    900);
    const t3 = setTimeout(() => setGaugeIn(true), 1000);

    // Arc progress over 2.5s (1.0s–3.5s), cycling stages
    let current = 0;
    const TOTAL = 2500;
    const TICK  = 80;
    const start = Date.now() + 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 0) return;
      const pct = Math.min(1, elapsed / TOTAL);
      setArcPct(pct);
      const newStage = Math.min(STAGES.length - 1, Math.floor(pct * STAGES.length));
      if (newStage !== current) { current = newStage; setStage(newStage); }
      if (pct >= 1) clearInterval(interval);
    }, TICK);

    // Fade out at 3.5s
    const t4 = setTimeout(() => setFading(true),  3500);
    const t5 = setTimeout(() => onDone && onDone(), 3900);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearInterval(interval); };
  }, [onDone]);

  const arcLen = CIRC * arcPct;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg-app)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Shield SVG line-art */}
      <svg
        width="48" height="56" viewBox="0 0 48 56"
        fill="none"
        style={{ marginBottom: 14, display: 'block' }}
      >
        <path
          d="M24 2 L44 10 L44 28 C44 40 34 50 24 54 C14 50 4 40 4 28 L4 10 Z"
          stroke="var(--text-faint)" strokeWidth="1.5" strokeLinejoin="round"
          fill="none"
          strokeDasharray="280" strokeDashoffset="280"
          style={{
            animation: 'shieldDraw 1.2s ease-in-out both',
            animationFillMode: 'forwards',
          }}
        />
        <path
          d="M18 28 L22 32 L30 22"
          stroke="var(--sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          fill="none"
          strokeDasharray="30" strokeDashoffset="30"
          style={{ animation: 'shieldDraw 0.5s 1.1s ease-out both' }}
        />
      </svg>

      {/* Title */}
      <div style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: 22, fontWeight: 600,
        color: 'var(--text-primary)',
        letterSpacing: '-0.01em',
        opacity: titleIn ? 1 : 0,
        transform: titleIn ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
        marginBottom: 4,
      }}>AEGIS</div>

      {/* Subtitle */}
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 11, color: 'var(--text-faint)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        opacity: subIn ? 1 : 0,
        transition: 'opacity 0.3s 0.1s ease-out',
        marginBottom: 32,
      }}>Autonomous Cloud Firewall</div>

      {/* Speedometer arc */}
      <div style={{ opacity: gaugeIn ? 1 : 0, transition: 'opacity 0.4s ease-out' }}>
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* Track */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            stroke="var(--border)" strokeWidth="6" fill="none" strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            stroke="var(--sage)" strokeWidth="6" fill="none" strokeLinecap="round"
            strokeDasharray={`${arcLen} ${CIRC}`}
            style={{ transition: 'stroke-dasharray 0.08s linear' }}
          />
          {/* Tick marks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const angle = Math.PI * t;
            const cx = 90 + 70 * Math.cos(Math.PI - angle);
            const cy = 90 - 70 * Math.sin(Math.PI - angle);
            const cx2 = 90 + 60 * Math.cos(Math.PI - angle);
            const cy2 = 90 - 60 * Math.sin(Math.PI - angle);
            return (
              <line key={t} x1={cx} y1={cy} x2={cx2} y2={cy2}
                stroke="var(--border-mid)" strokeWidth="1" />
            );
          })}
        </svg>

        {/* Stage label */}
        <div style={{
          textAlign: 'center', marginTop: 4,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10, color: 'var(--text-faint)',
          minHeight: 14,
          transition: 'opacity 0.2s',
        }}>
          {STAGES[stage]}
        </div>
      </div>

      {/* Version footer */}
      <div style={{
        position: 'absolute', bottom: 16,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9, color: 'var(--text-faint)',
        opacity: subIn ? 0.7 : 0, transition: 'opacity 0.5s 1s',
      }}>
        v1.0.0 · Model B · AWS IaC
      </div>
    </div>
  );
}
