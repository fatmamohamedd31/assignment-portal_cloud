import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
export default function Courses() {
 const { user } = useAuth();
 const [rows, setRows] = useState([]);
 const [code, setCode] = useState('');
 const [title, setTitle] = useState('');
 const [msg, setMsg] = useState(null);
 const [students, setStudents] = useState(null);
 const load = () => api('/api/courses').then(setRows).catch((e) => setMsg({ err: e.message }));
 useEffect(() => { load(); }, []);
 async function add(e) {
 e.preventDefault(); setMsg(null);
 try {
 if (user.role === 'instructor') await api('/api/courses', { method: 'POST', body: { code, title } });
 else await api('/api/courses/enroll', { method: 'POST', body: { code } });
 setMsg({ ok: user.role === 'instructor' ? 'Course created.' : 'You are enrolled.' });
 setCode(''); setTitle(''); load();
 } catch (ex) { setMsg({ err: ex.message }); }
 }
 async function showStudents(id) {
 try { setStudents({ id, list: await api(`/api/courses/${id}/students`) }); }
 catch (ex) { setMsg({ err: ex.message }); }
 }
 return (<>
 <div className="card">
 <h2>{user.role === 'instructor' ? 'Create a course' : 'Enrol with a course code'}</h2>
 <form onSubmit={add} className="row">
 <div><label>Course code</label><input value={code} onChange={(e) => setCode(e.target.value)}
 placeholder="CLD301" /></div>
 {user.role === 'instructor' && <div><label>Title</label><input value={title} onChange={(e) =>
 setTitle(e.target.value)} /></div>}
 <button>{user.role === 'instructor' ? 'Create' : 'Enrol'}</button>
 </form>
 {msg && <div className={msg.err ? 'msg-err' : 'msg-ok'}>{msg.err || msg.ok}</div>}
 </div>
 <div className="card"><h2>My courses</h2>
 {rows.length === 0 ? <p>No courses yet.</p> : (
 <table><thead><tr><th>Code</th><th>Title</th><th>{user.role === 'instructor' ? 'Students' :
 'Instructor'}</th><th /></tr></thead>
 <tbody>{rows.map((c) => (<tr key={c.id}><td>{c.code}</td><td>{c.title}</td>
 <td>{user.role === 'instructor' ? c.students : c.instructor}</td>
 <td>{user.role === 'instructor' && <button className="secondary" onClick={() =>
 showStudents(c.id)}>Students</button>}{' '}
 <Link className="btn"
 to={`/assignments?courseId=${c.id}`}>Assignments</Link></td></tr>))}</tbody></table>)}
 </div>
 {students && <div className="card"><h3>Students in {students.id}</h3>
 {students.list.length === 0 ? <p>Nobody enrolled yet.</p> :
 <ul>{students.list.map((s) => <li key={s.id}>{s.fullName} ({s.email})</li>)}</ul>}</div>}
 </>);
}
