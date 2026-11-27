import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
export default function Grade() {
 const { id } = useParams();
 const [d, setD] = useState(null);
 const [marks, setMarks] = useState({});
 const [comments, setComments] = useState({});
 const [feedback, setFeedback] = useState('');
 const [hist, setHist] = useState([]);
 const [msg, setMsg] = useState(null);
 const load = () => api(`/api/grading/${id}`).then((r) => {
 setD(r);
 if (r.grade) {
 setMarks(Object.fromEntries(r.grade.scores.map((s) => [s.criterionId, s.marks])));
 setComments(Object.fromEntries(r.grade.scores.map((s) => [s.criterionId, s.comment])));
 setFeedback(r.grade.feedback);
 }
 }).catch((e) => setMsg({ err: e.message }));
 useEffect(() => { load(); api(`/api/grading/${id}/history`).then(setHist).catch(() => {}); }, [id]);
 async function save() {
 setMsg(null);
 const scores = d.rubric.map((c) => ({ criterionId: c.id, marks: Number(marks[c.id] ?? 0), comment: comments[c.id]
 || '' }));
 try {
 const r = await api(`/api/grading/${id}`, { method: 'PUT', body: { scores, feedback } });
 setMsg({ ok: `Draft saved. Raw ${r.rawMarks}, late penalty ${r.latePenalty.percent}% (${r.latePenalty.amount}),
 final ${r.finalMarks}/${r.maxMarks}.` });
 load(); api(`/api/grading/${id}/history`).then(setHist);
 } catch (e) { setMsg({ err: e.message }); }
 }
 async function publish() {
 try {
 await api(`/api/grading/${id}/publish`, { method: 'POST' });
 setMsg({ ok: 'Result published to the student.' });
 load();
 } catch (e) {
 setMsg({ err: e.message });
 }
 }
 if (!d) return <div className="card">{msg ? <div className="msg-err">{msg.err}</div> : 'Loading...'}</div>;
 const s = d.submission;
 return (<>
 <div className="card"><h2>{s.studentName}: {s.title}</h2>
 <p>Attempt {s.attemptNo} | {s.fileName} | submitted {new Date(s.submittedAt).toLocaleString()} {s.isLate &&
 <b>(LATE; {s.latePenaltyPercent}% per started day)</b>}</p>
 {!d.isLatestAttempt && <div className="msg-err">This is not the latest attempt; it cannot be graded.</div>}
 {d.grade && <p>Status: <span className="tag">{d.grade.status}</span> final {d.grade.finalMarks}</p>}</div>
 <div className="card"><h3>Rubric</h3>
 {d.rubric.map((c) => (<div className="row" key={c.id}>
 <div><label>{c.name} (max {c.maxMarks})</label>
 <input type="number" min="0" max={c.maxMarks} step="0.5" value={marks[c.id] ?? ''} onChange={(e) =>
 setMarks({ ...marks, [c.id]: e.target.value })} /></div>
 <div><label>Comment</label><input value={comments[c.id] || ''} onChange={(e) => setComments({ ...comments,
 [c.id]: e.target.value })} /></div></div>))}
 <label>Written feedback (required)</label><textarea rows="4" value={feedback} onChange={(e) =>
 setFeedback(e.target.value)} />
 {msg && <div className={msg.err ? 'msg-err' : 'msg-ok'}>{msg.err || msg.ok}</div>}
 <p><button onClick={save}>Save draft</button>{' '}<button className="secondary" onClick={publish}
 disabled={!d.grade}>Publish</button></p></div>
 <div className="card"><h3>Grade history</h3>{hist.length === 0 ? <p>No earlier versions.</p> :
 <table><tbody>{hist.map((h, i) => <tr key={i}><td>{new
 Date(h.recordedAt).toLocaleString()}</td><td>{h.previousStatus}</td><td>final
 {h.finalMarks}</td><td>{h.feedback}</td></tr>)}</tbody></table>}</div>
 </>);
}
