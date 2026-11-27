const db = require('../db/pg');
// hours = null -> any future deadline (manual button). hours = 48 ->
// deadlines within 48 h (hourly job).
async function sendReminders(assignmentId = null, hours = null) {
const now = new Date();
const limit = hours ? new Date(now.getTime() + hours * 3600000) : null;
const day = now.toISOString().slice(0, 10);
// uses idx_assignments_deadline (partial index on published assignments)
const due = await db.many(
`SELECT id, title, deadline FROM assignments
WHERE status = 'published' AND open_at <= now() AND deadline > now()
AND ($1::uuid IS NULL OR id = $1::uuid)
AND ($2::timestamptz IS NULL OR deadline <= $2::timestamptz)`,
[assignmentId, limit]);
let sent = 0;
for (const a of due) {
const msg = `Reminder: "${a.title}" is due ${a.deadline.slice(0,
16).replace('T', ' ')} UTC.`;
const r = await db.query(
`INSERT INTO notifications (id, user_id, dedupe_key, type, message,
assignment_id)
SELECT gen_random_uuid(), e.student_id, $3::text, 'DEADLINE_REMINDER',
$2::text, $1::uuid
FROM enrollments e
JOIN assignments a ON a.course_code = e.course_code
WHERE a.id = $1::uuid
AND NOT EXISTS (SELECT 1 FROM submissions s
WHERE s.assignment_id = a.id AND s.student_id =
e.student_id)
ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
[a.id, msg.slice(0, 300), `rem:${a.id}:${day}`]);
sent += r.rowCount;
}
return sent;
}
module.exports = { sendReminders };