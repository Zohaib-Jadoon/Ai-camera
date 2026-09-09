#!/usr/bin/env bash
set -euo pipefail
umask 077
# Requires PostgreSQL 16 client tools and PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
# Creates a NEW database only; never overwrites or deletes a database.
: "${PGDATABASE:?Set the source database}"
task_source_database="$PGDATABASE"
task_restore_database="madad_restore_$(date -u +%Y%m%d%H%M%S)_${RANDOM}"
task_backup_dir="$(mktemp -d "${TMPDIR:-/tmp}/madad-backup.XXXXXXXX")"
pg_dump --format=custom --file="$task_backup_dir/database.dump" --dbname="$task_source_database"
sha256sum "$task_backup_dir/database.dump" > "$task_backup_dir/database.sha256"
createdb "$task_restore_database"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$task_restore_database" "$task_backup_dir/database.dump"
psql --dbname="$task_restore_database" --set=ON_ERROR_STOP=1 --command='SELECT count(*) AS cameras FROM "Camera"; SELECT count(*) AS recordings FROM "Recording"; SELECT count(*) AS alerts FROM "Alert";' > "$task_backup_dir/restore-check.txt"
printf 'Restored database: %s\nArtifacts: %s\n' "$task_restore_database" "$task_backup_dir"
printf 'Database and artifacts retained. This does not back up object storage or encryption keys.\n'
