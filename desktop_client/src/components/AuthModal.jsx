import React, { useState, useEffect } from 'react';
import { isValidEmail } from '../hooks/useAuth';

export default function AuthModal({ open, onClose, onAuthed, lookupEmail, signIn, signUp }) {
  const [tab, setTab]         = useState('signin'); // explicit tab choice — may be auto-flipped by email lookup
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [tier, setTier]       = useState('shield');
  const [error, setError]     = useState('');
  const [switched, setSwitched] = useState(null); // transient "we switched you to X" note
  const [busy, setBusy]       = useState(false);
  const [knownUser, setKnownUser] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(''); setPassword(''); setName(''); setTier('shield'); setError(''); setSwitched(null); setTab('signin');
  }, [open]);

  useEffect(() => {
    if (!isValidEmail(email)) { setKnownUser(false); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      lookupEmail(email).then(exists => { if (!cancelled) setKnownUser(exists); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [email, lookupEmail]);

  useEffect(() => {
    if (!isValidEmail(email)) { setSwitched(null); return; }
    if (knownUser && tab !== 'signin') { setTab('signin'); setSwitched('Welcome back — this email already has an account.'); }
    else if (!knownUser && tab !== 'signup') { setTab('signup'); setSwitched('New email — let’s set up your account.'); }
    else setSwitched(null);
  }, [knownUser]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) { setError('Enter a valid email address.'); return; }

    setBusy(true);
    const result = tab === 'signin'
      ? await signIn({ email, password })
      : await signUp({ name, email, password, tier });
    setBusy(false);

    if (!result.ok) { setError(result.error); return; }
    onAuthed?.(result.user);
    onClose();
  };

  return (
    <div className="palette-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette-panel glass-panel" style={{ maxWidth: 360 }}>
        <div style={{ display: 'flex' }}>
          {['signin', 'signup'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--bg-subtle)' : 'transparent',
                borderBottom: `2px solid ${tab === t ? 'var(--sage)' : 'var(--border)'}`,
                fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {tab === 'signin' ? 'Welcome back' : 'Create your Aegis account'}
          </div>

          {switched && (
            <div style={{ fontSize: 10, color: 'var(--amber)', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 3, padding: '4px 7px' }}>
              {switched}
            </div>
          )}

          <div>
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" value={email} autoFocus disabled={busy}
              placeholder="you@company.com" onChange={e => setEmail(e.target.value)} />
          </div>

          {tab === 'signup' && (
            <div>
              <label className="form-label">Full name</label>
              <input className="form-input" value={name} placeholder="Ada Lovelace" disabled={busy} onChange={e => setName(e.target.value)} />
            </div>
          )}

          <div>
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} disabled={busy}
              placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
              onChange={e => setPassword(e.target.value)} />
          </div>

          {tab === 'signup' && (
            <div>
              <label className="form-label">Tier</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { id: 'shield',     label: 'Aegis Shield',     desc: 'Individual · edge proxy' },
                  { id: 'enterprise', label: 'Aegis Enterprise', desc: 'Private VPC · IaC' },
                ].map(o => (
                  <button key={o.id} type="button" onClick={() => setTier(o.id)} disabled={busy}
                    className="surface-sub"
                    style={{
                      textAlign: 'left', padding: '6px 8px', cursor: 'pointer',
                      border: `1px solid ${tier === o.id ? 'var(--sage)' : 'var(--border)'}`,
                      background: tier === o.id ? 'var(--sage-light)' : 'var(--bg-subtle)',
                    }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: 10, color: 'var(--ember)' }}>{error}</div>}

          <button type="submit" className="btn btn-sage" disabled={busy || !email || !password} style={{ justifyContent: 'center', marginTop: 2 }}>
            {busy ? (tab === 'signin' ? 'Signing in…' : 'Creating account…') : (tab === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
