# Nobus VM deployment — RIFT backend

Everything in this folder is owned by Builder A and lives under `backend/**`. It does not touch `frontend/**`, the root README, or the shared specification files. The integration coordinator can copy the full-stack compose file to the repository root later if the team wants the canonical path.

## Research result (checked 2026-11-25)

Nobus public documentation supports:

1. **Manual VM creation** through the console — fully documented.
2. **Semi-automated VM creation** through CloudOrchestration Stacks — template-based, launched from the dashboard.
3. **Automated app deployment** over SSH — fully doable with the scripts here.
4. **Fully automated VM creation via public API** — not safely implementable from public docs. Nobus mentions a native ReST API and a CloudFormation-compatible Query API for orchestration, but the public docs do not publish an endpoint, authentication flow, or API-key creation steps. IAM docs also do not document API keys. Do not invent credentials or endpoints; ask Nobus support if you need that path.

Sources:

- FCS instance launch: https://nobus.io/documentation/fcs
- Floating IPs: https://nobus.io/documentation/networking#floating-ips
- Security groups: https://nobus.io/documentation/networking#security-groups
- DNS: https://nobus.io/documentation/dns
- CloudOrchestration: https://nobus.io/documentation/cloud-orchestration/
- Managed PostgreSQL: https://nobus.io/documentation/database-services#postgresql
- Console: https://dashboard.nobus.io/

Note: the kit mentions PostgreSQL 15, but Nobus currently documents managed PostgreSQL **16.9**. The compose files here use `postgres:15-alpine`; the backend uses asyncpg and is not tied to a 15-only feature.

---

## Nobus launch form — exact field mapping

Use these values when the launch screen shows the fields below:

| Field on screen | Value |
| --- | --- |
| Availability Zone | `nobus-wa-az1 (los1)` |
| Instance Name | `rift-core-demo` |
| Image | `Ubuntu-Linux-24` is fine; our Docker setup does not depend on Ubuntu 22.04 specifically |
| Instance Type | `Standard Instances` |
| Spec | Choose the smallest offered spec with at least 2 vCPU / 4 GB RAM / 20 GB disk |
| Volume Size | `30` GB |
| Keypair | Select `rift-nobus-key`; create it under **Compute → Keypairs** first if missing |
| Recovery Password | Leave empty |
| Instances Count | `1` |
| Encrypt Disk | Leave default/off for the demo |
| Network | Keep `inet-pub2` selected |
| Network Port | Leave empty |
| Security Groups | Select a custom `rift-demo-sg`, not just `default` |
| User Data | Optional: upload/paste `backend/deploy/user-data.txt` |

Why the custom security group: the default group usually does not allow SSH from your laptop. Add inbound rules for:

- TCP `22`, remote `YOUR_IP/32`
- TCP `80`, remote `0.0.0.0/0`
- TCP `443`, remote `0.0.0.0/0`

The `User Data` script installs Docker, Docker Compose, Git, curl and OpenSSL on first boot. If you skip it, `deploy.sh` installs the same tools later. The SSH user for Ubuntu images is `ubuntu`.

If `inet-pub2` gives the instance a reachable public IP, you may not need a floating IP. If the IP is private or unreachable, allocate and associate one using the steps below.

---

## Path A — manual VM creation, then manual deployment

### A1. Create the VM in the Nobus console

1. Open `https://dashboard.nobus.io/`.
2. On the **Project** tab, open **Compute** → **Instances**.
3. Click **Launch Instance**.
4. Under **Details tab**:
   - **Instance Name**: `rift-core-demo`
   - **Description**: `RIFT Core FastAPI backend`
   - **Availability Zone**: default `nova` unless your project differs
   - **Instance Count**: `1`
5. Under **Instance Boot Source**:
   - Choose **Boot from image**
   - **Image Name**: `Ubuntu-22.04-64bit` (or the Ubuntu 22.04 image actually shown)
   - Volume size: `30` GB
6. Under **Instance Type tab** → **Spec**, choose the smallest spec offered in your project. Nobus docs show different example names (`si.2.4.30l` and `si.2.2.30.l`), so trust the console list, not the docs example.
7. Under **Networks tab** → **Selected Networks**, click `+` and select your project network.
8. Under **Security Groups tab**, attach a group with these inbound rules:
   - `Custom TCP Rule`, port `22`, remote = your own IP CIDR (for example `203.0.113.5/32`)
   - `Custom TCP Rule`, port `80`, remote `0.0.0.0/0`
   - `Custom TCP Rule`, port `443`, remote `0.0.0.0/0`
9. Under **Key Pair tab**:
   - Choose **Create a new key pair**
   - Name it `rift-nobus-key`
   - Click **Create Keypair**
   - Click **Copy private key to clipboard**
   - Save it locally as `rift-nobus-key.pem`
   - Click **Close**
   - This is the only chance to save the private key.
10. Click **Launch Instance**.
11. Allocate a floating IP:
   - Go to **Project** → **Network** → **Floating IPs**
   - Click **ALLOCATE IP TO PROJECT**
   - Select a pool, add a description, click **ALLOCATE IP**
   - Select the IP, click **Associate**, then choose the instance and port
   - Alternative: **Project** → **Compute** → **Instances** → **actions** → **ASSOCIATE FLOATING IP**
12. Add DNS:
   - Go to **Project** → **DNS** → **Zones** → **Create Zone**
   - Enter your domain, click **Submit**
   - Create an **A** record pointing to the floating IP
   - At your registrar, set NS to `ns1.nobus.com` and `ns2.nobus.com` if using Nobus DNS
