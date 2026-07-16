#!/usr/bin/env bash

set -euo pipefail

APP_URL="${APP_URL:-https://www.easybake.top}"
EASYBAKE_APP_ENV="${EASYBAKE_APP_ENV:-production}"
REMOTE_TARGET="${REMOTE_TARGET:-easybake:/var/www/easybake/}"
BFF_REMOTE_TARGET="${BFF_REMOTE_TARGET:-easybake:/opt/easybake-auth-bff/dist/server/pocketbase-auth-bff.js}"
BFF_SERVICE_NAME="${BFF_SERVICE_NAME:-easybake-auth-bff}"
BFF_LOCAL_PORT="${BFF_LOCAL_PORT:-3001}"
DEPLOY_ENVIRONMENT_NAME="${DEPLOY_ENVIRONMENT_NAME:-Production}"
DEPLOY_HTTP_USER="${DEPLOY_HTTP_USER:-}"
DEPLOY_HTTP_PASSWORD="${DEPLOY_HTTP_PASSWORD:-}"
REMOTE_SSH_TARGET="${REMOTE_SSH_TARGET:-${BFF_REMOTE_TARGET%%:*}}"
BFF_REMOTE_PATH="${BFF_REMOTE_PATH:-${BFF_REMOTE_TARGET#*:}}"
BFF_REMOTE_DIR="${BFF_REMOTE_DIR:-$(dirname "${BFF_REMOTE_PATH}")}"
FRONTEND_REMOTE_SSH_TARGET="${FRONTEND_REMOTE_SSH_TARGET:-${REMOTE_TARGET%%:*}}"
FRONTEND_REMOTE_PATH="${FRONTEND_REMOTE_PATH:-${REMOTE_TARGET#*:}}"
FRONTEND_RELEASES_PATH="${FRONTEND_RELEASES_PATH:-/var/www/easybake-releases}"
FRONTEND_CURRENT_LINK="${FRONTEND_CURRENT_LINK:-${FRONTEND_REMOTE_PATH%/}}"
FRONTEND_RELEASES_TO_KEEP="${FRONTEND_RELEASES_TO_KEEP:-5}"
FRONTEND_DEPLOY_LOCK_PATH="${FRONTEND_DEPLOY_LOCK_PATH:-${FRONTEND_RELEASES_PATH}/.easybake-deploy.lock}"
VERSION_URL="${APP_URL%/}/version.json"
HEALTH_URL="${APP_URL%/}/api/health"
AUTH_LOGIN_URL="${APP_URL%/}/api/auth/login"
FRONTEND_RELEASE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/easybake-frontend.XXXXXX")"
BFF_STAGED_DIR="${BFF_REMOTE_DIR}.next"
BFF_BACKUP_DIR="${BFF_REMOTE_DIR}.previous"
DEPLOY_LOCK_OWNER="$(hostname)-$$-$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_LOCK_CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DEPLOY_LOCK_ACQUIRED=false

export VITE_EASYBAKE_APP_ENV="${VITE_EASYBAKE_APP_ENV:-${EASYBAKE_APP_ENV}}"

if [[ -n "${DEPLOY_HTTP_USER}" && -z "${DEPLOY_HTTP_PASSWORD}" ]]; then
  read -r -s -p "Basic Auth password for ${DEPLOY_HTTP_USER}: " DEPLOY_HTTP_PASSWORD
  echo
fi

if [[ -z "${DEPLOY_HTTP_USER}" && -n "${DEPLOY_HTTP_PASSWORD}" ]]; then
  echo "DEPLOY_HTTP_USER is required when DEPLOY_HTTP_PASSWORD is provided." >&2
  exit 1
fi

if [[ -n "${DEPLOY_HTTP_USER}" ]]; then
  if [[ -z "${DEPLOY_HTTP_PASSWORD}" ]]; then
    echo "Basic Auth password cannot be empty." >&2
    exit 1
  fi
fi

