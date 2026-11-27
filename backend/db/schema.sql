-- Assignment Submission Portal: PostgreSQL schema for Neon. Safe to run many times.
CREATE TABLE IF NOT EXISTS users (
id uuid PRIMARY KEY,
full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND
80),
email text NOT NULL CHECK (email = lower(email) AND
char_length(email) <= 120),
role text NOT NULL CHECK (role IN ('student', 'instructor')),
password_hash text NOT NULL,
created_at timestamptz NOT NULL DEFAULT now(),
CONSTRAINT users_email_unique UNIQUE (email)
);
CREATE TABLE IF NOT EXISTS courses (
code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9-]{3,20}$'),
title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
instructor_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses (instructor_id);
CREATE TABLE IF NOT EXISTS enrollments (
course_code text NOT NULL REFERENCES courses (code) ON DELETE CASCADE,
student_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
enrolled_at timestamptz NOT NULL DEFAULT now(),
PRIMARY KEY (course_code, student_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments
(student_id);
CREATE TABLE IF NOT EXISTS assignments (
id uuid PRIMARY KEY,
course_code text NOT NULL REFERENCES courses (code) ON DELETE
RESTRICT,
instructor_id uuid NOT NULL REFERENCES users (id) ON DELETE
RESTRICT,
title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND
120),
description text NOT NULL CHECK (char_length(description) BETWEEN
10 AND 2000),
instructions text NOT NULL DEFAULT '' CHECK
(char_length(instructions) <= 4000),
requirements text NOT NULL DEFAULT '' CHECK
(char_length(requirements) <= 2000),
open_at timestamptz NOT NULL,
deadline timestamptz NOT NULL,
max_marks integer NOT NULL CHECK (max_marks BETWEEN 1 AND
1000),
allow_resubmission boolean NOT NULL DEFAULT true,
max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts
BETWEEN 1 AND 10),
allow_late boolean NOT NULL DEFAULT true,
late_penalty_percent integer NOT NULL DEFAULT 10 CHECK
(late_penalty_percent BETWEEN 0 AND 100),
allowed_extensions text[] NOT NULL CHECK
(cardinality(allowed_extensions) >= 1),
max_file_mb integer NOT NULL DEFAULT 2 CHECK (max_file_mb BETWEEN
1 AND 3),
grading_started boolean NOT NULL DEFAULT false,
version integer NOT NULL DEFAULT 1,
status text NOT NULL DEFAULT 'draft' CHECK (status IN
('draft', 'published')),
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
CONSTRAINT assignments_deadline_after_open CHECK (deadline > open_at)
);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments
(course_code);
CREATE INDEX IF NOT EXISTS idx_assignments_instructor ON assignments
(instructor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments (deadline)
WHERE status = 'published';
CREATE TABLE IF NOT EXISTS rubric_criteria (
id uuid PRIMARY KEY,
assignment_id uuid NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
position integer NOT NULL CHECK (position >= 1),
name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
description text NOT NULL DEFAULT '' CHECK (char_length(description) <=
300),
max_marks numeric(8,2) NOT NULL CHECK (max_marks > 0),
CONSTRAINT rubric_position_unique UNIQUE (assignment_id, position)
);
CREATE INDEX IF NOT EXISTS idx_rubric_assignment ON rubric_criteria
(assignment_id);
CREATE TABLE IF NOT EXISTS submissions (
assignment_id uuid NOT NULL REFERENCES assignments (id) ON DELETE RESTRICT,
student_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
attempt_no integer NOT NULL CHECK (attempt_no >= 1),
file_name text NOT NULL,
mime_type text NOT NULL DEFAULT '',
size_bytes integer NOT NULL CHECK (size_bytes > 0),
sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
s3_key text NOT NULL,
comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 500),
is_late boolean NOT NULL,
submitted_at timestamptz NOT NULL DEFAULT now(),
PRIMARY KEY (assignment_id, student_id, attempt_no),
CONSTRAINT submissions_hash_unique UNIQUE (assignment_id, student_id,
sha256)
);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions
(student_id);
CREATE TABLE IF NOT EXISTS grades (
assignment_id uuid NOT NULL,
student_id uuid NOT NULL,
attempt_no integer NOT NULL,
grader_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
raw_marks numeric(8,2) NOT NULL CHECK (raw_marks >= 0),
late_penalty numeric(8,2) NOT NULL DEFAULT 0 CHECK (late_penalty >= 0),
final_marks numeric(8,2) NOT NULL CHECK (final_marks >= 0),
feedback text NOT NULL CHECK (char_length(feedback) BETWEEN 1 AND
2000),
status text NOT NULL CHECK (status IN ('draft', 'published')),
graded_at timestamptz NOT NULL DEFAULT now(),
published_at timestamptz,
PRIMARY KEY (assignment_id, student_id, attempt_no),
FOREIGN KEY (assignment_id, student_id, attempt_no)
REFERENCES submissions (assignment_id, student_id, attempt_no) ON DELETE
CASCADE,
CONSTRAINT grades_published_consistent CHECK ((status = 'published') =
(published_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS grade_scores (
assignment_id uuid NOT NULL,
student_id uuid NOT NULL,
attempt_no integer NOT NULL,
criterion_id uuid NOT NULL REFERENCES rubric_criteria (id) ON DELETE
RESTRICT,
marks numeric(8,2) NOT NULL CHECK (marks >= 0),
comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 300),
PRIMARY KEY (assignment_id, student_id, attempt_no, criterion_id),
FOREIGN KEY (assignment_id, student_id, attempt_no)
REFERENCES grades (assignment_id, student_id, attempt_no) ON DELETE
CASCADE
);
CREATE TABLE IF NOT EXISTS grade_history (
id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
assignment_id uuid NOT NULL,
student_id uuid NOT NULL,
attempt_no integer NOT NULL,
raw_marks numeric(8,2) NOT NULL,
late_penalty numeric(8,2) NOT NULL,
final_marks numeric(8,2) NOT NULL,
feedback text NOT NULL,
previous_status text NOT NULL,
recorded_at timestamptz NOT NULL DEFAULT now(),
FOREIGN KEY (assignment_id, student_id, attempt_no)
REFERENCES submissions (assignment_id, student_id, attempt_no) ON DELETE
CASCADE
);
CREATE INDEX IF NOT EXISTS idx_grade_history_sub ON grade_history
(assignment_id, student_id, attempt_no);
CREATE TABLE IF NOT EXISTS notifications (
id uuid PRIMARY KEY,
user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
dedupe_key text NOT NULL,
type text NOT NULL,
message text NOT NULL CHECK (char_length(message) <= 300),
assignment_id uuid,
is_read boolean NOT NULL DEFAULT false,
created_at timestamptz NOT NULL DEFAULT now(),
CONSTRAINT notifications_dedupe UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id,
is_read, created_at DESC);
