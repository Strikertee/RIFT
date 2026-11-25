#!/usr/bin/env bash
set -euo pipefail

: "${RIFT_VM_HOST:?Set RIFT_VM_HOST, e.g. ubuntu@192.0.2.10.}"
RIFT_DOMAIN="${RIFT_DOMAIN:-portal.example.test}"
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

echo "Public health endpoint:"
curl -fsS "https://$RIFT_DOMAIN/api/v1/health" || echo "Public HTTPS health not available in backend-only mode."

echo
echo "Container status:"
ssh -o StrictHostKeyChecking=accept-new "${SSH_KEY_ARGS[@]}" "$RIFT_VM_HOST" \
  "docker compose --env-file '$RIFT_REMOTE_DIR/.env' -f '$RIFT_REMOTE_DIR/$COMPOSE_FILE' ps"

echo
echo "Recent backend logs:"
ssh -o StrictHostKeyChecking=accept-new "${SSH_KEY_ARGS[@]}" "$RIFT_VM_HOST" \
  "docker compose --env-file '$RIFT_REMOTE_DIR/.env' -f '$RIFT_REMOTE_DIR/$COMPOSE_FILE' logs --tail=50 backend"