public_curl() {
  if [[ -n "${DEPLOY_HTTP_USER}" ]]; then
    curl --user "${DEPLOY_HTTP_USER}:${DEPLOY_HTTP_PASSWORD}" "$@"
    return
  fi

  curl "$@"
}

validate_public_vite_env() {
  local leaked_public_env

  leaked_public_env="$(
    env | sed -n 's/^\(VITE_[^=]*\(SECRET\|PASSWORD\|TOKEN\|PRIVATE\|SUPERUSER\|QINIU\|AUTH\|KEY\)[^=]*\)=.*/\1/p' | sort
  )"

  if [[ -n "${leaked_public_env}" ]]; then
    echo "❌ Refusing to build with secret-like VITE_* variables." >&2
    echo "Vite exposes VITE_* variables to the browser. Move these values to server environment variables:" >&2
    echo "${leaked_public_env}" >&2
    exit 1
  fi
}

verify_frontend_release_has_no_secrets() {
  local secret_artifact
  local sensitive_patterns
  local pattern

  secret_artifact="$(
    find "${FRONTEND_RELEASE_DIR}" \
      \( -name '.env' \
      -o -name '.env.*' \
      -o -name '.deploy*.local' \
      -o -name '*.pem' \
      -o -name '*.key' \
      -o -name '*.crt' \
      -o -name '*.p12' \
      -o -name '*.secret' \
      -o -name '*.secrets' \
      -o -name '*.token' \
      -o -name '*.credentials' \) \
      -print \
      -quit
  )"

  if [[ -n "${secret_artifact}" ]]; then
    echo "❌ Frontend release contains a secret-like file: ${secret_artifact}" >&2
    exit 1
  fi

  sensitive_patterns=(
    "DEPLOY_HTTP_PASSWORD"
    "PB_SUPERUSER_EMAIL"
    "PB_SUPERUSER_PASSWORD"
    "QINIU_QWEN_API_KEY"
    "BEGIN PRIVATE KEY"
    "BEGIN RSA PRIVATE KEY"
    ".deploy_test.local"
  )

  for pattern in "${sensitive_patterns[@]}"; do
    if grep -R -I -F -q -- "${pattern}" "${FRONTEND_RELEASE_DIR}"; then
      echo "❌ Frontend release contains sensitive marker: ${pattern}" >&2
      exit 1
    fi
  done

  if [[ -n "${DEPLOY_HTTP_PASSWORD}" ]] && grep -R -I -F -q -- "${DEPLOY_HTTP_PASSWORD}" "${FRONTEND_RELEASE_DIR}"; then
    echo "❌ Frontend release contains the deploy Basic Auth password." >&2
    exit 1
  fi
}

cleanup() {
  local exit_status=$?

  if [[ "${DEPLOY_LOCK_ACQUIRED}" == true ]] && ! release_frontend_deploy_lock; then
    echo "⚠️ Failed to release the remote deployment lock: ${FRONTEND_DEPLOY_LOCK_PATH}" >&2
  fi

  rm -rf "${FRONTEND_RELEASE_DIR}"
  return "${exit_status}"
}

trap cleanup EXIT

if ! [[ "${FRONTEND_RELEASES_TO_KEEP}" =~ ^[0-9]+$ ]] || (( FRONTEND_RELEASES_TO_KEEP < 2 )); then
  echo "FRONTEND_RELEASES_TO_KEEP must be an integer greater than or equal to 2." >&2
  exit 1
fi

