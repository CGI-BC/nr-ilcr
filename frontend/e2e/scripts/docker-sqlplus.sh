#!/usr/bin/env bash
# Forwards sqlplus invocations into the local seeded-DB Docker container's own Oracle client,
# for hosts (like this dev container) that have no system-wide `sqlplus`/Oracle Instant Client on PATH.
# You don't invoke this directly — apply-patches.sh / teardown-patches.sh auto-select it when no local
# `sqlplus` is found. Container name comes from DB_CONTAINER (see .env.example).
set -euo pipefail

# Default matches the pre-seeded image's container (docker run --name real-data-seeded-db …); override
# with DB_CONTAINER if you named it differently — name yours `real-data-seeded-<app>-db`
# (e.g. `real-data-seeded-ilcr-db`).
CONTAINER="${DB_CONTAINER:-real-data-seeded-db}"
SQLPLUS_BIN="${DB_SQLPLUS_BIN:-/opt/oracle/product/26ai/dbhomeFree/bin/sqlplus}"
# Callers pass the HOST-facing DSN (port 1525, the container's published port); translate to the
# CONTAINER-internal listener port (1521) since sqlplus runs inside the container via docker exec.
HOST_PORT="${DB_HOST_PORT:-1525}"
CONTAINER_PORT="${DB_CONTAINER_PORT:-1521}"

args=()
for a in "$@"; do
  args+=("${a//:$HOST_PORT\//:$CONTAINER_PORT/}")
done

exec docker exec -i "$CONTAINER" "$SQLPLUS_BIN" "${args[@]}"