13. SSH in:

```bash
chmod 600 rift-nobus-key.pem
ssh -i rift-nobus-key.pem ubuntu@<FLOATING_IP>
```

### A2. Deploy manually on the VM

Run these on the VM after SSH:

```bash
bash /tmp/rift-bootstrap-vm.sh   # or run the commands in bootstrap-vm.sh
sudo git clone -b master <REPO_URL> /home/ubuntu/rift
sudo chown -R ubuntu:ubuntu /home/ubuntu/rift
cd /home/ubuntu/rift
cp backend/deploy/.env.example .env
```

Generate secrets:

```bash
openssl rand -hex 32   # DB_PASSWORD
openssl rand -hex 32   # ISSUER_PRIVATE_KEY_HEX
openssl rand -hex 32   # ADMIN_SECRET
openssl rand -hex 32   # RELAY_API_KEY
```

Edit `.env` and set `RIFT_DOMAIN`, `ADMIN_EMAIL`, `VITE_API_BASE_URL=https://<domain>`, and the generated values. `VITE_RELAY_API_KEY` must equal `RELAY_API_KEY`. Then:

```bash
chmod 600 .env
docker compose --env-file .env -f backend/deploy/docker-compose.backend.yml up -d --build
docker compose --env-file .env -f backend/deploy/docker-compose.backend.yml exec -T backend alembic upgrade head
docker compose --env-file .env -f backend/deploy/docker-compose.backend.yml exec -T backend python -m scripts.seed_demo_data
docker compose --env-file .env -f backend/deploy/docker-compose.backend.yml exec -T backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').read().decode())"
```

Backend-only mode publishes port 8000 only on `127.0.0.1`. Use an SSH tunnel if you need local access:

```bash
ssh -i rift-nobus-key.pem -L 8000:127.0.0.1:8000 ubuntu@<FLOATING_IP>
```

---

## Path B — semi-automated VM creation, then scripted deployment

### B1. Launch the stack

1. Confirm the final integrated build is pushed to the remote `master` branch.
2. Log in to `https://dashboard.nobus.io/`.
3. Go to **Orchestration** → **Stacks**.
4. Click **Launch Stack**.
5. **Template Source**: **File**, select `backend/deploy/nobus-stack.yaml`.
6. Fill parameters:
   - `server_name`: `rift-core-demo`
   - `image`: the exact image name in your project
   - `flavor`: the exact spec in your project
   - `key_name`: an existing Nobus keypair name
   - `network`: your project network
   - `ssh_cidr`: your IP as `x.x.x.x/32` — do not leave `0.0.0.0/0` outside the demo
   - `admin_email`: your real email for TLS notices
7. Click **Launch**.
8. Attach a floating IP using the console steps in A1. The stack template does not do that because the floating-IP pool name differs per project.

### B2. Deploy the app from your laptop

```bash
export RIFT_REPO_URL="https://github.com/Strikertee/RIFT.git"
export RIFT_VM_HOST="ubuntu@<FLOATING_IP>"
export RIFT_SSH_KEY="C:/path/to/rift-nobus-key.pem"
export RIFT_DOMAIN="portal.example.test"
export RIFT_ADMIN_EMAIL="you@example.com"
export RIFT_BRANCH="master"
export RIFT_DEPLOY_MODE="full"

bash backend/deploy/deploy.sh
bash backend/deploy/verify.sh
```

`deploy.sh` is idempotent: it installs Docker tools, clones or updates the repo, creates `.env` once with fresh secrets, builds the images, runs migrations and seed, and records the last green commit on the VM.

The integrated build already contains the frontend, `frontend/Dockerfile`, and the root compose stack. Use `full` mode for the real deployment. If you only want to test the API without the frontend/TLS stack, set:

```bash
export RIFT_DEPLOY_MODE="backend"
bash backend/deploy/deploy.sh
```

Full mode requires DNS already pointing at the VM. Caddy terminates TLS and routes `/api/*` to the backend.

---

## Path C — fully automated VM provisioning

Do not write a fake API script. Nobus public docs confirm orchestration APIs exist but do not publish the endpoint, token creation, or request examples needed to call them reliably. If you get those details from Nobus support, the thin automation should:

1. Authenticate with the provided API token.
2. POST `backend/deploy/nobus-stack.yaml` as a stack.
3. Poll stack status until `CREATE_COMPLETE`.
4. Associate a floating IP from the project pool.
5. Call `backend/deploy/deploy.sh` with the new IP.

Until step 1 is real, Path B is the highest safe level of automation.

---

## Verification and rollback

```bash
curl https://$RIFT_DOMAIN/api/v1/health
bash backend/deploy/verify.sh
bash backend/deploy/rollback.sh
```

Rollback checks out `.last_green_commit` on the VM and rebuilds containers. It does **not** delete database data.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| SSH refused | Security group must allow port 22 from your IP; check floating IP association. |
| Caddy TLS fails | DNS A record must point to the floating IP; ports 80/443 must be open. |
| Public API 502 | Check `docker compose logs backend`; verify health from inside the container. |
| Relay 401 | `VITE_RELAY_API_KEY` must equal `RELAY_API_KEY`. |
| Migration fails | Use a fresh PostgreSQL volume; do not copy a rehearsal SQLite DB. |
| `bad interpreter` in entrypoint | Normalize CRLF: `sed -i 's/\r$//' backend/docker-entrypoint.sh`. |
| Frontend blank page in full mode | Confirm Builder B supplied `frontend/Dockerfile` and `frontend/nginx.conf`. |