acquire_frontend_deploy_lock() {
  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- \
    "${FRONTEND_RELEASES_PATH}" \
    "${FRONTEND_DEPLOY_LOCK_PATH}" \
    "${DEPLOY_LOCK_OWNER}" \
    "${DEPLOY_LOCK_CREATED_AT}" <<'REMOTE_SCRIPT'
set -euo pipefail

releases_path="$1"
lock_path="$2"
lock_owner="$3"
lock_created_at="$4"

mkdir -p "${releases_path}"

if ! mkdir "${lock_path}" 2>/dev/null; then
  echo "Another deployment is already running. Retry after it finishes." >&2

  if [[ -f "${lock_path}/owner" ]]; then
    echo "Current lock metadata:" >&2
    cat "${lock_path}/owner" >&2
  fi

  exit 1
fi

printf 'owner=%s\ncreated_at=%s\nupdated_at=%s\nstage=%s\n' \
  "${lock_owner}" \
  "${lock_created_at}" \
  "${lock_created_at}" \
  "bff-deployment" > "${lock_path}/owner"
REMOTE_SCRIPT

  DEPLOY_LOCK_ACQUIRED=true
}

refresh_frontend_deploy_lock() {
  local stage="$1"

  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- \
    "${FRONTEND_DEPLOY_LOCK_PATH}" \
    "${DEPLOY_LOCK_OWNER}" \
    "${DEPLOY_LOCK_CREATED_AT}" \
    "${stage}" <<'REMOTE_SCRIPT'
set -euo pipefail

lock_path="$1"
lock_owner="$2"
lock_created_at="$3"
stage="$4"
owner_file="${lock_path}/owner"
recorded_owner="$(sed -n 's/^owner=//p' "${owner_file}" | head -n 1)"

if [[ "${recorded_owner}" != "${lock_owner}" ]]; then
  echo "The remote deployment lock does not belong to this process." >&2
  exit 1
fi

updated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'owner=%s\ncreated_at=%s\nupdated_at=%s\nstage=%s\n' \
  "${lock_owner}" \
  "${lock_created_at}" \
  "${updated_at}" \
  "${stage}" > "${owner_file}.next"
mv -f "${owner_file}.next" "${owner_file}"
REMOTE_SCRIPT
}

release_frontend_deploy_lock() {
  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- \
    "${FRONTEND_DEPLOY_LOCK_PATH}" \
    "${DEPLOY_LOCK_OWNER}" <<'REMOTE_SCRIPT'
set -euo pipefail

lock_path="$1"
lock_owner="$2"

if [[ ! -d "${lock_path}" ]]; then
  exit 0
fi

if [[ ! -f "${lock_path}/owner" ]]; then
  echo "The remote deployment lock has no metadata and was not released." >&2
  exit 1
fi

recorded_owner="$(sed -n 's/^owner=//p' "${lock_path}/owner" | head -n 1)"

if [[ "${recorded_owner}" != "${lock_owner}" ]]; then
  echo "The remote deployment lock belongs to another process and was not released." >&2
  exit 1
fi

rm -f "${lock_path}/owner"
rmdir "${lock_path}"
REMOTE_SCRIPT

  DEPLOY_LOCK_ACQUIRED=false
}

deploy_bff_with_rollback() {
  ssh "${REMOTE_SSH_TARGET}" "rm -rf '${BFF_STAGED_DIR}' && mkdir -p '${BFF_STAGED_DIR}'"
  rsync -az --delete --checksum dist/server/ "${REMOTE_SSH_TARGET}:${BFF_STAGED_DIR}/"

  ssh "${REMOTE_SSH_TARGET}" bash -s -- \
    "${BFF_REMOTE_DIR}" \
    "${BFF_REMOTE_PATH}" \
    "${BFF_STAGED_DIR}" \
    "${BFF_BACKUP_DIR}" \
    "${BFF_SERVICE_NAME}" \
    "${BFF_LOCAL_PORT}" \
    "${EASYBAKE_APP_ENV}" <<'REMOTE_SCRIPT'
set -euo pipefail

bff_dir="$1"
bff_entry_path="$2"
staged_dir="$3"
backup_dir="$4"
service_name="$5"
local_port="$6"
app_env="$7"

rollback() {
  rm -rf "${staged_dir}"

  if [[ -d "${backup_dir}" ]]; then
    rm -rf "${bff_dir}"
    mv -f "${backup_dir}" "${bff_dir}"
    sudo systemctl restart "${service_name}" || true
  fi
}

if [[ ! -f "${staged_dir}/pocketbase-auth-bff.js" ]]; then
  echo "Staged BFF entry file is missing: ${staged_dir}/pocketbase-auth-bff.js" >&2
  exit 1
fi

rm -rf "${backup_dir}"

if [[ -d "${bff_dir}" ]]; then
  cp -a "${bff_dir}" "${backup_dir}"
fi

rm -rf "${bff_dir}"
mv -f "${staged_dir}" "${bff_dir}"

if [[ ! -f "${bff_entry_path}" ]]; then
  echo "Deployed BFF entry file is missing: ${bff_entry_path}" >&2
  rollback
  exit 1
fi

sudo mkdir -p "/etc/systemd/system/${service_name}.service.d"
printf '[Service]\nEnvironment=EASYBAKE_APP_ENV=%s\n' "${app_env}" \
  | sudo tee "/etc/systemd/system/${service_name}.service.d/20-easybake-app-env.conf" >/dev/null
sudo systemctl daemon-reload

if ! sudo systemctl restart "${service_name}"; then
  rollback
  exit 1
fi

sleep 2
bff_auth_status="$(curl --max-time 8 -sS -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${local_port}/api/auth/login" || true)"

