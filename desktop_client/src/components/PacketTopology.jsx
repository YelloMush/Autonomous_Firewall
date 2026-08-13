import React, { useEffect, useRef, useState } from 'react';

const SAGE  = '#6A9479';
const EMBER = '#B36A55';
const AMBER = '#b45309';

const VB_W = 420;
const VB_H = 108;
const NODE_Y = 52;
const NODE_X = [30, 150, 270, 390];
const BARRIER_X = 90; // between Ingress (30) and SQS Buffer (150)
const NODE_R = 15;

const NODES = [
  { label: 'INGRESS' },
  { label: 'SQS BUFFER' },
  { label: 'ISOFOREST AI' },
  { label: 'CLEAN ORIGIN' },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let nextId = 1;

export default function PacketTopology({ score = 0, entropy = 8, cbActive = false, packetRate = 0 }) {
  const [tick, setTick] = useState(0); // forces re-render; particle data itself lives in the ref
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const spawnAccRef = useRef(0);
  const reducedRef = useRef(prefersReducedMotion());

  // Live-updating refs so the animation loop (started once) always reads current props.
  const scoreRef = useRef(score);       scoreRef.current = score;
  const cbRef    = useRef(cbActive);    cbRef.current    = cbActive;
  const rateRef  = useRef(packetRate);  rateRef.current  = packetRate;

  useEffect(() => {
    if (reducedRef.current) return; // static fallback rendered below, no rAF loop needed

    const frame = (now) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;

      const rate  = rateRef.current;
      const cb    = cbRef.current;
      const sc    = scoreRef.current;

      // Spawn: busier traffic (higher packetRate) spawns particles faster.
      const spawnPerSec = 4 + rate * 16;
      spawnAccRef.current += spawnPerSec * dt;
      const redFraction = Math.max(0, Math.min(0.92, sc - 0.05));
      while (spawnAccRef.current >= 1 && particlesRef.current.length < 42) {
        spawnAccRef.current -= 1;
        particlesRef.current.push({
          id: nextId++,
          t: 0,
          speed: 0.35 + Math.random() * 0.25 + rate * 0.25,
          lane: (Math.random() - 0.5) * 6,
          bad: Math.random() < redFraction,
          opacity: 1,
          barred: false,
        });
      }

      const barrierT = BARRIER_X / VB_W;
      particlesRef.current = particlesRef.current.filter(p => {
        if (p.barred) {
          p.opacity -= dt * 2.2;
          return p.opacity > 0;
        }
        p.t += p.speed * dt;
        if (cb && p.bad && p.t >= barrierT - 0.01) {
          p.barred = true;
          p.t = barrierT;
        }
        return p.t < 1;
      });

      setTick(v => (v + 1) % 1000000);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const isoColor = cbActive || score >= 0.6 ? EMBER : score >= 0.35 ? AMBER : SAGE;
  const sqsPulseR = NODE_R + 5 + packetRate * 11 + (reducedRef.current ? 0 : Math.sin(Date.now() / 480) * 1.5 * packetRate);

  return (
    <div style={{ position: 'relative' }}>
      {cbActive && (
        <div className="fade-in" style={{
          position: 'absolute', top: -2, right: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--ember-light)', border: '1px solid var(--ember-border)',
          borderRadius: 3, padding: '2px 7px',
        }}>
          <span className="dot dot-blink" style={{ background: EMBER }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.02em', color: EMBER }}>
            AUTONOMOUS MITIGATION ACTIVE — BOTO3 NACL RULE INJECTED
          </span>
        </div>
      )}

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100" style={{ display: 'block', overflow: 'visible' }}>
        {/* Connector lines */}
        {[0, 1, 2].map(i => (
          <line key={i}
            x1={NODE_X[i] + NODE_R} y1={NODE_Y} x2={NODE_X[i + 1] - NODE_R} y2={NODE_Y}
            stroke="var(--border-mid)" strokeWidth="1.5"
          />
        ))}

        {/* SQS shock-absorption ring */}
        <circle cx={NODE_X[1]} cy={NODE_Y} r={sqsPulseR} fill="none"
          stroke={isoColor} strokeOpacity="0.28" strokeWidth="2"
          style={{ transition: 'stroke 400ms' }} />

        {/* Particles */}
        {!reducedRef.current && particlesRef.current.map(p => {
          const x = NODE_X[0] + p.t * (NODE_X[3] - NODE_X[0]);
          const y = NODE_Y + p.lane;
          const color = p.bad ? EMBER : SAGE;
          return (
            <circle key={p.id} cx={x} cy={y} r={p.bad ? 2.6 : 2.2}
              fill={color} opacity={p.opacity} />
          );
        })}

        {/* Reduced-motion fallback: a few static dots hinting at flow direction, no animation */}
        {reducedRef.current && [0, 1, 2].map(i => (
          <circle key={i}
            cx={(NODE_X[i] + NODE_X[i + 1]) / 2} cy={NODE_Y} r="2.2"
            fill={cbActive && i === 0 ? EMBER : SAGE} opacity="0.6" />
        ))}

        {/* NACL blast door — slides down between Ingress and SQS Buffer */}
        <g style={{
          transform: cbActive ? 'translateY(0px)' : 'translateY(-60px)',
          opacity: cbActive ? 1 : 0,
          transition: 'transform 450ms var(--ease-spring), opacity 300ms',
        }}>
          <rect x={BARRIER_X - 3} y={NODE_Y - 17} width="6" height="34" rx="2"
            fill={EMBER} />
          <rect x={BARRIER_X - 3} y={NODE_Y - 17} width="6" height="34" rx="2"
            fill="none" stroke="var(--bg-app)" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
        </g>

        {/* Nodes */}
        {NODES.map((n, i) => {
          const fill = i === 2 ? isoColor : (i === 0 && cbActive ? EMBER : 'var(--bg-surface)');
          const stroke = i === 2 ? isoColor : (i === 0 && cbActive ? EMBER : 'var(--border-mid)');
          const textColor = i === 2 ? '#fff' : 'var(--text-faint)';
          return (
            <g key={n.label}>
              <circle cx={NODE_X[i]} cy={NODE_Y} r={NODE_R}
                fill={i === 2 ? fill : 'var(--bg-surface)'}
                stroke={stroke} strokeWidth="1.5"
                style={{ transition: 'fill 400ms, stroke 400ms' }} />
              <text x={NODE_X[i]} y={NODE_Y + 3} textAnchor="middle"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: i === 2 ? '#fff' : 'var(--text-muted)', fontWeight: 600 }}>
                {i === 1 ? '⇄' : i === 2 ? 'AI' : i === 0 ? '↗' : '✓'}
              </text>
              <text x={NODE_X[i]} y={NODE_Y + NODE_R + 12} textAnchor="middle"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 7, letterSpacing: '0.05em', fill: 'var(--text-faint)', textTransform: 'uppercase' }}>
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
