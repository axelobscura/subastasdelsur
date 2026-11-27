#!/usr/bin/env bash
# Run the opt-in E2E flows that touch the production database (e2e/flows/)
# against a production build on port 3100. Emails are not sent: EMAIL_DRY_RUN writes them to
# a temp file that the test reads. Needs `npm run db:tunnel` running.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-3100}"
EMAIL_FILE="$(mktemp -t subastas-emails)"
export TZ=UTC EMAIL_DRY_RUN=1 EMAIL_DRY_RUN_FILE="$EMAIL_FILE" BETTER_AUTH_URL="http://localhost:${PORT}"

npx next build
npx next start -p "$PORT" > "${EMAIL_FILE}.server.log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; rm -f "$EMAIL_FILE"' EXIT

for _ in $(seq 1 60); do
  curl -fs -o /dev/null "http://localhost:${PORT}/" && break
  sleep 1
done

ALLOW_DB_TESTS=1 PLAYWRIGHT_BASE_URL="http://localhost:${PORT}" \
  npx playwright test e2e/flows --project=mexico-city "$@" || {
  status=$?
  echo "--- server log (${EMAIL_FILE}.server.log) ---"
  tail -n 60 "${EMAIL_FILE}.server.log"
  exit "$status"
}
rm -f "${EMAIL_FILE}.server.log"
