import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, getToken, getStoredUser, setSession, clearSession } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getToken());

  useEffect(() => {
    if (token) api.get('/me').then((r) => setUser(r.user)).catch(() => {});
  }, [token]);

  const login = useCallback(async (username, password) => {
    const r = await api.post('/login', { username, password });
    setSession(r.token, r.user);
    setToken(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);