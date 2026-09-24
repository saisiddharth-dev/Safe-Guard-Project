import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'sg-theme';
const ThemeContext = createContext(null);

const query = () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;

function resolve(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return query() ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => resolveStored());

  function resolveStored() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch (e) {}
    return 'system';
  }

  useEffect(() => {
    let mq;
    const apply = () => {
      const selected = resolve(mode);
      document.documentElement.classList.toggle('dark', selected === 'dark');
    };
    apply();
    if (mode === 'system' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply();
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode]);

  const value = useMemo(() => {
    const effective = resolve(mode);
    const set = (m) => {
      setMode(m);
      try {
        localStorage.setItem(THEME_KEY, m);
      } catch (e) {}
    };
    return {
      mode,
      theme: effective,
      isDark: effective === 'dark',
      setMode: set,
      toggle: () => set(effective === 'dark' ? 'light' : 'dark'),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);