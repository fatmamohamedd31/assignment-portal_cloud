const { randomUUID } = require('crypto');
const db = require('../db/pg');
const notify = require('../lib/notify');
const { sendSubmissionEvent } = require('../lib/events');
const { Rule, isUuid } = require('../lib/http');
const { putFile, getFile, deleteFile } = require('../lib/files');
const { validateFile, safeName, sha256 } = require('../lib/fileRules');
const { fetchAssignment } = require('./assignmentService');

// The API id of a submission is assignmentId_studentId_attemptNo (same text form as before).
const subId = (a, s, n) => `${a}_${s}_${n}`;
const SUB_ID = "concat_ws('_', s.assignment_id, s.student_id, s.attempt_no)";

// For SELECT lists, alias s.
// Null when the text is not a valid id, which the callers turn into a 404.
function parseId(id) {
  const [assignmentId, studentId, n] = String(id).split('_');
  if (!isUuid(assignmentId) || !isUuid(studentId) || !/^[0-9]{1,3}$/.test(n || '')) return null;
  return { assignmentId, studentId, attemptNo: Number(n) };
}

async function submit(user, assignmentId, file, comment) {
  const a = await fetchAssignment(assignmentId, false);
  const enrolled = a && a.status === 'published' && await db.one(
    `SELECT 1 AS ok FROM enrollments WHERE student_id = $1 AND course_code = $2`,
    [user.id, a.courseId]
  );
  if (!enrolled) throw new Rule(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');

  const now = new Date(); // server clock, never the browser clock
  if (new Date(a.openAt) > now)
    throw new Rule(403, 'NOT_OPEN_YET', 'This assignment is not open for submissions yet.');

  const late = now > new Date(a.deadline);
  if (late && !a.allowLate)
    throw new Rule(403, 'DEADLINE_PASSED', 'The deadline has passed and late submissions are not accepted.');

  const prev = await db.many(
    `SELECT s.attempt_no, s.sha256, g.status AS grade_status
     FROM submissions s
     LEFT JOIN grades g ON g.assignment_id = s.assignment_id
       AND g.student_id = s.student_id
       AND g.attempt_no = s.attempt_no
     WHERE s.assignment_id = $1 AND s.student_id = $2
     ORDER BY s.attempt_no`,
    [a.id, user.id]
  );
  const last = prev[prev.length - 1];

  if (last && last.gradeStatus === 'published')
    throw new Rule(409, 'ALREADY_GRADED', 'Your result is published, so resubmission is closed.');
  if (prev.length > 0 && !a.allowResubmission)
    throw new Rule(409, 'RESUBMISSION_NOT_ALLOWED', 'Resubmission is not allowed for this assignment.');
  if (prev.length >= a.maxAttempts)
    throw new Rule(409, 'MAX_ATTEMPTS_REACHED', `You used all ${a.maxAttempts} attempts.`);

  const problem = validateFile(file, a);
  if (problem) throw new Rule(400, 'INVALID_FILE', problem);

  const hash = sha256(file.buffer);
  if (prev.some((p) => p.sha256 === hash))
    throw new Rule(409, 'DUPLICATE_FILE', 'This exact file was already submitted in an earlier attempt.');

  const attemptNo = last ? last.attemptNo + 1 : 1;
  const id = subId(a.id, user.id, attemptNo);
  const s3Key = `submissions/${a.id}/${user.id}/${attemptNo}-${randomUUID()}`;
  const fileName = safeName(file.originalname);

  await putFile(s3Key, file.buffer, file.mimetype); // 1) the file goes to S3
  try {
    await db.query( // 2) the row goes to Neon
      `INSERT INTO submissions (assignment_id, student_id, attempt_no,
       file_name, mime_type, size_bytes, sha256, s3_key, comment, is_late,
       submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [a.id, user.id, attemptNo, fileName, String(file.mimetype).slice(0, 100),
       file.size, hash, s3Key, String(comment || '').slice(0, 500), late, now]
    );
  } catch (e) {
    // Rollback of step 1: never leave an orphan object in the bucket.
    try { await deleteFile(s3Key); }
    catch (d) {
      console.error(JSON.stringify({ level: 'error', where: 's3-rollback', key: s3Key, message: d.message }));
    }
    if (db.isUnique(e) && e.constraint === 'submissions_hash_unique')
      throw new Rule(409, 'DUPLICATE_FILE', 'This exact file was already submitted in an earlier attempt.');
    if (db.isUnique(e))
      throw new Rule(409, 'CONFLICT', 'Another upload was saved at the same moment. Please retry.');
    throw e;
  }

  await sendSubmissionEvent({
    type: 'SUBMISSION_RECEIVED', submissionId: id, assignmentId: a.id,
    instructorId: a.instructorId, studentName: user.name, title: a.title,
    attemptNo, late
  });
  if (late)
    await notify(a.instructorId, 'LATE_SUBMISSION', `${user.name} submitted "${a.title}" late.`, a.id, `late:${id}`);

  return {
    id, attemptNo, fileName, sizeBytes: file.size, sha256: hash, isLate: late,
    submittedAt: now.toISOString(),
    message: 'Submission received. Keep this timestamp as your proof.'
  };
}

async function statusForStudent(user) {
  const rows = await db.many(
    `SELECT a.id AS assignment_id, a.title, a.course_code, a.deadline,
            a.max_marks, a.max_attempts,
            (SELECT COUNT(*) FROM submissions s
             WHERE s.assignment_id = a.id AND s.student_id = $1)::int AS attempts,
            l.submitted_at, l.is_late, g.status AS grade_status, g.final_marks
     FROM assignments a
     JOIN enrollments e ON e.course_code = a.course_code AND e.student_id = $1
     LEFT JOIN LATERAL (
       SELECT s.* FROM submissions s
       WHERE s.assignment_id = a.id AND s.student_id = $1
       ORDER BY s.attempt_no DESC LIMIT 1
     ) l ON true
     LEFT JOIN grades g ON g.assignment_id = l.assignment_id
       AND g.student_id = l.student_id
       AND g.attempt_no = l.attempt_no
     WHERE a.status = 'published'
     ORDER BY a.deadline`,
    [user.id]
  );
  const now = new Date();
  return rows.map((r) => {
    const graded = r.gradeStatus === 'published';
    const status = graded ? 'graded'
      : r.submittedAt ? (r.isLate ? 'late' : 'submitted')
      : new Date(r.deadline) < now ? 'missing' : 'pending';
    return {
      assignmentId: r.assignmentId, title: r.title, courseCode: r.courseCode,
      deadline: r.deadline, maxMarks: r.maxMarks, maxAttempts: r.maxAttempts,
      attempts: r.attempts, submittedAt: r.submittedAt, status,
      finalMarks: graded ? r.finalMarks : null
    };
  });
}

async function history(user, assignmentId) {
  return db.many(
    `SELECT ${SUB_ID} AS id, s.attempt_no, s.file_name, s.size_bytes,
            s.is_late, s.submitted_at, s.comment
     FROM submissions s WHERE s.assignment_id = $1 AND s.student_id = $2
     ORDER BY s.attempt_no DESC`,
    [assignmentId, user.id]
  );
}

async function overview(user, assignmentId) {
  const a = await fetchAssignment(assignmentId, false);
  if (!a || a.instructorId !== user.id) return null;
  const rows = await db.many(
    `SELECT e.student_id, u.full_name AS student_name, u.email,
            l.id AS submission_id, l.attempt_no, l.is_late, l.submitted_at,
            l.file_name, g.status AS grade_status, g.final_marks
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN LATERAL (
       SELECT s.*, ${SUB_ID} AS id FROM submissions s
       WHERE s.assignment_id = $1 AND s.student_id = e.student_id
       ORDER BY s.attempt_no DESC LIMIT 1
     ) l ON true
     LEFT JOIN grades g ON g.assignment_id = l.assignment_id
       AND g.student_id = l.student_id
       AND g.attempt_no = l.attempt_no
     WHERE e.course_code = $2
     ORDER BY u.full_name`,
    [a.id, a.courseId]
  );
  const students = rows.map((r) => ({
    studentId: r.studentId, studentName: r.studentName, email: r.email,
    submissionId: r.submissionId, attemptNo: r.attemptNo, isLate: r.isLate,
    submittedAt: r.submittedAt, fileName: r.fileName,
    gradingStatus: !r.submissionId ? 'not_submitted'
      : !r.gradeStatus ? 'awaiting'
      : r.gradeStatus === 'draft' ? 'graded_draft' : 'published',
    finalMarks: r.gradeStatus ? r.finalMarks : null
  }));
  return {
    assignment: { title: a.title, deadline: a.deadline, maxMarks: a.maxMarks },
    students
  };
}

async function fileFor(user, submissionId) {
  const p = parseId(submissionId);
  if (!p) return null;
  const s = await db.one(
    `SELECT s.file_name, s.mime_type, s.s3_key, s.student_id, a.instructor_id
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE s.assignment_id = $1 AND s.student_id = $2 AND s.attempt_no = $3`,
    [p.assignmentId, p.studentId, p.attemptNo]
  );
  if (!s) return null;
  const allowed = (user.role === 'student' && s.studentId === user.id)
    || (user.role === 'instructor' && s.instructorId === user.id);
  // Not allowed looks the same as not found.
  return allowed
    ? { fileName: s.fileName, mimeType: s.mimeType, body: await getFile(s.s3Key) }
    : null;
}

module.exports = { submit, statusForStudent, history, overview, fileFor, parseId, SUB_ID };