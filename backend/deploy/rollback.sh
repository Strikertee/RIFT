#!/usr/bin/env bash
set -euo pipefail

: "${RIFT_VM_HOST:?Set RIFT_VM_HOST, e.g. ubuntu@192.0.2.10.}"
RIFT_REMOTE_DIR="${RIFT_REMOTE_DIR:-/opt/rift}"
RIFT_DEPLOY_MODE="${RIFT_DEPLOY_MODE:-backend}"

SSH_KEY_ARGS=()
if [ -n "${RIFT_SSH_KEY:-}" ]; then
  SSH_KEY_ARGS=(-i "$RIFT_SSH_KEY")
fi

if [ "$RIFT_DEPLOY_MODE" = "full" ]; then
  COMPOSE_FILE="backend/deploy/docker-compose.full.yml"
else
  COMPOSE_FILE="backend/deploy/docker-compose.backend.yml"
fi

ssh -o StrictHostKeyChecking=accept-new "${SSH_KEY_ARGS[@]}" "$RIFT_VM_HOST" "RIFT_REMOTE_DIR='$RIFT_REMOTE_DIR' COMPOSE_FILE='$COMPOSE_FILE' bash -s" <<'REMOTE'
set -euo pipefail
cd "$RIFT_REMOTE_DIR"
if [ ! -f backend/deploy/.last_green_commit ]; then
  echo "No last green commit recorded on the VM." >&2
  exit 1
fi
COMMIT="$(cat backend/deploy/.last_green_commit)"
echo "Rolling back to $COMMIT"
git checkout "$COMMIT"
docker compose --env-file .env -f "$COMPOSE_FILE" up -d --build
docker compose --env-file .env -f "$COMPOSE_FILE" exec -T backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').read().decode())"
REMOTE

echo "Rollback complete. Database data was not deleted."
