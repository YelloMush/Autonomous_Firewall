import React, { createContext, useContext, useState, useCallback } from 'react';

const ThemeCtx = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    // Persist across sessions
    return localStorage.getItem('aegis-theme') === 'dark';
  });

  const toggle = useCallback(() => {
    setDark(d => {
      const next = !d;
      localStorage.setItem('aegis-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      <div className={dark ? 'dark' : ''} style={{ height: '100%' }}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}

export function useTheme() { return useContext(ThemeCtx); }
