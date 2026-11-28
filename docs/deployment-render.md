# Render deployment guide

This setup deploys the React frontend and Express API from one Docker image, so Render assigns one HTTPS URL for the whole application. Floci runs as a private service and is reachable only by the API over Render's private network. Neon remains the PostgreSQL database.

## Before deploying

- Push the complete `fatmas-branch` (including `render.yaml`) to the team GitHub repository.
- Keep `backend/.env` out of Git. The Render service needs the Neon pooled connection string entered as `DATABASE_URL` in its Environment settings.
- The Floci service uses Render's `starter` plan. Review current pricing before creating it; this Blueprint does not create cloud resources by itself.
- The Turnstile values in this Blueprint are Cloudflare's public test keys. They are for demonstration only. For a publicly used app, replace both with keys created for the deployed site.

## Create the services

1. Sign in to Render and create a new Blueprint from the team GitHub repository and `fatmas-branch`.
2. Review the two services in `render.yaml`: `assignment-portal-floci` (private) and `assignment-portal` (public web service). Confirm the paid Floci plan and region before applying the Blueprint.
3. On the `assignment-portal` service, enter `DATABASE_URL` using the Neon pooled connection string for the intended branch. Do not put it in Git or a screenshot.
4. Set `INSTRUCTOR_INVITE_CODE` to a private value. Render generates `JWT_SECRET` and `CRON_SECRET` from the Blueprint.
5. Apply the Blueprint and wait for the Floci and API services to finish deploying. The API startup applies the schema and initializes the Floci bucket, topics, queue, and log groups.
6. Open the public `assignment-portal` URL shown by Render. Check `/api/health`, then register an instructor and student, create a course and assignment, submit a file, and verify the result.

## Evidence and limitations

Capture the Render public URL and working workflow after deployment. Also capture the service deploy status and the API health response. Do not claim deployment until the URL works from a browser outside localhost. The free web service may spin down when idle. Floci is an emulator, not production AWS; this deployment is a hosted demonstration environment. Use a real Turnstile key before exposing the app for general use.
