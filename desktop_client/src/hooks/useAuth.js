import { useState, useCallback } from 'react';

// Accounts are stored server-side (SQLite, on the same FastAPI process this
// app spawns as its backend), so signing up here also lets you log straight
// into web_dashboard/pitch.html with the same credentials — no separate
// account needed per surface. localStorage only remembers which already-
// authenticated user this machine last was, for UI convenience.
const API_BASE = 'http://localhost:8000';
const SESSION_KEY = 'aegis-auth-session';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const NETWORK_ERROR = { ok: false, error: 'Could not reach the Aegis Core backend on :8000.' };

export function isValidEmail(email) {
  return EMAIL_RE.test(email.trim());
}

async function apiSignUp({ name, email, password, tier }) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, tier }),
    });
    return await res.json();
  } catch (_) {
    return NETWORK_ERROR;
  }
}

async function apiSignIn({ email, password }) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return await res.json();
  } catch (_) {
    return NETWORK_ERROR;
  }
}

export async function lookupEmail(email) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/lookup?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    return !!data.exists;
  } catch (_) {
    return false;
  }
}

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  });

  const persist = (u) => {
    setUser(u);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch (_) {}
  };

  const signUp = useCallback(async ({ name, email, password, tier }) => {
    const result = await apiSignUp({ name, email, password, tier });
    if (result.ok) persist(result.user);
    return result;
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const result = await apiSignIn({ email, password });
    if (result.ok) persist(result.user);
    return result;
  }, []);

  const signOut = useCallback(() => {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    setUser(null);
  }, []);

  return { user, signIn, signUp, signOut, lookupEmail };
}
