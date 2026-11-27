import { useEffect, useState } from 'react';
import { api } from '../api.js';
export default function Reports() {
 const [courses, setCourses] = useState([]);
 const [courseId, setCourseId] = useState('');
 const [rows, setRows] = useState([]);
 const [err, setErr] = useState('');
 useEffect(() => { api('/api/courses').then(setCourses).catch(() => {}); }, []);
 useEffect(() => {
 api('/api/reports/late' + (courseId ? `?courseId=${courseId}` : '')).then(setRows).catch((e) =>
 setErr(e.message));
 }, [courseId]);
 return (
 <div className="card"><h2>Late submissions</h2>
 <label>Course</label>
 <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
 <option value="">All my courses</option>{courses.map((c) => <option key={c.id}
 value={c.id}>{c.code}</option>)}</select>
 {err && <div className="msg-err">{err}</div>}
 {rows.length === 0 ? <p>No late submissions.</p> :
 <table><thead><tr><th>Student</th><th>Course</th><th>Assignment</th><th>Hours
 late</th><th>Penalty</th></tr></thead>
 <tbody>{rows.map((r, i) => <tr
 key={i}><td>{r.studentName}</td><td>{r.courseCode}</td><td>{r.assignmentTitle}</td><td>{r.hoursLate}</td
 ><td>{r.penalty ?? 'not graded'}</td></tr>)}</tbody></table>}
 </div>
 );
}

