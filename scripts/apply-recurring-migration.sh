#!/usr/bin/env bash
# Apply recurring-schedule tables to your Supabase Postgres instance.
# In Supabase: Settings → Database → Connection string → URI (needs password).
# Usage:  export DATABASE_URL='postgresql://...'   ./scripts/apply-recurring-migration.sh

set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to your Supabase Postgres URI, then run this script again."
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/002_recurring_schedules.sql
echo "Migration applied."
