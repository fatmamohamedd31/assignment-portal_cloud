# Verification and demonstration checklist

Use this checklist against the actual configured environment. Do not mark a step complete based only on source code or a successful frontend build.

## Environment and startup

- [ ] `backend/.env` contains a valid Neon pooled `DATABASE_URL` and private application secrets.
- [ ] Floci starts and is reachable at `http://localhost:4566`.
- [ ] `cd backend; npm run setup` completes and reports the expected database tables and Floci resources.
- [ ] `cd backend; npm run dev` starts the API; `http://localhost:3000/api/health` reports `status: ok`.
- [ ] `cd frontend; npm run dev` starts the frontend and it can reach the API.

## End-to-end user flow

- [ ] Register an instructor with the configured invite code and sign in.
- [ ] Create a course and an assignment with a due date.
- [ ] Register and sign in as a student; verify the course and assignment are visible.
- [ ] Submit a permitted file and verify the submission appears in the student's status page and instructor's submission list.
- [ ] Grade the submission; verify the result and feedback appear for the student.
- [ ] Verify notifications and the instructor report page.
- [ ] If the hourly scheduler is part of the demonstration, verify its reminder endpoint using a non-production dataset.

## Evidence to capture

Save requested screenshots or logs in this folder, with personal details and secrets hidden. Useful evidence includes:

- Successful startup and API health response
- Instructor course and assignment setup
- Student submission status
- Instructor grading view
- Student result and instructor report
- Neon schema/table confirmation, without showing the connection string

Record the date, environment (development or demo), and any failed steps alongside the evidence. Do not store credentials, access tokens, or private student information here.
