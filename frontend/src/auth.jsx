import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logoutLocal = useCallback(() => { tokenStore.set(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logoutLocal);
    if (!tokenStore.get()) { setReady(true); return; }
    api.get('/auth/me').then(setUser).catch(() => tokenStore.set(null)).finally(() => setReady(true));
  }, [logoutLocal]);

  const login = async (role, loginId, password) => {
    const me = await api.post('/auth/login', { role, loginId, password });
    tokenStore.set(me.token);
    setUser(me);
    return me;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be gone */ }
    logoutLocal();
  };

  const patch = (changes) => setUser((u) => ({ ...u, ...changes }));

  return <AuthContext.Provider value={{ user, ready, login, logout, patch }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
