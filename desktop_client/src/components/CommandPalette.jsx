import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';

const COMMANDS = [
  { id: 'overview',  label: 'Go to Overview',        group: 'Navigate', icon: '⌂' },
  { id: 'deploy',    label: 'Go to 1-Click Deploy',  group: 'Navigate', icon: '☁' },
  { id: 'telemetry', label: 'Go to Live Telemetry',  group: 'Navigate', icon: '∿' },
  { id: 'tools',     label: 'Go to Advanced Tools',  group: 'Navigate', icon: '⚒' },
];

export default function CommandPalette({ open, onClose, setTab }) {
  const { dark, toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const all = [
      ...COMMANDS,
      { id: 'theme', label: dark ? 'Switch to Light Mode' : 'Switch to Dark Mode', group: 'Preferences', icon: dark ? '☀' : '☽' },
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter(c => c.label.toLowerCase().includes(q)) : all;
  }, [query, dark]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => { setIndex(0); }, [query]);

  const run = (item) => {
    if (!item) return;
    if (item.id === 'theme') toggle();
    else setTab(item.id);
    onClose();
  };

  // Bound to window (not a focused descendant) so Escape/arrows always work,
  // regardless of what has DOM focus when the palette was opened.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(items.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); run(items[index]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, index]);

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette-panel glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to a tab or run a command…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}
          />
          <kbd style={{ fontSize: 9, color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: 2, padding: '1px 4px' }}>esc</kbd>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-faint)' }}>No matches.</div>
          ) : items.map((item, i) => (
            <div
              key={item.id}
              className={`palette-result ${i === index ? 'selected' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(item)}
            >
              <span style={{ width: 14, textAlign: 'center', color: 'var(--text-faint)' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.group}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
