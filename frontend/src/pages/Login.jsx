import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Turnstile from '../Turnstile.jsx';
export default function Login() {
 const { login, register } = useAuth();
 const go = useNavigate();
 const [mode, setMode] = useState('login');
 const [f, setF] = useState({ fullName: '', email: '', password: '', role: 'student', inviteCode: '' });
 const [token, setToken] = useState('');
 const [err, setErr] = useState('');
 const [busy, setBusy] = useState(false);
 const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
 async function submit(e) {
 e.preventDefault(); setErr('');
 if (mode === 'register' && !token) return setErr('Please complete the bot check first.');
 setBusy(true);
 try {
 if (mode === 'login') await login(f.email, f.password);
 else await register(f, token);
 go('/courses');
 } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
 }
 return (
 <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
 <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
 <form onSubmit={submit}>
 {mode === 'register' && (<>
 <label>Full name</label><input value={f.fullName} onChange={set('fullName')} required />
 <label>Role</label>
 <select value={f.role} onChange={set('role')}>
 <option value="student">Student</option><option value="instructor">Instructor</option>
 </select>
 {f.role === 'instructor' && (<><label>Instructor invite code</label>
 <input value={f.inviteCode} onChange={set('inviteCode')} /></>)}
 </>)}
 <label>Email</label><input type="email" value={f.email} onChange={set('email')} required />
 <label>Password</label><input type="password" value={f.password} onChange={set('password')} required />
 {mode === 'register' && <Turnstile onToken={setToken} />}
 {err && <div className="msg-err">{err}</div>}
 <button disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Register'}</button>{' '}
 <button type="button" className="secondary" onClick={() => { setMode(mode === 'login' ? 'register' :
 'login'); setErr(''); }}>
 {mode === 'login' ? 'Need an account?' : 'I have an account'}</button>
 </form>
 </div>
 );
}