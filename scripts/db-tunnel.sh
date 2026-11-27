#!/usr/bin/env bash
# Forward local 127.0.0.1:$DB_PORT (3307) to MariaDB on the VPS (127.0.0.1:3306), so the
# database port never has to be exposed. Keep it running while you develop. Ctrl+C closes it.
set -euo pipefail
source "$(dirname "$0")/_env.sh"

echo "DB tunnel: 127.0.0.1:${DB_TUNNEL_PORT} -> ${SSH_HOST} 127.0.0.1:${DB_REMOTE_PORT} (Ctrl+C to close)"
exec ssh "${SSH_OPTS[@]}" -N -o ExitOnForwardFailure=yes \
  -L "127.0.0.1:${DB_TUNNEL_PORT}:127.0.0.1:${DB_REMOTE_PORT}" "${SSH_USER}@${SSH_HOST}"
