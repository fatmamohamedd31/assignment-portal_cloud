const db = require('../db/pg');
async function listForUser(user) {
if (user.role === 'instructor') {
return db.many(
`SELECT c.code AS id, c.code, c.title, COUNT(e.student_id)::int AS
students
FROM courses c
LEFT JOIN enrollments e ON e.course_code = c.code
WHERE c.instructor_id = $1
GROUP BY c.code, c.title
ORDER BY c.code`, [user.id]);
}
return db.many(
`SELECT c.code AS id, c.code, c.title, u.full_name AS instructor
FROM enrollments e
JOIN courses c ON c.code = e.course_code
JOIN users u ON u.id = c.instructor_id
WHERE e.student_id = $1
ORDER BY c.code`, [user.id]);
}
// null = the code already exists (unique violation on the primary key)
async function create(instructorId, code, title) {
try {
await db.query(`INSERT INTO courses (code, title, instructor_id) VALUES
($1, $2, $3)`,
[code, title, instructorId]);
return { id: code, code, title };
} catch (e) {
if (db.isUnique(e)) return null;
throw e;
}
}
async function enroll(studentId, code) {
const course = await db.one(
`SELECT code AS id, code, title FROM courses
WHERE code = $1`, [code]);
if (!course) return { notFound: true };
const r = await db.query(
'INSERT INTO enrollments (course_code, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
[code, studentId]);
if (r.rowCount === 0) return { already: true };
return { course };
}
// The course, only if this instructor owns it. Missing courses and courses
// owned by someone else are returned as null by the routes.
async function getOwned(courseId, instructorId) {
  return db.one(
    'SELECT code AS id, code, title, instructor_id FROM courses WHERE code = $1 AND instructor_id = $2',
    [courseId, instructorId]
  );
}

async function students(courseId, instructorId) {
if (!(await getOwned(courseId, instructorId))) return null;
return db.many(
`SELECT u.id, u.full_name, u.email, e.enrolled_at
FROM enrollments e JOIN users u ON u.id = e.student_id
WHERE e.course_code = $1
ORDER BY u.full_name`, [courseId]);
}
module.exports = { listForUser, create, enroll, students, getOwned };
