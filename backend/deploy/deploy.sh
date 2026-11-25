#!/usr/bin/env bash
set -euo pipefail

# Deploy from your local machine to an existing Ubuntu VM.
# Required: RIFT_REPO_URL, RIFT_VM_HOST
# Optional: RIFT_SSH_KEY, RIFT_BRANCH, RIFT_REMOTE_DIR, RIFT_DOMAIN,
#           RIFT_ADMIN_EMAIL, RIFT_DEPLOY_MODE=backend|full

: "${RIFT_REPO_URL:?Set RIFT_REPO_URL to the Git URL the VM can clone.}"
: "${RIFT_VM_HOST:?Set RIFT_VM_HOST, e.g. ubuntu@192.0.2.10.}"

RIFT_BRANCH="${RIFT_BRANCH:-master}"
RIFT_REMOTE_DIR="${RIFT_REMOTE_DIR:-/opt/rift}"
RIFT_DOMAIN="${RIFT_DOMAIN:-portal.example.test}"
RIFT_ADMIN_EMAIL="${RIFT_ADMIN_EMAIL:-admin@example.test}"
RIFT_DEPLOY_MODE="${RIFT_DEPLOY_MODE:-backend}"

if [ "$RIFT_DEPLOY_MODE" != "backend" ] && [ "$RIFT_DEPLOY_MODE" != "full" ]; then
  echo "RIFT_DEPLOY_MODE must be backend or full." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY_ARGS=()
if [ -n "${RIFT_SSH_KEY:-}" ]; then
  SSH_KEY_ARGS=(-i "$RIFT_SSH_KEY")
fi

ssh_exec() {
  ssh -o StrictHostKeyChecking=accept-new "${SSH_KEY_ARGS[@]}" "$RIFT_VM_HOST" "$@"
}

scp_exec() {
  scp "${SSH_KEY_ARGS[@]}" "$1" "$RIFT_VM_HOST:$2"
}

echo "Bootstrapping VM tools..."
scp_exec "$SCRIPT_DIR/bootstrap-vm.sh" "/tmp/rift-bootstrap-vm.sh"
ssh_exec "bash /tmp/rift-bootstrap-vm.sh"

echo "Cloning or updating the repository..."
ssh_exec "RIFT_REPO_URL='$RIFT_REPO_URL' RIFT_BRANCH='$RIFT_BRANCH' RIFT_REMOTE_DIR='$RIFT_REMOTE_DIR' RIFT_DOMAIN='$RIFT_DOMAIN' RIFT_ADMIN_EMAIL='$RIFT_ADMIN_EMAIL' RIFT_DEPLOY_MODE='$RIFT_DEPLOY_MODE' bash -s" <<'REMOTE'
set -euo pipefail

if [ ! -d "$RIFT_REMOTE_DIR/.git" ]; then
  if [ -d "$RIFT_REMOTE_DIR" ] && [ -n "$(ls -A "$RIFT_REMOTE_DIR")" ]; then
    echo "$RIFT_REMOTE_DIR exists but is not a Git checkout." >&2
    exit 1
  fi
  git clone --branch "$RIFT_BRANCH" "$RIFT_REPO_URL" "$RIFT_REMOTE_DIR"
else
  git -C "$RIFT_REMOTE_DIR" fetch --all --prune
  git -C "$RIFT_REMOTE_DIR" checkout "$RIFT_BRANCH"
  git -C "$RIFT_REMOTE_DIR" pull --ff-only origin "$RIFT_BRANCH"
fi

cd "$RIFT_REMOTE_DIR"

if [ ! -f .env ]; then
  cp backend/deploy/.env.example .env
  DB_PASSWORD="$(openssl rand -hex 32)"
  ISSUER_KEY="$(openssl rand -hex 32)"
  ADMIN_SECRET_VALUE="$(openssl rand -hex 32)"
  RELAY_KEY="$(openssl rand -hex 32)"
  sed -i "s|^APP_VERSION=.*|APP_VERSION=1.0.0|" .env
  sed -i "s|^RIFT_DOMAIN=.*|RIFT_DOMAIN=$RIFT_DOMAIN|" .env
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=$RIFT_ADMIN_EMAIL|" .env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env
  sed -i "s|^ISSUER_PRIVATE_KEY_HEX=.*|ISSUER_PRIVATE_KEY_HEX=$ISSUER_KEY|" .env
  sed -i "s|^ADMIN_SECRET=.*|ADMIN_SECRET=$ADMIN_SECRET_VALUE|" .env
  sed -i "s|^RELAY_API_KEY=.*|RELAY_API_KEY=$RELAY_KEY|" .env
  sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://$RIFT_DOMAIN|" .env
  sed -i "s|^VITE_RELAY_API_KEY=.*|VITE_RELAY_API_KEY=$RELAY_KEY|" .env
  chmod 600 .env
  echo "Generated a fresh .env on the VM. Save these secrets in a password manager."
fi

if [ "$RIFT_DEPLOY_MODE" = "full" ]; then
  COMPOSE_FILE="backend/deploy/docker-compose.full.yml"
  if [ ! -f frontend/Dockerfile ]; then
    echo "Full mode needs frontend/Dockerfile from Builder B." >&2
    exit 1
  fi
else
  COMPOSE_FILE="backend/deploy/docker-compose.backend.yml"
fi

docker compose --env-file .env -f "$COMPOSE_FILE" up -d --build
docker compose --env-file .env -f "$COMPOSE_FILE" exec -T backend alembic upgrade head
docker compose --env-file .env -f "$COMPOSE_FILE" exec -T backend python -m scripts.seed_demo_data

echo "Checking backend health from inside the VM..."
docker compose --env-file .env -f "$COMPOSE_FILE" exec -T backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').read().decode())"

git rev-parse HEAD > backend/deploy/.last_green_commit
docker compose --env-file .env -f "$COMPOSE_FILE" ps
REMOTE

echo "Deployment complete. Run backend/deploy/verify.sh to check the public endpoint."