if [[ "${bff_auth_status}" != "400" ]]; then
  echo "BFF authentication probe failed. Expected HTTP 400, got: ${bff_auth_status}" >&2
  rollback
  exit 1
fi

rm -rf "${backup_dir}"
REMOTE_SCRIPT
}

publish_frontend_release() {
  local release_id="$1"
  local staged_path="${FRONTEND_RELEASES_PATH}/${release_id}.next"
  local release_path="${FRONTEND_RELEASES_PATH}/${release_id}"

  ssh "${FRONTEND_REMOTE_SSH_TARGET}" "mkdir -p '${FRONTEND_RELEASES_PATH}' && chmod 755 '${FRONTEND_RELEASES_PATH}'"
  rsync -az --delete "${FRONTEND_RELEASE_DIR}/" "${FRONTEND_REMOTE_SSH_TARGET}:${staged_path}/"

  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- \
    "${FRONTEND_CURRENT_LINK}" \
    "${release_path}" \
    "${staged_path}" <<'REMOTE_SCRIPT'
set -euo pipefail

current_link="$1"
release_path="$2"
staged_path="$3"
previous_link="${current_link}.previous"
next_link="${current_link}.next"

if [[ ! -f "${staged_path}/index.html" || ! -f "${staged_path}/version.json" ]]; then
  echo "Staged frontend release is incomplete: ${staged_path}" >&2
  exit 1
fi

chmod 755 "${staged_path}"
sudo mv "${staged_path}" "${release_path}"

if [[ -L "${current_link}" ]]; then
  sudo ln -sfn "$(readlink -f "${current_link}")" "${previous_link}"
fi

sudo ln -sfn "${release_path}" "${next_link}"
sudo mv -Tf "${next_link}" "${current_link}"
REMOTE_SCRIPT
}

rollback_frontend_release() {
  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- "${FRONTEND_CURRENT_LINK}" <<'REMOTE_SCRIPT'
set -euo pipefail

current_link="$1"
previous_link="${current_link}.previous"
next_link="${current_link}.next"

if [[ ! -L "${previous_link}" ]]; then
  echo "No previous frontend release is available for rollback." >&2
  exit 1
fi

sudo ln -sfn "$(readlink -f "${previous_link}")" "${next_link}"
sudo mv -Tf "${next_link}" "${current_link}"
REMOTE_SCRIPT
}

