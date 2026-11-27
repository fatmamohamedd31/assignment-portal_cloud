import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, download } from '../api.js';
export default function Submissions() {
 const { id } = useParams();
  const [d, setD] = useState(null);
 const [stats, setStats] = useState(null);
 const [msg, setMsg] = useState(null);
 const load = () => {
 api(`/api/submissions/assignment/${id}`).then(setD).catch((e) => setMsg({ err: e.message }));
 api(`/api/reports/stats/${id}`).then(setStats).catch(() => {});
 };
 useEffect(load, [id]);
 async function publishAll() {
 try { const r = await api(`/api/grading/assignment/${id}/publish-all`, { method: 'POST' });
 setMsg({ ok: `${r.published} result(s) published.` }); load(); } catch (e) { setMsg({ err: e.message }); }
 }
 if (!d) return <div className="card">{msg ? <div className="msg-err">{msg.err}</div> : 'Loading...'}</div>;
 const max = stats ? Math.max(1, ...stats.distribution.map((b) => b.count)) : 1;
 return (<>
 <div className="card"><h2>{d.assignment.title}</h2>
 <p>Due {new Date(d.assignment.deadline).toLocaleString()} | {d.assignment.maxMarks} marks</p>
 <button onClick={publishAll}>Publish all draft grades</button>
 {msg && <div className={msg.err ? 'msg-err' : 'msg-ok'}>{msg.err || msg.ok}</div>}</div>
 <div className="card"><table><thead><tr><th>Student</th><th>Attempt</th><th>Submitted</th><th>Status</th><th>Mark</th><th /></tr></thead>
 <tbody>{d.students.map((s) => (<tr key={s.studentId}>
 <td>{s.studentName}</td><td>{s.attemptNo ?? '-'}</td>
 <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '-'}{s.isLate && ' (late)'}</td>
 <td><span className="tag">{s.gradingStatus}</span></td><td>{s.finalMarks ?? '-'}</td>
 <td>{s.submissionId && (<>
 <button className="secondary" onClick={() => download(`/api/submissions/${s.submissionId}/download`,
 s.fileName).catch((e) => setMsg({ err: e.message }))}>Download</button>{' '}
 <Link className="btn" to={`/grade/${s.submissionId}`}>Grade</Link></>)}</td></tr>))}</tbody></table></div>
 {stats && <div className="card"><h3>Statistics</h3>
 <p>Enrolled {stats.enrolled} | submitted {stats.submitted} | graded {stats.gradedCount} | published
 {stats.published} | not submitted {stats.notSubmitted}</p>
 <p>Average {stats.average ?? '-'} | median {stats.median ?? '-'} | highest {stats.highest ?? '-'} | lowest
 {stats.lowest ?? '-'}</p>
 {stats.distribution.map((b) => (<div key={b.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 <span style={{ width: 70 }}>{b.label}</span><div className="bar" style={{ width: `${(b.count / max) * 60}%`,
 minWidth: 2 }} /><span>{b.count}</span></div>))}
 </div>}
 </>);
}
