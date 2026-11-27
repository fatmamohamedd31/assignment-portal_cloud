import { useEffect, useState } from 'react';
import { api } from '../api.js';
export default function Notifications() {
const [data, setData] = useState({ unread: 0, items: [] });
const [err, setErr] = useState('');
const load = () => api('/api/notifications').then(setData).catch((e) => setErr(e.message));
useEffect(() => { load(); }, []);
const readOne = (n) => api(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).then(load).catch((e) =>
setErr(e.message));
const readAll = () => api('/api/notifications/read-all', { method: 'POST' }).then(load).catch((e) =>
setErr(e.message));
return (
<div className="card">
<h2>Notifications ({data.unread} unread)</h2>
{err && <div className="msg-err">{err}</div>}
<button className="secondary" onClick={readAll} disabled={!data.unread}>Mark all as read</button>
{data.items.length === 0 && <p>Nothing yet.</p>}
<table><tbody>{data.items.map((n) => (
<tr key={n.id} style={{ fontWeight: n.isRead ? 400 : 700 }}>
<td>{new Date(n.createdAt).toLocaleString()}</td><td><span
className="tag">{n.type}</span></td><td>{n.message}</td>
<td>{!n.isRead && <button onClick={() => readOne(n)}>Read</button>}</td></tr>))}</tbody></table>
</div>
);
}