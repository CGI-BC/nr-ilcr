#!/usr/bin/env bash
# ============================================================================
# Tear down the E2E real-test-data seed patches (reverse of apply-patches.sh).
#
# WHAT IT DOES: runs every `<domain>/*.teardown.sql` under
# ../real-test-data-patches/, in REVERSE discovery order, removing only the
# sentinel-marked (`E2E_SEED`) rows each patch added — leaving the real extract
# as found. Use it to reset a container to a pristine (un-patched) state, or
# before re-snapshotting a clean image.
#
# AUTO-DISCOVERY: same convention as apply — a new patch's `<name>.teardown.sql`
# is picked up automatically, no edit here.
#
# SETUP: identical to apply-patches.sh — nothing to configure. Auto-selects a local `sqlplus`, else
# the bundled Docker wrapper. Config from .env / the environment (ORACLE_DSN, DB_CONTAINER).
#
#   Usage:  ./scripts/teardown-patches.sh
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$HERE/../real-test-data-patches"

# Load .env from the e2e root if present, so ORACLE_DSN / DB_CONTAINER live in one place (standard
# `set -a; . .env` sourcing; the ${VAR:-default} defaults below fill anything .env doesn't set).
ENV_FILE="$HERE/../.env"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

ORACLE_DSN="${ORACLE_DSN:-THE/default@localhost:1525/DBDOCK_01}"

# Masked copy for the log line only — never echo the password (user/pw@host -> user/***@host).
# Caveats (this masks the LOG, not the process): the sed under-masks if the password itself contains
# '/' or '@' (it leaves part visible rather than failing); and the password is still passed to sqlplus
# in argv below, so it's visible via `ps` to any local user. Both are acceptable for the local throwaway
# THE/default seed DB. If this ever points at a real credential, switch to `sqlplus /nolog` + a CONNECT
# on stdin so the secret never reaches argv.
ORACLE_DSN_MASKED="$(printf '%s' "$ORACLE_DSN" | sed 's#/[^@/]*@#/***@#')"

# Auto-select the sqlplus client (same rule as apply-patches.sh: $SQLPLUS override, else local sqlplus, else Docker wrapper).
DB_CONTAINER="${DB_CONTAINER:-real-data-seeded-db}"; export DB_CONTAINER
if [ -n "${SQLPLUS:-}" ]; then
  echo "Using SQLPLUS override: $SQLPLUS"
elif command -v sqlplus >/dev/null 2>&1; then
  SQLPLUS="sqlplus"
  echo "Using local sqlplus."
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  SQLPLUS="$HERE/docker-sqlplus.sh"
  echo "No local sqlplus found -> running via Docker container '$DB_CONTAINER'."
else
  echo "ERROR: no local 'sqlplus' on PATH and no running Docker container named '$DB_CONTAINER'." >&2
  echo "  Fix one of: install an Oracle client (sqlplus), or start your seeded-DB container" >&2
  echo "  (set DB_CONTAINER in .env if it's named differently)." >&2
  exit 1
fi

shopt -s nullglob

echo "Tearing down E2E seed patches"
echo "  from: $PATCHES_DIR"
echo "  DSN:  $ORACLE_DSN_MASKED   (SQLPLUS=$SQLPLUS)"

teardowns=( "$PATCHES_DIR"/*/*.teardown.sql )
if [ "${#teardowns[@]}" -eq 0 ]; then
  echo "No teardown scripts found under $PATCHES_DIR — nothing to tear down."
  exit 0
fi

# Reverse order so patches undo in the opposite order they were applied.
for (( i=${#teardowns[@]}-1; i>=0; i-- )); do
  patch="${teardowns[i]}"
  rel="$(basename "$(dirname "$patch")")/$(basename "$patch")"
  echo ""
  echo "-> $rel"
  { printf 'WHENEVER SQLERROR EXIT SQL.SQLCODE\n'; cat "$patch"; printf '\nEXIT\n'; } \
    | "$SQLPLUS" -S -L "$ORACLE_DSN" | sed 's/^/    /'
done

echo ""
echo "Done. The seed rows are removed. Re-apply with ./scripts/apply-patches.sh"
echo "before running seed-dependent scenarios (and evict the LOV cache after)."