cleanup_frontend_releases() {
  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- \
    "${FRONTEND_RELEASES_PATH}" \
    "${FRONTEND_CURRENT_LINK}" \
    "${FRONTEND_RELEASES_TO_KEEP}" <<'REMOTE_SCRIPT'
set -euo pipefail

releases_path="$1"
current_link="$2"
releases_to_keep="$3"
previous_link="${current_link}.previous"
current_target="$(readlink -f "${current_link}" || true)"
previous_target="$(readlink -f "${previous_link}" || true)"
protected_count=0

if [[ -n "${current_target}" ]]; then
  protected_count=$((protected_count + 1))
fi

if [[ -n "${previous_target}" && "${previous_target}" != "${current_target}" ]]; then
  protected_count=$((protected_count + 1))
fi

remaining_slots=$((releases_to_keep - protected_count))

if (( remaining_slots < 0 )); then
  remaining_slots=0
fi

kept_nonprotected=0

while IFS= read -r release_path; do
  resolved_path="$(readlink -f "${release_path}")"

  if [[ "${resolved_path}" == "${current_target}" || "${resolved_path}" == "${previous_target}" ]]; then
    continue
  fi

  if (( kept_nonprotected < remaining_slots )); then
    kept_nonprotected=$((kept_nonprotected + 1))
    continue
  fi

  rm -rf -- "${release_path}"
  echo "Removed expired frontend release: ${release_path}"
done < <(find "${releases_path}" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
REMOTE_SCRIPT
}

verify_public_release() {
  local expected_version="$1"
  local remote_version
  local health_status
  local public_auth_status

  remote_version="$(public_curl --max-time 15 -fsS "${VERSION_URL}" 2>/dev/null | tr -d '[:space:]' || true)"

  if [[ "${expected_version}" != "${remote_version}" ]]; then
    echo "❌ Remote version does not match the local build."
    echo "Local:  ${expected_version}"
    echo "Remote: ${remote_version}"
    return 1
  fi

  health_status="$(public_curl --max-time 15 -sS -o /dev/null -w '%{http_code}' "${HEALTH_URL}" || true)"

  if [[ "${health_status}" != "200" ]]; then
    echo "❌ Health probe failed. Expected HTTP 200, got: ${health_status}"
    return 1
  fi

  public_auth_status="$(public_curl --max-time 15 -sS -o /dev/null -w '%{http_code}' -X POST "${AUTH_LOGIN_URL}" || true)"

  if [[ "${public_auth_status}" != "400" ]]; then
    echo "❌ Public BFF authentication probe failed. Expected HTTP 400, got: ${public_auth_status}"
    return 1
  fi
}

echo "🔨 Building frontend..."
validate_public_vite_env
npm run build

echo "📦 Staging frontend release..."
cp -R dist/. "${FRONTEND_RELEASE_DIR}/"
verify_frontend_release_has_no_secrets

echo "🔨 Building BFF..."
npm run auth:bff:build

echo "🔒 Acquiring deployment lock..."
acquire_frontend_deploy_lock

echo "🚀 Deploying and verifying BFF..."
deploy_bff_with_rollback

frontend_version="$(tr -d '[:space:]' < "${FRONTEND_RELEASE_DIR}/version.json")"
frontend_release_label="$(node -e "const manifest = JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')); process.stdout.write(manifest.version);" "${FRONTEND_RELEASE_DIR}/version.json")"
frontend_release_id="release-${frontend_release_label//[^A-Za-z0-9._-]/-}"

refresh_frontend_deploy_lock "frontend-publication"

echo "🚀 Publishing frontend release ${frontend_release_id}..."
publish_frontend_release "${frontend_release_id}"

echo "🔎 Verifying HTTPS release..."
if ! verify_public_release "${frontend_version}"; then
  echo "♻️ Rolling back frontend release..."
  rollback_frontend_release
  exit 1
fi

refresh_frontend_deploy_lock "frontend-cleanup"

echo "🧹 Cleaning expired frontend releases..."
if ! cleanup_frontend_releases; then
  echo "⚠️ Frontend release cleanup failed. Current and previous releases remain available." >&2
fi

if ! release_frontend_deploy_lock; then
  echo "❌ Deployment finished, but the remote lock could not be released." >&2
  exit 1
fi

echo "✅ Deploy completed. ${DEPLOY_ENVIRONMENT_NAME} is live at ${APP_URL} over HTTPS 443."
