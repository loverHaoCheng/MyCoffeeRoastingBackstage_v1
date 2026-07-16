#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${SCRIPT_DIR}/.deploy_test.local"

if [[ -f "${LOCAL_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${LOCAL_ENV_FILE}"
  set +a
fi

export APP_URL="${APP_URL:-https://test.easybake.top}"
export EASYBAKE_APP_ENV="${EASYBAKE_APP_ENV:-staging}"
export VITE_EASYBAKE_APP_ENV="${VITE_EASYBAKE_APP_ENV:-staging}"
export REMOTE_TARGET="${REMOTE_TARGET:-easybake:/var/www/easybake-staging/}"
export BFF_REMOTE_TARGET="${BFF_REMOTE_TARGET:-easybake:/opt/easybake-auth-bff-staging/dist/server/pocketbase-auth-bff.js}"
export BFF_SERVICE_NAME="${BFF_SERVICE_NAME:-easybake-auth-bff-staging}"
export BFF_LOCAL_PORT="${BFF_LOCAL_PORT:-3002}"
export FRONTEND_RELEASES_PATH="${FRONTEND_RELEASES_PATH:-/var/www/easybake-staging-releases}"
export FRONTEND_CURRENT_LINK="${FRONTEND_CURRENT_LINK:-/var/www/easybake-staging}"
export FRONTEND_DEPLOY_LOCK_PATH="${FRONTEND_DEPLOY_LOCK_PATH:-${FRONTEND_RELEASES_PATH}/.easybake-staging-deploy.lock}"
export DEPLOY_ENVIRONMENT_NAME="${DEPLOY_ENVIRONMENT_NAME:-Staging}"
export DEPLOY_HTTP_USER="${DEPLOY_HTTP_USER:-}"
if [[ -z "${DEPLOY_HTTP_USER}" ]]; then
  export DEPLOY_HTTP_PASSWORD=""
fi

exec "${SCRIPT_DIR}/deploy.sh"
