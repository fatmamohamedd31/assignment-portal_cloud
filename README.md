# Assignment Portal

A React and Express assignment portal backed by PostgreSQL (Neon) and an S3/SNS/SQS/CloudWatch-compatible local service (Floci).

## Prerequisites

- Node.js 20 or newer and npm
- Docker Desktop, when running Floci or the containerized app
- A PostgreSQL connection string for Neon, or another compatible PostgreSQL database

## Configure the environment

1. Create a Neon project with separate `development` and `demo` branches.
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `DATABASE_URL` to the pooled connection string for the branch you intend to use. Keep the connection string, JWT secret, cron secret, instructor invite code, and Turnstile secret private. Do not commit `.env` files.
4. Set `JWT_SECRET` and `CRON_SECRET` to long random values. Set `INSTRUCTOR_INVITE_CODE` to a value you give only to instructors.
5. For local development, leave `AWS_ENDPOINT_URL=http://localhost:4566` and `ASSIGNMENT_FANOUT=false`. Leave `TURNSTILE_SECRET_KEY` blank to disable Turnstile verification locally.

`frontend/.env.example` is for local Vite development. Set `VITE_API_URL=http://localhost:3000` if needed. Vite exposes variables prefixed with `VITE_` to the browser, so never put secrets there.

## Run locally

Start Floci in one terminal from the repository root:

```powershell
docker compose -f infra/floci/docker-compose.yml up -d floci
```

Install backend dependencies, apply the database schema, and start the API in another terminal:

```powershell
cd backend
npm ci
npm run setup
npm run dev
```

Start the web app in a third terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API health endpoint is `http://localhost:3000/api/health`.

## Run the containerized app

After configuring `backend/.env`, run from the repository root:

```powershell
docker compose -f infra/floci/docker-compose.yml --profile app up --build
```

The web app is available at `http://localhost:8080`, the API at `http://localhost:3000`, and Floci at `http://localhost:4566`. The Compose profile also starts the hourly reminder scheduler. Stop the services with `Ctrl+C`; use `docker compose -f infra/floci/docker-compose.yml --profile app down` to stop and remove the containers.

## Database commands

Run backend database commands from `backend/`:

```powershell
npm run setup       # apply schema and initialize Floci resources
npm run db:schema   # apply only the PostgreSQL schema
npm run db:reset    # destructive: remove and recreate application tables
```

The API applies the schema and initializes Floci resources during startup. `db:reset` deletes application data; use it only for a database you intend to clear.

To confirm Neon has the schema, run `SELECT count(*) FROM users;` in the Neon SQL Editor after setup. Use the development branch for local work and the demo branch for a demonstration.

## Application areas

- Account registration and login, with instructor registration protected by an invite code
- Course and assignment management
- Student assignment submissions and status tracking
- Instructor grading, results, and reports
- Notifications and scheduled reminders
- Submission file storage and asynchronous grading events

## Before a demonstration or deployment

- Confirm the Neon connection and schema are available.
- Confirm Floci starts and the API initializes its bucket, topics, queues, and log groups.
- Create an instructor account using the configured invite code, then create a course and assignment.
- Register a student, submit a file, grade it as the instructor, and verify the student can see the result.
- Keep screenshots or other requested evidence in `evidence/`; record any environment-specific setup in `docs/`.
- Use production secrets and a production Turnstile key for a public deployment. The Compose frontend currently uses Cloudflare's public test site key and is for local demonstrations.

## Project layout

- `backend/` — Express API, PostgreSQL schema, routes, and services
- `frontend/` — React/Vite application
- `infra/floci/` — Docker Compose services for Floci and the containerized app
- `docs/` and `evidence/` — project documentation and demonstration evidence
- `frontend-tmp/` — unused starter scaffold; the application frontend is `frontend/`
