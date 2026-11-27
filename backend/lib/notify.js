const { randomUUID } = require('crypto');
const db = require('../db/pg');
// Idempotent: true only the first time a (user, dedupeKey) pair is written.
// exec lets a caller pass a transaction (t) so the notification commits with
// the rest of its work.
async function notify(userId, type, message, assignmentId, dedupeKey, exec = db) {
const r = await exec.query(
`INSERT INTO notifications (id, user_id, dedupe_key, type, message,
assignment_id)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
[randomUUID(), userId, dedupeKey, type, message.slice(0, 300),
assignmentId || null]);
return r.rowCount === 1;
}
// One notification for every student enrolled in the course. Returns how many were new.
async function notifyCourse(courseCode, type, message, assignmentId,
dedupeKey, exec = db) {
const r = await exec.query(
`INSERT INTO notifications (id, user_id, dedupe_key, type, message,
assignment_id)
SELECT gen_random_uuid(), e.student_id, $5::text, $2::text, $3::text,
$4::uuid
FROM enrollments e
WHERE e.course_code = $1::text
ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
[courseCode, type, message.slice(0, 300), assignmentId, dedupeKey]);
return r.rowCount;
}
module.exports = notify;
module.exports.course = notifyCourse;