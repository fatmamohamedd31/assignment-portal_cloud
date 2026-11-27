const { randomUUID } = require('crypto');
const db = require('../db/pg');
const notify = require('../lib/notify');
const { publishEvent, consume, ASSIGNMENT_QUEUE, FANOUT } =
require('../lib/events');
const { deleteFile } = require('../lib/files');
const { checkText } = require('../lib/http');
const EXT = ['pdf', 'docx', 'doc', 'txt', 'zip', 'png', 'jpg', 'py', 'js',
'java', 'cpp'];
// One SELECT used everywhere an assignment is read. Column names become
// camelCase in db/pg.js.
const BASE_SELECT = `
SELECT a.id, a.course_code AS course_id, a.course_code, c.title AS
course_title, a.instructor_id,
a.title, a.description, a.instructions, a.requirements, a.open_at,
a.deadline, a.max_marks,
a.allow_resubmission, a.max_attempts, a.allow_late,
a.late_penalty_percent,
a.allowed_extensions, a.max_file_mb, a.grading_started, a.version,
a.status,
a.created_at, a.updated_at
FROM assignments a JOIN courses c ON c.code = a.course_code`;
// Loads one assignment and (by default) its rubric as a[rubric] = [{id,
// name, description, maxMarks, position}].
async function fetchAssignment(id, withRubric = true, exec = db) {
const a = await exec.one(`${BASE_SELECT} WHERE a.id = $1`, [id]);
if (a && withRubric) {
a.rubric = await exec.many(
`SELECT id, name, description, max_marks, position
FROM rubric_criteria WHERE assignment_id = $1 ORDER BY position`,
[id]);
}
return a;
}
// draft / upcoming / active / past is calculated, never stored.
function category(a) {
const now = Date.now();
if (a.status === 'draft') return 'draft';
if (new Date(a.openAt) > now) return 'upcoming';
return new Date(a.deadline) > now ? 'active' : 'past';
}
const when = (iso) => iso.slice(0, 16).replace('T', ' ');
const publishedText = (a) => `New assignment: "${a.title}", due ${when(a.deadline)} UTC.`;
function validate(b, isUpdate) {
const text = checkText(b.title, 'Title', 3, 120) ||
checkText(b.description, 'Description', 10, 2000);
if (text) return { error: text };
const instructions = b.instructions ?? '';
const requirements = b.requirements ?? '';
if (typeof instructions !== 'string' || instructions.length > 4000)
return { error: 'Instructions must be at most 4000 characters.' };
if (typeof requirements !== 'string' || requirements.length > 2000)
return { error: 'Requirements must be at most 2000 characters.' };
const deadline = new Date(b.deadline);
const openAt = b.openAt ? new Date(b.openAt) : new Date();
if (Number.isNaN(deadline.getTime()) || Number.isNaN(openAt.getTime()))
return { error: 'Deadline and open date must be valid dates.' };
if (deadline <= openAt) return { error: 'Deadline must be after the open date.' };
if (!isUpdate && deadline <= new Date()) return { error: 'Deadline must be in the future.' };
const maxMarks = Number(b.maxMarks);
if (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000)
return { error: 'Maximum marks must be a whole number from 1 to 1000.' };
if (!Array.isArray(b.rubric) || b.rubric.length < 1 || b.rubric.length >
10)
return { error: 'Provide 1 to 10 rubric criteria.' };
let total = 0;
const rubric = [];
for (const c of b.rubric.map((x) => x || {})) {
const nameProblem = checkText(c.name, 'Criterion name', 2, 80);
if (nameProblem) return { error: nameProblem };
const m = Number(c.maxMarks);
if (!Number.isFinite(m) || m <= 0 || m > 1000)
return { error: 'Every criterion needs marks greater than 0.' };
const d = c.description ?? '';
if (typeof d !== 'string' || d.length > 300)
return { error: 'Criterion description is at most 300 characters.' };
total += m;
rubric.push({ name: c.name.trim(), description: d.trim(), maxMarks: m });
}
if (Math.abs(total - maxMarks) > 0.001)
return { error: `Rubric marks add up to ${total} but maximum marks is ${maxMarks}.` };
const allowResubmission = b.allowResubmission ?? true;
const allowLate = b.allowLate ?? true;
if (typeof allowResubmission !== 'boolean' || typeof allowLate !==
'boolean')
return { error: 'Resubmission and late flags must be true or false.' };
const maxAttempts = Number(b.maxAttempts ?? 3);
const latePenaltyPercent = Number(b.latePenaltyPercent ?? 10);
const maxFileMb = Number(b.maxFileMb ?? 2);
if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
return { error: 'Maximum attempts must be 1 to 10.' };
if (!Number.isInteger(latePenaltyPercent) || latePenaltyPercent < 0 ||
latePenaltyPercent > 100)
return { error: 'Late penalty must be 0 to 100 percent per day.' };
if (!Number.isInteger(maxFileMb) || maxFileMb < 1 || maxFileMb > 3)
return { error: 'Maximum file size must be 1 to 3 MB.' };
const allowedExtensions = (b.allowedExtensions ?? ['pdf', 'docx', 'zip']).map((e) => String(e).toLowerCase());
if (allowedExtensions.length < 1 || allowedExtensions.some((e) => !EXT.includes(e)))
return { error: `Allowed file types must be chosen from: ${EXT.join(', ')}.` };
return { value: { title: b.title.trim(), description: b.description.trim(),
instructions,
requirements, deadline, openAt, maxMarks, rubric, allowResubmission,
allowLate, maxAttempts,
latePenaltyPercent, maxFileMb, allowedExtensions } };
}
async function canSee(user, a) {
if (user.role === 'instructor') return a.instructorId === user.id;
if (a.status !== 'published') return false;
const r = await db.one('SELECT 1 AS ok FROM enrollments WHERE student_id = $1 AND course_code = $2',
[user.id, a.courseId]);
return Boolean(r);
}
async function get(user, id) {
const a = await fetchAssignment(id);
return a && (await canSee(user, a)) ? { ...a, category: category(a) } :
null;
}

