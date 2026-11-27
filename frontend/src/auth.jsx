import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
 const [user, setUser] = useState(null);
 const [ready, setReady] = useState(false);
 useEffect(() => {
 if (!localStorage.getItem('token')) return setReady(true);
 api('/api/auth/me').then((r) => setUser(r.user)).catch(() => localStorage.removeItem('token'))
 .finally(() => setReady(true));
 }, []);
 const accept = (r) => { localStorage.setItem('token', r.token); setUser(r.user); };
 const login = async (email, password) => accept(await api('/api/auth/login', { method: 'POST', body: { email,
 password } }));
 const register = async (body, turnstile) =>
 accept(await api('/api/auth/register', { method: 'POST', body, turnstile }));
 const logout = () => { localStorage.removeItem('token'); setUser(null); };
 return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}