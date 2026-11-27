import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
export default function Assignments() {
const { user } = useAuth();
const [params] = useSearchParams();
const [cat, setCat] = useState('');
const [rows, setRows] = useState([]);
const [msg, setMsg] = useState(null);
const courseId = params.get('courseId') || '';
const load = () => {
const q = new URLSearchParams();
if (cat) q.set('category', cat);
if (courseId) q.set('courseId', courseId);
api('/api/assignments?' + q).then(setRows).catch((e) => setMsg({ err: e.message }));
};
useEffect(load, [cat, courseId]);
async function act(label, fn) {
setMsg(null);
try { setMsg({ ok: await fn() || label + ' done.' }); load(); } catch (e) { setMsg({ err: e.message }); }
}
const remove = (a) => {
if (!confirm(`Delete "${a.title}"?`)) return;
act('Deleted', async () => {
try { await api(`/api/assignments/${a.id}`, { method: 'DELETE' }); }
catch (e) {
if (!/force=true/.test(e.message) || !confirm(e.message + '\nDelete everything?')) throw e;
await api(`/api/assignments/${a.id}?force=true`, { method: 'DELETE' });
}
});
};
return (<>
<div className="card row">
<div><label>Show</label>
<select value={cat} onChange={(e) => setCat(e.target.value)}>
<option value="">All</option>
{user.role === 'instructor' && <option value="draft">Drafts</option>}
<option value="upcoming">Upcoming</option><option value="active">Active</option><option
value="past">Past</option>
</select></div>
{user.role === 'instructor' && <Link className="btn" to="/assignments/new">+ New assignment</Link>}
</div>
{msg && <div className={msg.err ? 'msg-err' : 'msg-ok'}>{msg.err || msg.ok}</div>}
{rows.length === 0 && <div className="card">No assignments to show.</div>}
{rows.map((a) => (
<div className="card" key={a.id}>
<h3>{a.title} <span className="tag">{a.category}</span> <span className="tag">{a.courseCode}</span></h3>
<p>{a.description}</p>
<p>Opens {new Date(a.openAt).toLocaleString()} | Due {new Date(a.deadline).toLocaleString()} | {a.maxMarks}
marks</p>
{user.role === 'student' && <Link className="btn" to={`/submit/${a.id}`}>Submit / view</Link>}
{user.role === 'instructor' && (<div className="row" style={{ justifyContent: 'flex-start' }}>
<Link className="btn" to={`/assignments/${a.id}/edit`}>Edit</Link>
<Link className="btn" to={`/submissions/${a.id}`}>Submissions</Link>
{a.status === 'draft' && <button onClick={() => act('Published', async () => { await
api(`/api/assignments/${a.id}/publish`, { method: 'POST' }); })}>Publish</button>}
{a.status === 'published' && <button className="secondary" onClick={() => act('', async () => {
const r = await api(`/api/assignments/${a.id}/remind`, { method: 'POST' }); return `${r.notified}
reminder(s) sent.`; })}>Send reminders</button>}
<button className="danger" onClick={() => remove(a)}>Delete</button></div>)}
</div>))}
</>);
}