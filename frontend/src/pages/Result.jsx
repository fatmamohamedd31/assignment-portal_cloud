import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
export default function Result() {
 const { id } = useParams();
 const [r, setR] = useState(null);
 const [err, setErr] = useState('');
 useEffect(() => { api(`/api/grading/mine/${id}`).then(setR).catch((e) => setErr(e.message)); }, [id]);
 if (err) return <div className="card"><div className="msg-err">{err}</div></div>;
 if (!r) return <div className="card">Loading...</div>;
 return (
 <div className="card"><h2>Result: {r.finalMarks} / {r.maxMarks}</h2>
 <p>Raw marks {r.rawMarks}, late penalty {r.latePenalty}. Published {new
 Date(r.publishedAt).toLocaleString()}.</p>
 <table><thead><tr><th>Criterion</th><th>Marks</th><th>Comment</th></tr></thead>
 <tbody>{r.breakdown.map((b) => <tr key={b.name}><td>{b.name}</td><td>{b.marks} /
 {b.maxMarks}</td><td>{b.comment}</td></tr>)}</tbody></table>
 <h3>Feedback</h3><p>{r.feedback}</p>
 </div>
 );
}
