import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
export default function Status() {
 const [rows, setRows] = useState([]);
 const [err, setErr] = useState('');
 useEffect(() => { api('/api/submissions/status').then(setRows).catch((e) => setErr(e.message)); }, []);
 return (
 <div className="card"><h2>My submissions</h2>{err && <div className="msg-err">{err}</div>}
 <table><thead><tr><th>Assignment</th><th>Course</th><th>Due</th><th>Status</th><th>Attempts</th><th>Mark</th></tr></thead>
 <tbody>{rows.map((r) => (<tr key={r.assignmentId}>
 <td><Link to={`/submit/${r.assignmentId}`}>{r.title}</Link></td><td>{r.courseCode}</td>
 <td>{new Date(r.deadline).toLocaleString()}</td><td><span className="tag">{r.status}</span></td>
 <td>{r.attempts}/{r.maxAttempts}</td>
 <td>{r.finalMarks === null ? '-' : <Link
 to={`/result/${r.assignmentId}`}>{r.finalMarks}/{r.maxMarks}</Link>}</td></tr>))}</tbody></table>
 {rows.length === 0 && !err && <p>No published assignments yet.</p>}
 </div>
 );
}
