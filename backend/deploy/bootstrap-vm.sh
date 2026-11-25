#!/usr/bin/env bash
set -euo pipefail

# Run on a fresh Ubuntu VM as the ubuntu user (or root).
sudo_cmd=""
if [ "$(id -u)" -ne 0 ]; then
  sudo_cmd="sudo"
fi

echo "Installing Docker and deployment tools..."
$sudo_cmd apt-get update

compose_package="docker-compose-v2"
if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
  compose_package="docker-compose-plugin"
fi

$sudo_cmd DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git openssl docker.io "$compose_package"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found after installation." >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  $sudo_cmd usermod -aG docker "$(whoami)"
  echo "Added $(whoami) to the docker group. Log out and back in before running docker without sudo."
fi

docker --version
docker compose version
git --version
openssl version

echo "VM bootstrap complete."
