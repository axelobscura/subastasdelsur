#!/usr/bin/env bash
# Archive the production photos on the VPS (MEDIA_DIR, default /srv/nextjs/shared/uploads) to
# $BACKUP_DIR/uploads-<UTC stamp>.tar.gz, next to the DB dumps, keeping the newest $BACKUP_KEEP.
set -euo pipefail
source "$(dirname "$0")/_env.sh"

MEDIA_DIR="$(env_get MEDIA_DIR /srv/nextjs/shared/uploads)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" 'bash -s' <<REMOTE
set -euo pipefail
umask 077
dir=$(printf '%q' "$BACKUP_DIR")
src=$(printf '%q' "$MEDIA_DIR")
out="\$dir/uploads-${stamp}.tar.gz"
mkdir -p "\$dir"
[ -d "\$src" ] || { echo "No media folder at \$src"; exit 1; }
tar -czf "\$out" -C "\$(dirname "\$src")" "\$(basename "\$src")"
ls -1t "\$dir"/uploads-*.tar.gz | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm --
echo "Media backup: \$out (\$(du -h "\$out" | cut -f1), \$(find "\$src" -type f -name '*.webp' | wc -l) photos)"
REMOTE
