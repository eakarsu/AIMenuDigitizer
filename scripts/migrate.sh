#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATABASE_URL:?Set DATABASE_URL explicitly; startup never applies migrations.}"
for migration in "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"/backend/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; done
