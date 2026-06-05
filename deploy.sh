#!/usr/bin/env bash
# Deploy tasks on the Ubuntu home server.
#
# Usage:
#   ./deploy.sh             -> deploys latest tag, falls back to main
#   ./deploy.sh main        -> latest origin/main
#   ./deploy.sh v1.0.0      -> exact tagged release

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "=> Fetching from origin (branches + tags)"
git fetch --tags --prune --force origin

if [[ $# -eq 0 ]]; then
  LATEST_TAG="$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]' | head -1)"
  if [[ -z "$LATEST_TAG" ]]; then
    echo "WARN: no version tags found — falling back to main branch" >&2
    REF="main"
  else
    REF="$LATEST_TAG"
    echo "=> No ref specified — deploying latest tag: $REF"
  fi
else
  REF="$1"
fi

if git rev-parse --verify --quiet "origin/$REF" >/dev/null; then
  TARGET="origin/$REF"
  KIND="branch"
elif git rev-parse --verify --quiet "refs/tags/$REF" >/dev/null; then
  TARGET="refs/tags/$REF"
  KIND="tag"
elif git rev-parse --verify --quiet "$REF^{commit}" >/dev/null; then
  TARGET="$REF"
  KIND="ref"
else
  echo "ERROR: cannot resolve '$REF' as a branch, tag, or commit" >&2
  exit 1
fi

SHA="$(git rev-parse --short "$TARGET^{commit}")"
echo "=> Resetting to $TARGET ($KIND, commit $SHA)"
git reset --hard "$TARGET"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found — copy .env.template to .env and fill in values" >&2
  exit 1
fi

set -a
source .env
set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set in .env}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in .env}"
: "${TASKS_DB_USER:?TASKS_DB_USER must be set in .env}"
: "${TASKS_DB_PASSWORD:?TASKS_DB_PASSWORD must be set in .env}"
: "${TASKS_DB_NAME:?TASKS_DB_NAME must be set in .env}"

echo "=> Ensuring Postgres role and database exist"
docker exec -i \
  postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=0 \
  -v tasks_user="$TASKS_DB_USER" \
  -v tasks_pw="$TASKS_DB_PASSWORD" \
  <<'SQL' || true
CREATE ROLE :"tasks_user" LOGIN PASSWORD :'tasks_pw';
ALTER ROLE :"tasks_user" WITH LOGIN PASSWORD :'tasks_pw';
SQL

if ! docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${TASKS_DB_NAME}'" | grep -q 1; then
  docker exec -i postgres createdb -U "$POSTGRES_USER" -O "$TASKS_DB_USER" "$TASKS_DB_NAME"
  echo "   created database $TASKS_DB_NAME"
else
  echo "   database $TASKS_DB_NAME already exists"
fi

echo "=> Building and restarting tasks stack ($KIND $REF @ $SHA)"
docker compose build --no-cache
docker compose up -d --force-recreate

echo "=== deploy complete: $KIND '$REF' (commit $SHA) ==="
