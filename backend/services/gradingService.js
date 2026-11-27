const db = require('../db/pg');
const notify = require('../lib/notify');
const { publishEvent, consume, SUBMISSION_QUEUE } = require('../lib/events');
const { Rule } = require('../lib/http');
const { parseId, SUB_ID } = require('./submissionService');
const { fetchAssignment } = require('./assignmentService');
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const keyOf = (sub) => [sub.assignmentId, sub.studentId, sub.attemptNo];
const KEY_WHERE = 'assignment_id = $1 AND student_id = $2 AND attempt_no = $3';
// Penalty = latePenaltyPercent for every STARTED day late, capped at 100 percent.
function latePenalty(sub, a, raw) {
if (!sub.isLate) return { days: 0, percent: 0, amount: 0 };
const lateMs = new Date(sub.submittedAt) - new Date(a.deadline);
const days = Math.max(1, Math.ceil(lateMs / 86400000));
const percent = Math.min(100, days * a.latePenaltyPercent);
return { days, percent, amount: r2((raw * percent) / 100) };
}
// Ownership check: only the instructor of the course may touch the submission (otherwise 404).
async function load(user, submissionId) {
const p = parseId(submissionId);
const sub = p && await db.one(
`SELECT ${SUB_ID} AS id, s.assignment_id, s.student_id, s.attempt_no,
s.file_name, s.mime_type,
s.size_bytes, s.sha256, s.comment, s.is_late, s.submitted_at
FROM submissions s
WHERE s.assignment_id = $1 AND s.student_id = $2 AND s.attempt_no =
$3`,
[p.assignmentId, p.studentId, p.attemptNo]);
const a = sub && await fetchAssignment(sub.assignmentId);
if (!sub || !a || a.instructorId !== user.id)
throw new Rule(404, 'SUBMISSION_NOT_FOUND', 'Submission not found.');
return { sub, a };
}
async function isLatest(sub) {
const r = await db.one(`SELECT MAX(attempt_no) AS latest FROM submissions
WHERE assignment_id = $1 AND student_id = $2`,
[sub.assignmentId, sub.studentId]);
return r.latest === sub.attemptNo;
}
// The grade returned by the API includes raw marks and rubric scores.
async function loadGrade(sub) {
const g = await db.one(
`SELECT grader_id, raw_marks, late_penalty, final_marks, feedback,
status, graded_at, published_at
FROM grades WHERE ${KEY_WHERE}`,
keyOf(sub));
if (!g) return null;
g.scores = await db.many(
`SELECT criterion_id, marks, comment FROM grade_scores WHERE ${KEY_WHERE}
ORDER BY criterion_id`,
keyOf(sub));
return g;
}
async function detail(user, submissionId) {
const { sub, a } = await load(user, submissionId);
const student = await db.one('SELECT full_name FROM users WHERE id = $1',
[sub.studentId]);
return {
submission: { ...sub, studentName: student ? student.fullName : '',
title: a.title,
deadline: a.deadline, maxMarks: a.maxMarks, latePenaltyPercent:
a.latePenaltyPercent },
penalty: latePenalty(sub, a, 0), rubric: a.rubric, grade: await
loadGrade(sub),
isLatestAttempt: await isLatest(sub)
};
}
async function save(user, submissionId, body) {
const { scores, feedback } = body || {};
const { sub, a } = await load(user, submissionId);
if (!(await isLatest(sub)))
throw new Rule(409, 'NOT_LATEST_ATTEMPT', 'Only the latest attempt of a student can be graded.');
const rubric = a.rubric;
if (rubric.length === 0) throw new Rule(409, 'NO_RUBRIC', 'This assignment has no rubric.');
if (!Array.isArray(scores) || scores.length !== rubric.length)
throw new Rule(400, 'VALIDATION_ERROR', 'Provide exactly one score for every rubric criterion.');
const byId = new Map(rubric.map((c) => [c.id, c]));
const seen = new Set();
let raw = 0;
for (const s of scores.map((x) => x || {})) {
const c = byId.get(s.criterionId);
if (!c || seen.has(s.criterionId))
throw new Rule(400, 'VALIDATION_ERROR', 'Unknown or duplicate criterion.');
seen.add(s.criterionId);
const m = Number(s.marks);
if (!Number.isFinite(m) || m < 0 || m > c.maxMarks)
throw new Rule(400, 'VALIDATION_ERROR', `Marks for "${c.name}" must be between 0 and ${c.maxMarks}.`);
if (String(s.comment || '').length > 300)
throw new Rule(400, 'VALIDATION_ERROR', 'Criterion comment is at most 300 characters.');
raw += m;
}
if (typeof feedback !== 'string' || feedback.trim().length < 1 ||
feedback.length > 2000)
throw new Rule(400, 'VALIDATION_ERROR', 'Written feedback is required (at most 2000 characters).');
raw = r2(raw);
const penalty = latePenalty(sub, a, raw);
const final = r2(raw - penalty.amount);
const key = keyOf(sub);
await db.tx(async (t) => {
// 1) keep the old version: a regrade never loses history
const prev = await t.one(
`SELECT raw_marks, late_penalty, final_marks, feedback, status FROM
grades WHERE ${KEY_WHERE} FOR UPDATE`, key);
if (prev) await t.query(
`INSERT INTO grade_history (assignment_id, student_id, attempt_no,
raw_marks, late_penalty,
final_marks, feedback, previous_status)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
[...key, prev.rawMarks, prev.latePenalty, prev.finalMarks,
prev.feedback, prev.status]);
// 2) the current grade is always a draft until published
await t.query(
`INSERT INTO grades (assignment_id, student_id, attempt_no, grader_id,
raw_marks, late_penalty,
final_marks, feedback, status, graded_at,
published_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft', now(), NULL)
ON CONFLICT (assignment_id, student_id, attempt_no) DO UPDATE
SET grader_id = EXCLUDED.grader_id, raw_marks = EXCLUDED.raw_marks,
late_penalty = EXCLUDED.late_penalty, final_marks =
EXCLUDED.final_marks,
feedback = EXCLUDED.feedback, status = 'draft', graded_at =
now(), published_at = NULL`,
[...key, user.id, raw, penalty.amount, final, feedback.trim()]);
await t.query(`DELETE FROM grade_scores WHERE ${KEY_WHERE}`, key);
for (const s of scores)
await t.query(
`INSERT INTO grade_scores (assignment_id, student_id, attempt_no,
criterion_id, marks, comment)
VALUES ($1,$2,$3,$4,$5,$6)`,
[...key, s.criterionId, Number(s.marks), String(s.comment || '')]);
// 3) lock the rubric: version + 1 also makes any open edit form fail with 409 CONFLICT
await t.query(
`UPDATE assignments SET grading_started = true, version = version + 1
WHERE id = $1 AND grading_started = false`, [a.id]);
});
return { gradeId: sub.id, rawMarks: raw, latePenalty: penalty, finalMarks:
final,
maxMarks: a.maxMarks, status: 'draft' };
}
// Grade becomes published and the student's notification is written in the SAME transaction.
async function publishGrade(sub, a) {
const ok = await db.tx(async (t) => {
const r = await t.query(
`UPDATE grades SET status = 'published', published_at = now() WHERE
${KEY_WHERE}`, keyOf(sub));
if (r.rowCount === 0) return false;
await notify(sub.studentId, 'RESULT_PUBLISHED', `Your result for "${a.title}" has been published.`,
a.id, `res:${sub.id}:${Date.now()}`, t);
return true;
});
if (!ok) return false;
await publishEvent('result', 'RESULT_PUBLISHED',
{ submissionId: sub.id, studentId: sub.studentId, assignmentId: a.id });
return true;
}
async function publishOne(user, submissionId) {
const { sub, a } = await load(user, submissionId);
if (!(await publishGrade(sub, a)))
throw new Rule(409, 'NOT_GRADED', 'Grade this submission before publishing.');
return { published: 1 };
}
async function publishAll(user, assignmentId) {
const a = await fetchAssignment(assignmentId, false);
if (!a || a.instructorId !== user.id)
throw new Rule(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
// the latest attempt of every student, only where its grade is still a draft
const drafts = await db.many(
`SELECT l.assignment_id, l.student_id, l.attempt_no,
concat_ws('_', l.assignment_id, l.student_id, l.attempt_no) AS id
FROM (SELECT DISTINCT ON (student_id) * FROM submissions
WHERE assignment_id = $1 ORDER BY student_id, attempt_no DESC)
l
JOIN grades g ON g.assignment_id = l.assignment_id AND g.student_id =
l.student_id
AND g.attempt_no = l.attempt_no
WHERE g.status = 'draft'`, [a.id]);
let n = 0;
for (const s of drafts) if (await publishGrade(s, a)) n++;
return { published: n };
}
async function history(user, submissionId) {
const { sub } = await load(user, submissionId);
return db.many(
`SELECT raw_marks, late_penalty, final_marks, feedback, previous_status,
recorded_at
FROM grade_history WHERE ${KEY_WHERE} ORDER BY id DESC`, keyOf(sub));
}
async function resultForStudent(user, assignmentId) {
const s = await db.one(
`SELECT s.assignment_id, s.student_id, s.attempt_no, ${SUB_ID} AS id,
g.raw_marks, g.late_penalty, g.final_marks, g.feedback,
g.published_at
FROM submissions s
JOIN grades g ON g.assignment_id = s.assignment_id AND g.student_id =
s.student_id
AND g.attempt_no = s.attempt_no
WHERE s.assignment_id = $1 AND s.student_id = $2 AND g.status =
'published'
ORDER BY s.attempt_no DESC LIMIT 1`, [assignmentId, user.id]);
if (!s) throw new Rule(404, 'RESULT_NOT_PUBLISHED', 'No published result for this assignment yet.');
const a = await fetchAssignment(assignmentId);
const scores = await db.many(
`SELECT criterion_id, marks, comment FROM grade_scores WHERE
${KEY_WHERE}`, keyOf(s));
const breakdown = a.rubric.map((c) => { // rubric is already ordered by position
const sc = scores.find((x) => x.criterionId === c.id) || { marks: 0,
comment: '' };
return { name: c.name, maxMarks: c.maxMarks, marks: sc.marks, comment:
sc.comment };
});
return { id: s.id, rawMarks: s.rawMarks, latePenalty: s.latePenalty,
finalMarks: s.finalMarks,
feedback: s.feedback, publishedAt: s.publishedAt, maxMarks: a.maxMarks,
breakdown };
}
// Reads the SQS queue filled by the Submission Service: "a new submission is waiting to be graded".
function startConsumer() {
consume(SUBMISSION_QUEUE, async (m) => {
if (m.type !== 'SUBMISSION_RECEIVED') return;
await notify(m.instructorId, 'READY_TO_GRADE',
`${m.studentName} submitted "${m.title}" (attempt ${m.attemptNo}).`,
m.assignmentId, `new:${m.submissionId}`);
});
}
module.exports = { startConsumer, detail, save, publishOne, publishAll,
history, resultForStudent };
