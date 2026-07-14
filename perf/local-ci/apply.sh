#!/usr/bin/env bash
# =============================================================================
# perf/local-ci/apply.sh — build a Docker-less local validation DB.
# ONLY for environments without Docker (CI/automation). On a dev machine use
# `supabase start` + `supabase db reset` instead.
#
# Creates $DB, applies the shim + all repo migrations (011 after seed.sql, since
# it depends on seed shops) with function-body checks off.
#
# Env: PGHOST(127.0.0.1) PGPORT(5432) PGUSER(postgres) DB(bg_perf)
# Usage: DB=bg_perf perf/local-ci/apply.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${PGHOST:=127.0.0.1}" "${PGPORT:=5432}" "${PGUSER:=postgres}" "${DB:=bg_perf}"
export PGHOST PGPORT PGUSER
PSQL="psql -v ON_ERROR_STOP=1 -q"
APPLY="PGOPTIONS=-c\ check_function_bodies=off $PSQL"

echo "▶ (re)creating database $DB on $PGHOST:$PGPORT"
$PSQL -d postgres -c "DROP DATABASE IF EXISTS ${DB};" -c "CREATE DATABASE ${DB};"

echo "▶ applying Supabase shim"
eval "$APPLY -d $DB -f $ROOT/perf/local-ci/bootstrap.sql" >/dev/null

echo "▶ applying migrations (011 deferred until after seed.sql)"
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  base="$(basename "$f")"
  if [ "$base" = "011_dev_auth_user.sql" ]; then echo "  · skip $base (after seed)"; continue; fi
  eval "$APPLY -d $DB -f \"$f\"" >/dev/null
  echo "  ✓ $base"
done

echo "▶ applying pilot seed.sql then 011"
eval "$APPLY -d $DB -f $ROOT/supabase/seed.sql" >/dev/null && echo "  ✓ seed.sql"
eval "$APPLY -d $DB -f $ROOT/supabase/migrations/011_dev_auth_user.sql" >/dev/null && echo "  ✓ 011_dev_auth_user.sql"

echo "✅ $DB ready for perf/seed + perf/invariants validation."
