import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './AuthModal';

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

export default function AccountMenu({ onTierSync }) {
  const { user, signIn, signUp, signOut, lookupEmail } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const handleAuthed = (authedUser) => {
    // Sync the app's architecture mode to whatever tier the session's
    // account is on (relevant right after signup; a no-op-ish reaffirm on
    // sign-in, which is fine — it just matches the mode to the account).
    if (authedUser && onTierSync) onTierSync(authedUser.tier === 'enterprise' ? 'B' : 'A');
  };

  if (!user) {
    return (
      <>
        <button
          className="no-drag"
          onClick={() => setModalOpen(true)}
          style={{
            border: '1px solid var(--border-mid)', background: 'transparent', cursor: 'pointer',
            padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 500,
            fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)', flexShrink: 0,
          }}
        >
          Sign In
        </button>
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} onAuthed={handleAuthed}
          lookupEmail={lookupEmail} signIn={signIn} signUp={signUp} />
      </>
    );
  }

  return (
    <div ref={wrapRef} className="no-drag" style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Account"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border-mid)',
          background: 'var(--sage-light)', color: 'var(--sage)', cursor: 'pointer',
          fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif',
        }}
      >
        {initials(user.name)}
      </button>

      {menuOpen && (
        <div className="surface glass-panel fade-in" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          width: 190, padding: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 6 }}>{user.email}</div>
          <span className={`badge ${user.tier === 'enterprise' ? 'badge-amber' : 'badge-sage'}`}>
            {user.tier === 'enterprise' ? 'Aegis Enterprise' : 'Aegis Shield'}
          </span>
          <div className="divider" style={{ margin: '8px 0' }} />
          <button
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'center', fontSize: 10 }}
            onClick={() => { signOut(); setMenuOpen(false); }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
