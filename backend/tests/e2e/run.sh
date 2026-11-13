#!/usr/bin/env bash
# End-to-end suites: the real Lambda handlers against a real Postgres built from
# infra/schema.sql + infra/migrations (down-migrations skipped). Claude, Foursquare, SES,
# S3, Lambda invokes and Stripe are stubbed inside each suite. No network to AWS needed.
#
# Needs: Postgres with SSL on (the shared layer always connects with SSL, as RDS needs),
#        /opt/nodejs -> backend/layers/shared/nodejs (as in Lambda), and `npm ci` run in
#        the layer, form-handler, blog-handler, profile and pdf-builder folders.
# Env:   E2E_DB_HOST (127.0.0.1) E2E_DB_USER (postgres) E2E_DB_PASSWORD ('') E2E_DB_NAME (wz_e2e)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
export E2E_DB_HOST="${E2E_DB_HOST:-127.0.0.1}" E2E_DB_USER="${E2E_DB_USER:-postgres}"
export E2E_DB_PASSWORD="${E2E_DB_PASSWORD:-}" E2E_DB_NAME="${E2E_DB_NAME:-wz_e2e}"
export PGPASSWORD="$E2E_DB_PASSWORD"
PSQL=(psql -h "$E2E_DB_HOST" -U "$E2E_DB_USER" -v ON_ERROR_STOP=1 -q)

if [ ! -e /opt/nodejs ]; then
  echo "/opt/nodejs is missing — run: sudo ln -s $ROOT/backend/layers/shared/nodejs /opt/nodejs" >&2
  exit 1
fi

echo "Building database $E2E_DB_NAME from schema + migrations"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $E2E_DB_NAME" -c "CREATE DATABASE $E2E_DB_NAME"
"${PSQL[@]}" -d "$E2E_DB_NAME" -f "$ROOT/infra/schema.sql" >/dev/null
for f in $(ls "$ROOT"/infra/migrations/*.sql | grep -v '\.down\.sql$' | sort); do
  "${PSQL[@]}" -d "$E2E_DB_NAME" -f "$f" >/dev/null
done

export NODE_PATH="/opt/nodejs/node_modules:$ROOT/backend/functions/blog-handler/node_modules:$ROOT/backend/functions/profile/node_modules:$ROOT/backend/functions/pdf-builder/node_modules${NODE_PATH:+:$NODE_PATH}"
export PDF_BUCKET=e2e-test-bucket

failed=()
for suite in "$ROOT"/backend/tests/e2e/*.e2e.js; do
  name=$(basename "$suite" .e2e.js)
  echo "::group::$name"
  if out=$(node "$suite" 2>&1); then status=ok; else status=FAILED; failed+=("$name"); fi
  echo "$out" | grep -E '^(PASS|FAIL)|passed|^ERR' || echo "$out" | tail -20
  echo "::endgroup::"
  echo "$name: $status — $(echo "$out" | grep -Eo '[0-9]+/[0-9]+ passed' | tail -1)"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "E2E FAILED: ${failed[*]}" >&2
  exit 1
fi
echo "All e2e suites passed"
