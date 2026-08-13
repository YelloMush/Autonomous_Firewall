import React, { useState, useEffect, useRef } from 'react';

function formatValue(value, decimals) {
  const n = Number.isFinite(value) ? value : 0;
  if (decimals > 0) return n.toFixed(decimals);
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  return n.toFixed(0);
}

export default function TickNumber({ value = 0, decimals = 0, duration = 450, className = '', style = {} }) {
  const [displayed, setDisplayed] = useState(value);
  const [tick, setTick] = useState(0);
  const rafRef = useRef(null);
  const fromRef = useRef(value);
  const mountedOnceRef = useRef(false);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Seed silently on mount — the pulse should only ever announce a change,
    // never the initial value, and only when the value itself moved (not
    // when duration/className/style change, which don't affect the number).
    if (!mountedOnceRef.current) {
      mountedOnceRef.current = true;
      fromRef.current = value;
      setDisplayed(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    setTick((t) => t + 1);

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      fromRef.current = value;
      setDisplayed(value);
      return;
    }

    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;

      if (t >= 1) {
        fromRef.current = to;
        setDisplayed(to);
        rafRef.current = null;
        return;
      }

      setDisplayed(current);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const text = formatValue(displayed, decimals);

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      <span key={tick} className="value-tick">{text}</span>
    </span>
  );
}
