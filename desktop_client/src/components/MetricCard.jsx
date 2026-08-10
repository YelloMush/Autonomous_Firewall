import React from 'react';

export default function MetricCard({ label, value, unit, sub, colour, barFill, alert: isAlert }) {
  return (
    <div className={`card p-5 flex flex-col gap-3 transition-all duration-500 ${
      isAlert ? 'border-ember' : ''
    }`}>
      <div className="metric-label">{label}</div>
      <div className="flex items-end gap-1.5">
        <span className="metric-value" style={{ color: colour ?? '#1c1917' }}>{value ?? '—'}</span>
        {unit && <span className="text-sm text-stone-400 mb-0.5 font-sans">{unit}</span>}
      </div>
      {/* Bar */}
      {barFill !== undefined && (
        <div className="h-px bg-stone-100 relative rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, barFill * 100).toFixed(1)}%`, background: colour ?? '#78716c' }}
          />
        </div>
      )}
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
