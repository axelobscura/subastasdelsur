# Shared by the db-*.sh scripts. Reads settings from the environment first, then
# from .env.local (gitignored). Never echo secrets.
ENV_FILE="${ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local}"

env_get() {
  local key="$1" default="${2-}" value="${!1-}"
  if [[ -z "$value" && -f "$ENV_FILE" ]]; then
    value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
  fi
  printf '%s' "${value:-$default}"
}

SSH_HOST="$(env_get SSH_HOST)"
SSH_PORT="$(env_get SSH_PORT 22)"
SSH_USER="$(env_get SSH_USER)"
SSH_KEY="$(env_get SSH_KEY)"
SSH_KEY="${SSH_KEY/#\~/$HOME}"
DB_NAME="$(env_get DB_NAME)"
DB_USER="$(env_get DB_USER)"
DB_PASSWORD="$(env_get DB_PASSWORD)"
DB_TUNNEL_PORT="$(env_get DB_PORT 3307)"   # local end of the tunnel
DB_REMOTE_PORT="$(env_get DB_REMOTE_PORT 3306)" # MariaDB port on the VPS
BACKUP_DIR="$(env_get BACKUP_DIR /root/backups/subastasdelsur)"
BACKUP_KEEP="$(env_get BACKUP_KEEP 20)"

for required in SSH_HOST SSH_USER SSH_KEY DB_NAME DB_USER DB_PASSWORD; do
  if [[ -z "${!required}" ]]; then
    echo "Missing $required (set it in .env.local)" >&2
    exit 1
  fi
done

SSH_OPTS=(-i "$SSH_KEY" -p "$SSH_PORT" -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=30)
