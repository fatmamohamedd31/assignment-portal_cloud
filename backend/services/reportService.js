const db = require('../db/pg');
const { fetchAssignment } = require('./assignmentService');
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
// Latest attempt of every student, kept only if that attempt was late. Filters run inside PostgreSQL.
async function lateReport(user, { assignmentId = null, courseId = null }) {
return db.many(
`SELECT u.full_name AS student_name, u.email, a.course_code, a.title AS
assignment_title,
l.attempt_no, l.submitted_at, a.deadline,
ROUND((EXTRACT(EPOCH FROM (l.submitted_at - a.deadline)) /
3600.0)::numeric, 1) AS hours_late,
g.late_penalty AS penalty
FROM assignments a
JOIN LATERAL (SELECT DISTINCT ON (s.student_id) s.*
FROM submissions s WHERE s.assignment_id = a.id
ORDER BY s.student_id, s.attempt_no DESC) l ON true
JOIN users u ON u.id = l.student_id
LEFT JOIN grades g ON g.assignment_id = l.assignment_id AND
g.student_id = l.student_id
AND g.attempt_no = l.attempt_no
WHERE a.instructor_id = $1 AND l.is_late
AND ($2::uuid IS NULL OR a.id = $2::uuid)
AND ($3::text IS NULL OR a.course_code = $3::text)
ORDER BY l.submitted_at DESC`, [user.id, assignmentId, courseId]);
}
async function stats(user, assignmentId) {
const a = await fetchAssignment(assignmentId, false);
if (!a || a.instructorId !== user.id) return null;
const latest = await db.many(
`SELECT g.final_marks AS marks, g.status AS grade_status
FROM (SELECT DISTINCT ON (student_id) * FROM submissions
WHERE assignment_id = $1 ORDER BY student_id, attempt_no DESC)
l
LEFT JOIN grades g ON g.assignment_id = l.assignment_id AND
g.student_id = l.student_id
AND g.attempt_no = l.attempt_no`, [a.id]);
const enrolled = (await db.one(`SELECT COUNT(*) AS n FROM enrollments WHERE
course_code = $1`, [a.courseId])).n;
const marks = latest.filter((s) => s.marks !== null).map((s) =>
s.marks).sort((p, q) => p - q);
const published = latest.filter((s) => s.gradeStatus ===
'published').length;
const n = marks.length;
const sum = marks.reduce((t, x) => t + x, 0);
const median = n === 0 ? null : (n % 2 ? marks[(n - 1) / 2] : (marks[n / 2
- 1] + marks[n / 2]) / 2);
const bands = [['0-49%', 0, 50], ['50-59%', 50, 60], ['60-69%', 60, 70],
['70-79%', 70, 80], ['80-100%', 80, 101]];
const distribution = bands.map(([label, lo, hi]) => ({ label,
count: marks.filter((m) => { const pc = (m / a.maxMarks) * 100; return pc
>= lo && pc < hi; }).length }));
return {
assignmentTitle: a.title, maxMarks: a.maxMarks, gradedCount: n,
average: n ? r2(sum / n) : null, highest: n ? marks[n - 1] : null,
lowest: n ? marks[0] : null,
median: median === null ? null : r2(median), enrolled, submitted:
latest.length, published,
awaitingGrading: Math.max(0, latest.length - n), notSubmitted:
Math.max(0, enrolled - latest.length),
distribution
};
}
module.exports = { lateReport, stats };