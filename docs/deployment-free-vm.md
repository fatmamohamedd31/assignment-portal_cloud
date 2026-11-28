# Free-tier VM deployment guide

This deployment runs the web app, API, and Floci emulator together on one cloud VM. The frontend is served over HTTPS by Caddy; API and Floci ports stay private to the Docker network. Neon remains the PostgreSQL database.

## Cloud account and VM

1. Create an Oracle Cloud Free Tier account and select your home region. In Oracle Cloud Console, create an Ubuntu ARM64 VM using an Always Free-eligible Ampere A1 shape in the home region. Choose 1 OCPU and 6 GB memory to stay within the documented monthly Always Free compute allowance. Capacity may be unavailable in a region. Oracle can reclaim Always Free compute that meets its idle criteria, so this is suitable for a student demo, not a guaranteed always-on production service.
2. Assign a public IPv4 address and create an SSH key pair. Keep the private key safe.
3. In the VM subnet/security list, allow inbound TCP 22 only from your own current IP address, plus TCP 80 and 443 from the internet. Do not expose ports 3000 or 4566.
4. Copy the public IP shown by the instance details.

## Free HTTPS name

1. Register a free DuckDNS subdomain, for example assignment-portal-demo.duckdns.org.
2. Point that subdomain at the VM public IPv4 address in DuckDNS.
3. Wait until the name resolves to that IP before starting Caddy. Caddy obtains and renews the HTTPS certificate automatically when the DNS name points to the VM and ports 80/443 are reachable.

## Prepare Ubuntu

SSH into the VM with the username shown for its Ubuntu image (commonly ubuntu) and the private key you saved. Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu instructions. Then install Git:

    sudo apt-get update
    sudo apt-get install -y git

Clone the team repository and the branch containing these deployment files:

    git clone --branch fatmas-branch TEAM_REPOSITORY_URL assignment-portal
    cd assignment-portal

Replace TEAM_REPOSITORY_URL with the real GitHub repository URL. For a private repository, use GitHub SSH access; do not put a personal access token in the command or report.

## Add private settings on the VM

Create the backend environment file from the example and edit it:

    cp backend/.env.example backend/.env
    nano backend/.env

Set DATABASE_URL to the Neon pooled connection string for the branch you intend to use. Set JWT_SECRET, CRON_SECRET, and INSTRUCTOR_INVITE_CODE to private values. For a demonstration using the included public Turnstile test site key, set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA. This is a test-only key combination; create real Turnstile keys before general public use.

Create the site name file at the repository root:

    printf 'APP_DOMAIN=your-subdomain.duckdns.org\n' > .env.cloud

Replace your-subdomain.duckdns.org with the exact DuckDNS name you registered. Neither .env nor .env.cloud should be committed.

## Start and verify

From the repository root on the VM:

    docker compose -f infra/cloud/docker-compose.yml up -d --build
    docker compose -f infra/cloud/docker-compose.yml logs -f api

Wait for the API to report that it is listening and setup to finish. Press Ctrl+C to stop following logs; the containers keep running. Then open https://your-subdomain.duckdns.org/api/health; it should return a JSON status of ok. Open https://your-subdomain.duckdns.org/ and complete an end-to-end workflow.

For deployment evidence, capture the browser with the HTTPS address visible, the API health response, and a successful submission workflow. Floci remains an AWS-compatible emulator hosted inside the cloud VM, not production AWS. Keep the VM in the Always Free allocation and check the console cost estimate before creating resources.
