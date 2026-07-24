#!/usr/bin/env bash
set -Eeuo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$project_dir"
[ -f .env ] || { echo 'Missing .env; copy .env.example and supply real secrets.' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a
JWT_SECRET_VALUE="${JWT_SECRET:-}"; [ "${#JWT_SECRET_VALUE}" -ge 32 ] || { echo 'JWT_SECRET must contain at least 32 characters.' >&2; exit 1; }
[ -n "${DATABASE_URL:-}" ] || { echo 'DATABASE_URL is required.' >&2; exit 1; }
BACKEND_PORT="${BACKEND_PORT:?BACKEND_PORT is required}"; FRONTEND_PORT="${FRONTEND_PORT:?FRONTEND_PORT is required}"
for d in backend/node_modules frontend/node_modules; do [ -d "$d" ] || { echo "Missing $d; prepare dependencies per OPERATIONS.md." >&2; exit 1; }; done
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if lsof -ti ":$port" >/dev/null 2>&1; then echo "Port $port is occupied; refusing to terminate another process." >&2; exit 1; fi; done
pids=(); cleanup(){ for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done; }; trap cleanup EXIT INT TERM
(cd backend && BACKEND_PORT="$BACKEND_PORT" npm start) & pids+=("$!"); (cd frontend && VITE_API_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT" npm run dev -- --host "${FRONTEND_HOST:-127.0.0.1}" --port "$FRONTEND_PORT" --strictPort) & pids+=("$!"); wait "${pids[@]}"
