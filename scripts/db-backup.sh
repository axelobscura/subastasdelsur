#!/usr/bin/env bash
# Dump the production database on the VPS to $BACKUP_DIR/<db>-<UTC stamp>.sql.gz and keep
# the newest $BACKUP_KEEP dumps. `npm run db:migrate` runs this first. Works without the tunnel.
# The password goes to the VPS on stdin (inside the script), never as a command-line argument.
set -euo pipefail
source "$(dirname "$0")/_env.sh"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"

ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" 'bash -s' <<REMOTE
set -euo pipefail
umask 077
export MYSQL_PWD=$(printf '%q' "$DB_PASSWORD")
dir=$(printf '%q' "$BACKUP_DIR")
out="\$dir/$(printf '%q' "$DB_NAME")-${stamp}.sql.gz"
mkdir -p "\$dir"
dump="\$(command -v mariadb-dump || command -v mysqldump)"
"\$dump" -h 127.0.0.1 -P ${DB_REMOTE_PORT} -u $(printf '%q' "$DB_USER") \
  --single-transaction --no-tablespaces --routines --triggers \
  $(printf '%q' "$DB_NAME") | gzip > "\$out"
ls -1t "\$dir"/$(printf '%q' "$DB_NAME")-*.sql.gz | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm --
echo "Backup: \$out (\$(du -h "\$out" | cut -f1))"
REMOTE