// The category filter is fixed SQL text chosen from this map. The route has already checked that
// category is one of the four keys, and user input is never joined into the query.
const CAT_SQL = {
draft: "a.status = 'draft'",
upcoming: "a.status <> 'draft' AND a.open_at > now()",
active: "a.status <> 'draft' AND a.open_at <= now() AND a.deadline > now()",
past: "a.status <> 'draft' AND a.open_at <= now() AND a.deadline <= now()"
};
async function list(user, { category: cat = null, courseId = null }) {
const params = [user.id];
const where = [];
if (user.role === 'instructor') where.push('a.instructor_id = $1');
else where.push("a.status = 'published' AND a.course_code IN (SELECT course_code FROM enrollments WHERE student_id = $1)");
if (courseId) { params.push(courseId); where.push(`a.course_code = $${params.length}`); }
if (cat && CAT_SQL[cat]) where.push(CAT_SQL[cat]);
const rows = await db.many(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.deadline`, params);
return rows.map((a) => ({
id: a.id, courseId: a.courseId, courseCode: a.courseCode, courseTitle:
a.courseTitle,
title: a.title, description: a.description, openAt: a.openAt, deadline:
a.deadline,
maxMarks: a.maxMarks, status: a.status, category: category(a)
}));
}
// Tells the enrolled students. With ASSIGNMENT_FANOUT=true a queue consumer creates the notifications
// (SNS -> SQS -> consumer, Part 2). Otherwise, or if SNS failed, they are written directly.
async function notifyEnrolled(a, type, message, key) {
const queued = await publishEvent('assignment', type,
{ type, assignmentId: a.id, courseId: a.courseId, message, key });
if (queued && FANOUT) return;
await notify.course(a.courseId, type, message, a.id, key);
}
// The consumer side of the fan-out. Safe to receive a message twice: notify is de-duplicated by key.
function startFanoutConsumer() {
consume(ASSIGNMENT_QUEUE, async (m) => {
if (!m || !m.assignmentId || !m.courseId || !m.key) return; // ignore the setup message
await notify.course(m.courseId, m.type, m.message, m.assignmentId,
m.key);
});
}
async function insertRubric(t, assignmentId, rubric) {
for (let i = 0; i < rubric.length; i++) {
const c = rubric[i];
await t.query(
`INSERT INTO rubric_criteria (id, assignment_id, position, name,
description, max_marks)
VALUES ($1, $2, $3, $4, $5, $6)`,
[randomUUID(), assignmentId, i + 1, c.name, c.description,
c.maxMarks]);
}
}
// The assignment row and its rubric rows are saved together or not at all.
async function create(user, course, v, publish) {
const id = randomUUID();
await db.tx(async (t) => {
await t.query(
`INSERT INTO assignments (id, course_code, instructor_id, title,
description, instructions,
requirements, open_at, deadline, max_marks, allow_resubmission,
max_attempts, allow_late,
late_penalty_percent, allowed_extensions, max_file_mb, status)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
[id, course.id, user.id, v.title, v.description, v.instructions,
v.requirements, v.openAt,
v.deadline, v.maxMarks, v.allowResubmission, v.maxAttempts,
v.allowLate, v.latePenaltyPercent,
v.allowedExtensions, v.maxFileMb, publish ? 'published' : 'draft']);
await insertRubric(t, id, v.rubric);
});
if (publish) {
const item = { id, courseId: course.id, title: v.title, deadline:
v.deadline.toISOString() };
await notifyEnrolled(item, 'ASSIGNMENT_PUBLISHED', publishedText(item),
`pub:${id}`);
}
return id;
}
async function update(existing, v) {
const sig = (r) => JSON.stringify(r.map((c) => [c.name,
Number(c.maxMarks)]));
const rubricChanged = sig(existing.rubric) !== sig(v.rubric);
if (existing.gradingStarted && (rubricChanged || existing.maxMarks !==
v.maxMarks)) return { locked: true };
const changes = [];
if (existing.title !== v.title) changes.push('title');
if (existing.description !== v.description) changes.push('description');
if (existing.instructions !== v.instructions || existing.requirements !==
v.requirements)
changes.push('instructions or requirements');
if (new Date(existing.deadline).getTime() !== v.deadline.getTime())
changes.push('deadline');
if (existing.maxMarks !== v.maxMarks || rubricChanged) changes.push('marks or rubric');
// Optimistic lock: the UPDATE only matches if the version and the grading flag are unchanged since we
// read the assignment. If grading started (or someone else saved) meanwhile, no row matches -> conflict.
const saved = await db.tx(async (t) => {
const r = await t.query(
`UPDATE assignments SET title = $1, description = $2, instructions =
$3, requirements = $4,
open_at = $5, deadline = $6, max_marks = $7, allow_resubmission
= $8, max_attempts = $9,
allow_late = $10, late_penalty_percent = $11,
allowed_extensions = $12, max_file_mb = $13,
version = version + 1, updated_at = now()
WHERE id = $14 AND version = $15 AND grading_started = $16`,
[v.title, v.description, v.instructions, v.requirements, v.openAt,
v.deadline, v.maxMarks,
v.allowResubmission, v.maxAttempts, v.allowLate, v.latePenaltyPercent,
v.allowedExtensions,
v.maxFileMb, existing.id, existing.version, existing.gradingStarted]);
if (r.rowCount === 0) return false;
if (rubricChanged) {
await t.query('DELETE FROM rubric_criteria WHERE assignment_id = $1',
[existing.id]);
await insertRubric(t, existing.id, v.rubric);
}
return true;
});
if (!saved) return { conflict: true };
if (existing.status === 'published' && changes.length)
await notifyEnrolled({ id: existing.id, courseId: existing.courseId },
'ASSIGNMENT_UPDATED',
`"${v.title}" was updated: ${changes.join(', ')}.`,
`upd:${existing.id}:${Date.now()}`);
return { changes };
}
async function publish(a) {
const r = await db.query(
`UPDATE assignments SET status = 'published', version = version + 1,
updated_at = now()
WHERE id = $1 AND status = 'draft'`, [a.id]);
if (r.rowCount === 1) await notifyEnrolled(a, 'ASSIGNMENT_PUBLISHED',
publishedText(a), `pub:${a.id}`);
}
// Blocked with 409 HAS_SUBMISSIONS unless force. The database rows go first
// (one transaction), then the S3 objects. A failed S3 delete is logged,
// never silently ignored.
async function remove(id, force) {
const subs = await db.many('SELECT s3_key FROM submissions WHERE assignment_id = $1', [id]);
if (subs.length > 0 && !force) return { blocked: subs.length };
await db.tx(async (t) => {
await t.query('DELETE FROM submissions WHERE assignment_id = $1', [id]);
// cascades to grades, scores, history
await t.query('DELETE FROM assignments WHERE id = $1', [id]);
// cascades to rubric criteria
});
for (const s of subs) {
try { await deleteFile(s.s3Key); }
catch (e) { console.error(JSON.stringify({ level: 'error', where: 's3-delete', key: s.s3Key, message: e.message })); }
}
return { deleted: true };
}
module.exports = { validate, list, get, create, update, publish, remove,
fetchAssignment, startFanoutConsumer };