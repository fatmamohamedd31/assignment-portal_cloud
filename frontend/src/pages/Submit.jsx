import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Turnstile from '../Turnstile.jsx';
export default function Submit() {
const { id } = useParams();
const [a, setA] = useState(null);
const [hist, setHist] = useState([]);
const [file, setFile] = useState(null);
const [comment, setComment] = useState('');
const [token, setToken] = useState('');
const [msg, setMsg] = useState(null);
const [busy, setBusy] = useState(false);
const load = () => {
api(`/api/assignments/${id}`).then(setA).catch((e) => setMsg({ err: e.message }));
api(`/api/submissions/history/${id}`).then(setHist).catch(() => {});
};
useEffect(load, [id]);
async function upload(e) {
e.preventDefault(); setMsg(null);
if (!file) return setMsg({ err: 'Choose a file first.' });
if (!token) return setMsg({ err: 'Please complete the bot check first.' });
const form = new FormData(); // multipart form: file + text fields
form.append('assignmentId', id); form.append('comment', comment); form.append('file', file);
setBusy(true);
try {
const r = await api('/api/submissions', { method: 'POST', form, turnstile: token });
setMsg({ ok: `${r.message} Attempt ${r.attemptNo}, saved ${new Date(r.submittedAt).toLocaleString()}${r.isLate
? ' (LATE)' : ''}.` });
setFile(null); setComment(''); load();
} catch (ex) { setMsg({ err: ex.message }); } finally { setBusy(false); }
}
if (!a) return <div className="card">{msg ? <div className="msg-err">{msg.err}</div> : 'Loading...'}</div>;
return (<> <div className="card">
<h2>{a.title} <span className="tag">{a.category}</span></h2>
<p>{a.description}</p>{a.instructions && <p><b>Instructions:</b> {a.instructions}</p>}
<p>Due {new Date(a.deadline).toLocaleString()} | {a.maxMarks} marks | up to {a.maxAttempts} attempts | files:
{a.allowedExtensions.join(', ')} (max {a.maxFileMb} MB)</p>
<p>Late penalty: {a.allowLate ? `${a.latePenaltyPercent}% per started day` : 'late submissions not accepted'}</p>
<Link to={`/result/${id}`}>View published result</Link>
</div>
<div className="card"><h3>Upload</h3>
<form onSubmit={upload}>
<label>File</label><input type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
<label>Comment (optional)</label><input value={comment} onChange={(e) => setComment(e.target.value)}
maxLength={500} />
<Turnstile onToken={setToken} />
{msg && <div className={msg.err ? 'msg-err' : 'msg-ok'}>{msg.err || msg.ok}</div>}
<button disabled={busy}>{busy ? 'Uploading...' : 'Submit'}</button>
</form></div>
<div className="card"><h3>Attempt history</h3>
{hist.length === 0 ? <p>No attempts yet.</p> :
<table><thead><tr><th>#</th><th>File</th><th>When</th><th>Late</th></tr></thead>
<tbody>{hist.map((h) => <tr key={h.id}><td>{h.attemptNo}</td><td>{h.fileName}</td>
<td>{new Date(h.submittedAt).toLocaleString()}</td><td>{h.isLate ? 'yes' :
'no'}</td></tr>)}</tbody></table>}
</div>
</>);
}