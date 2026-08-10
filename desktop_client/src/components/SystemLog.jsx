import React from 'react';

export default function SystemLog({ alerts, metrics }) {
  const pkt   = metrics?.packet_count ?? 0;
  const thr   = metrics?.threshold ?? 0;
  const cbAct = metrics?.circuit_breaker_active ?? false;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto animate-fade-in">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-1">Event Log</div>
        <h2 className="font-serif text-2xl font-medium text-stone-900">System Alerts & Events</h2>
      </div>

      {/* Current state summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="metric-label mb-2">Circuit Breaker</div>
          <div className="font-serif text-xl font-medium" style={{ color: cbAct ? '#B36A55' : '#6A9479' }}>
            {cbAct ? 'ACTIVE' : 'Nominal'}
          </div>
        </div>
        <div className="card p-4">
          <div className="metric-label mb-2">Packets / Window</div>
          <div className="font-serif text-xl font-medium text-stone-900">{pkt.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="metric-label mb-2">Threshold</div>
          <div className="font-serif text-xl font-medium text-stone-900">{thr > 0 ? thr.toFixed(1) : 'Calibrating…'}</div>
        </div>
      </div>

      {/* Alert list */}
      <div className="card flex-1">
        <div className="px-5 py-3 border-b border-stone-100">
          <span className="text-xs uppercase tracking-widest text-stone-400">Alert History</span>
          <span className="ml-3 text-xs text-stone-300">{alerts.length} events</span>
        </div>
        <div className="divide-y divide-stone-50">
          {alerts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-300">No alerts recorded.</div>
          ) : (
            alerts.map(a => (
              <div key={a.id} className="flex items-baseline gap-4 px-5 py-3 hover:bg-stone-50 transition-colors">
                <span className="font-mono text-xs text-stone-300 flex-shrink-0">{a.ts}</span>
                <span className="text-sm text-stone-700 leading-relaxed">{a.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
