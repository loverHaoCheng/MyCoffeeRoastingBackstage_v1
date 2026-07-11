#!/usr/bin/env bash

set -euo pipefail

APP_URL="${APP_URL:-https://www.easybake.top}"
REMOTE_TARGET="${REMOTE_TARGET:-easybake:/var/www/easybake/}"
VERSION_URL="${APP_URL%/}/version.json"
HEALTH_URL="${APP_URL%/}/api/health"

echo "🔨 Building..."
npm run build

echo "🚀 Deploying..."
rsync -az --delete dist/ "${REMOTE_TARGET}"

echo "🔎 Verifying HTTPS release..."
local_version="$(tr -d '[:space:]' < dist/version.json)"
remote_version="$(curl --max-time 15 -fsS "${VERSION_URL}" | tr -d '[:space:]')"

if [[ "${local_version}" != "${remote_version}" ]]; then
  echo "❌ Remote version does not match the local build."
  echo "Local:  ${local_version}"
  echo "Remote: ${remote_version}"
  exit 1
fi

curl --max-time 15 -fsS "${HEALTH_URL}" >/dev/null

echo "✅ Deploy completed. Production is live at ${APP_URL} over HTTPS 443."
