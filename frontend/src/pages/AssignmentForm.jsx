import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
const blank = { courseId: '', title: '', description: '', instructions: '', requirements: '',
deadline: '', maxMarks: 100, allowResubmission: true, maxAttempts: 3, allowLate: true,
latePenaltyPercent: 10, maxFileMb: 2, allowedExtensions: 'pdf,docx,zip',
rubric: [{ name: '', description: '', maxMarks: '' }] };
const local = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); 
    return d.toISOString().slice(0, 16); };
export default function AssignmentForm() {
const { id } = useParams();
const [params] = useSearchParams();
const go = useNavigate();
const [f, setF] = useState({ ...blank, courseId: params.get('courseId') || '' });
const [courses, setCourses] = useState([]);
const [err, setErr] = useState('');
useEffect(() => {
api('/api/courses').then(setCourses).catch(() => {});
if (id) api(`/api/assignments/${id}`).then((a) => setF({ ...a, deadline: local(a.deadline),
allowedExtensions: a.allowedExtensions.join(',') })).catch((e) => setErr(e.message));
}, [id]);
const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
const setCrit = (i, k, v) => setF({ ...f, rubric: f.rubric.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
const total = f.rubric.reduce((t, c) => t + (Number(c.maxMarks) || 0), 0);
async function save(publish) {
setErr('');
if (total !== Number(f.maxMarks)) return setErr(`Rubric marks add up to ${total} but maximum marks is
${f.maxMarks}.`);
const body = { ...f, publish, deadline: new Date(f.deadline).toISOString(), maxMarks: Number(f.maxMarks),
maxAttempts: Number(f.maxAttempts), latePenaltyPercent: Number(f.latePenaltyPercent), maxFileMb:
Number(f.maxFileMb),
allowedExtensions: String(f.allowedExtensions).split(',').map((x) => x.trim()).filter(Boolean),
rubric: f.rubric.map((c) => ({ name: c.name, description: c.description || '', maxMarks: Number(c.maxMarks) }))
};
try {
await api(id ? `/api/assignments/${id}` : '/api/assignments', { method: id ? 'PUT' : 'POST', body });
go('/assignments');
} catch (e) { setErr(e.message); }
}
return (
    <>
<div className="card">
<h2>{id ? 'Edit assignment' : 'New assignment'}</h2>
{!id && (<><label>Course</label><select value={f.courseId} onChange={set('courseId')}>
<option value="">Choose...</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} -
{c.title}</option>)}</select></>)}
<label>Title</label><input value={f.title} onChange={set('title')} />
<label>Description</label><textarea rows="3" value={f.description} onChange={set('description')} />
<label>Instructions</label><textarea rows="3" value={f.instructions} onChange={set('instructions')} />
<label>Requirements</label><textarea rows="2" value={f.requirements} onChange={set('requirements')} />
<div className="row">
<div><label>Deadline</label><input type="datetime-local" value={f.deadline} onChange={set('deadline')}
/></div>
<div><label>Maximum marks</label><input type="number" value={f.maxMarks} onChange={set('maxMarks')} /></div>
<div><label>Max attempts</label><input type="number" value={f.maxAttempts} onChange={set('maxAttempts')}
/></div>
<div><label>Late penalty % per day</label><input type="number" value={f.latePenaltyPercent}
onChange={set('latePenaltyPercent')} /></div>
<div><label>Max file MB (1-3)</label><input type="number" value={f.maxFileMb} onChange={set('maxFileMb')}
/></div>
</div>
<label>Allowed file types (comma separated)</label><input value={f.allowedExtensions}
onChange={set('allowedExtensions')} />
<label><input type="checkbox" style={{ width: 'auto' }} checked={f.allowLate} onChange={set('allowLate')} />
Accept late submissions</label>
<label><input type="checkbox" style={{ width: 'auto' }} checked={f.allowResubmission}
onChange={set('allowResubmission')} /> Allow resubmission</label> <h3>Rubric (total {total} / {f.maxMarks})</h3>
{f.rubric.map((c, i) => (
<div className="row" key={i}>
<div><label>Criterion</label><input value={c.name} onChange={(e) => setCrit(i, 'name', e.target.value)}
/></div>
<div><label>Marks</label><input type="number" value={c.maxMarks} onChange={(e) => setCrit(i, 'maxMarks',
e.target.value)} /></div>
<button type="button" className="danger" onClick={() => setF({ ...f, rubric: f.rubric.filter((_, j) => j
!== i) })}>Remove</button>
</div>))}
<button type="button" className="secondary" onClick={() => setF({ ...f, rubric: [...f.rubric, { name: '',
description: '', maxMarks: '' }] })}>+ Criterion</button>
{err && <div className="msg-err">{err}</div>}

<p></p>
</div>

{!id && (
  <button onClick={() => save(true)}>
    Create and publish
  </button>
)}

<button
  className="secondary"
  onClick={() => save(false)}
>
  {id ? 'Save changes' : 'Save as draft'}
</button>
</>
);
}