#!/usr/bin/env bash
# Make sure the SSH tunnel to the VPS database is open before `npm run dev`.
# If 127.0.0.1:$DB_PORT already answers, do nothing; otherwise open it in the background
# (`ssh -f`: it detaches once the forward is up). Close it with `npm run db:tunnel:stop`.
# Never fails the dev server: without a tunnel the pages show a friendly error instead.
set -uo pipefail
source "$(dirname "$0")/_env.sh"

if nc -z 127.0.0.1 "$DB_TUNNEL_PORT" 2>/dev/null; then
  echo "DB tunnel: already open on 127.0.0.1:${DB_TUNNEL_PORT}"
  exit 0
fi

if ssh "${SSH_OPTS[@]}" -f -N -o ExitOnForwardFailure=yes \
  -L "127.0.0.1:${DB_TUNNEL_PORT}:127.0.0.1:${DB_REMOTE_PORT}" "${SSH_USER}@${SSH_HOST}"; then
  echo "DB tunnel: opened on 127.0.0.1:${DB_TUNNEL_PORT} (stays open; npm run db:tunnel:stop closes it)"
else
  echo "DB tunnel: could not open it. Pages that read the database will show an error until you run npm run db:tunnel." >&2
fi
exit 0
