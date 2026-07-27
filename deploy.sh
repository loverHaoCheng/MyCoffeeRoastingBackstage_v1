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
BFF_DEPLOY_ROOT="${BFF_DEPLOY_ROOT:-$(dirname "${BFF_REMOTE_DIR}")}"
BFF_RELEASES_PATH="${BFF_RELEASES_PATH:-${BFF_DEPLOY_ROOT}/releases}"
BFF_CURRENT_LINK="${BFF_CURRENT_LINK:-${BFF_DEPLOY_ROOT}/current}"
BFF_RELEASES_TO_KEEP="${BFF_RELEASES_TO_KEEP:-5}"
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
DEPLOY_LOCK_OWNER="$(hostname)-$$-$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_LOCK_CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DEPLOY_LOCK_ACQUIRED=false
DEPLOY_LOCK_TTL_SECONDS="${DEPLOY_LOCK_TTL_SECONDS:-3600}"
DEPLOY_FORCE_UNLOCK="${DEPLOY_FORCE_UNLOCK:-false}"

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
    curl --config - "$@" <<EOF
user = "${DEPLOY_HTTP_USER}:${DEPLOY_HTTP_PASSWORD}"
EOF
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

# 值级扫描：从本机 .env* / .deploy*.local 中提取“敏感变量名”的实际值，
# 确认这些值没有被打进任何发布产物（防止 .env 文件中的密钥绕过变量名检查）。
verify_release_dir_has_no_env_secret_values() {
  local scan_dir="$1"
  local env_file
  local line
  local var_name
  local var_value

  for env_file in .env .env.* .deploy*.local; do
    [[ -f "${env_file}" ]] || continue

    while IFS= read -r line; do
      [[ "${line}" =~ ^[[:space:]]*# ]] && continue
      [[ "${line}" == *"="* ]] || continue

      var_name="${line%%=*}"
      var_value="${line#*=}"
      var_value="${var_value%\"}"
      var_value="${var_value#\"}"
      var_value="${var_value%\'}"
      var_value="${var_value#\'}"

      if [[ "${var_name}" =~ (SECRET|PASSWORD|TOKEN|PRIVATE|SUPERUSER|QINIU|KEY) ]] \
        && [[ "${#var_value}" -ge 8 ]] \
        && grep -R -a -F -q -- "${var_value}" "${scan_dir}"; then
        echo "❌ Release dir ${scan_dir} contains the VALUE of sensitive variable: ${var_name} (from ${env_file})" >&2
        exit 1
      fi
    done < "${env_file}"
  done
}

verify_release_dir_has_no_secrets() {
  local scan_dir="$1"
  local secret_artifact
  local sensitive_patterns
  local pattern

  secret_artifact="$(
    find "${scan_dir}" \
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
    echo "❌ Release dir ${scan_dir} contains a secret-like file: ${secret_artifact}" >&2
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

  # 使用 grep -a（而非 -I）以覆盖二进制与预压缩产物。
  for pattern in "${sensitive_patterns[@]}"; do
    if grep -R -a -F -q -- "${pattern}" "${scan_dir}"; then
      echo "❌ Release dir ${scan_dir} contains sensitive marker: ${pattern}" >&2
      exit 1
    fi
  done

  if [[ -n "${DEPLOY_HTTP_PASSWORD}" ]] && grep -R -a -F -q -- "${DEPLOY_HTTP_PASSWORD}" "${scan_dir}"; then
    echo "❌ Release dir ${scan_dir} contains the deploy Basic Auth password." >&2
    exit 1
  fi

  verify_release_dir_has_no_env_secret_values "${scan_dir}"
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

if ! [[ "${DEPLOY_LOCK_TTL_SECONDS}" =~ ^[0-9]+$ ]] || (( DEPLOY_LOCK_TTL_SECONDS < 60 )); then
  echo "DEPLOY_LOCK_TTL_SECONDS must be an integer greater than or equal to 60." >&2
  exit 1
fi

acquire_frontend_deploy_lock() {
  ssh "${FRONTEND_REMOTE_SSH_TARGET}" bash -s -- \
    "${FRONTEND_RELEASES_PATH}" \
    "${FRONTEND_DEPLOY_LOCK_PATH}" \
    "${DEPLOY_LOCK_OWNER}" \
    "${DEPLOY_LOCK_CREATED_AT}" \
    "${DEPLOY_LOCK_TTL_SECONDS}" \
    "${DEPLOY_FORCE_UNLOCK}" <<'REMOTE_SCRIPT'
set -euo pipefail

releases_path="$1"
lock_path="$2"
lock_owner="$3"
lock_created_at="$4"
lock_ttl_seconds="$5"
force_unlock="$6"

mkdir -p "${releases_path}"

if ! mkdir "${lock_path}" 2>/dev/null; then
  owner_file="${lock_path}/owner"
  updated_at="$(sed -n 's/^updated_at=//p' "${owner_file}" 2>/dev/null | head -n 1)"
  updated_epoch="$(date -u -d "${updated_at}" +%s 2>/dev/null || echo 0)"
  now_epoch="$(date -u +%s)"
  age_seconds=$((now_epoch - updated_epoch))

  if (( updated_epoch > 0 && age_seconds > lock_ttl_seconds )) && [[ "${force_unlock}" == "true" ]]; then
    rm -rf "${lock_path}"
    mkdir "${lock_path}"
    echo "Released stale deployment lock after ${age_seconds}s." >&2
  else
    echo "Another deployment is already running or the lock is stale." >&2
    [[ -f "${owner_file}" ]] && cat "${owner_file}" >&2
    echo "Set DEPLOY_FORCE_UNLOCK=true only after confirming the owner is no longer running." >&2
    exit 1
  fi
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
  local release_id="bff-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  local staged_dir="${BFF_RELEASES_PATH}/${release_id}.next"
  local release_dir="${BFF_RELEASES_PATH}/${release_id}"

  ssh "${REMOTE_SSH_TARGET}" "rm -rf '${staged_dir}' && mkdir -p '${BFF_RELEASES_PATH}' '${staged_dir}'"
  rsync -az --delete --checksum dist/server/ "${REMOTE_SSH_TARGET}:${staged_dir}/"
  ssh "${REMOTE_SSH_TARGET}" "chmod -R u=rwX,go=rX '${staged_dir}'"

  ssh "${REMOTE_SSH_TARGET}" bash -s -- \
    "${BFF_CURRENT_LINK}" \
    "${release_dir}" \
    "${staged_dir}" \
    "${BFF_SERVICE_NAME}" \
    "${BFF_LOCAL_PORT}" \
    "${EASYBAKE_APP_ENV}" <<'REMOTE_SCRIPT'
set -euo pipefail

current_link="$1"
release_dir="$2"
staged_dir="$3"
service_name="$4"
local_port="$5"
app_env="$6"
previous_link="${current_link}.previous"
next_link="${current_link}.next"

rollback() {
  rm -rf "${staged_dir}" "${next_link}"

  if [[ -L "${previous_link}" ]]; then
    ln -sfn "$(readlink -f "${previous_link}")" "${next_link}"
    mv -Tf "${next_link}" "${current_link}"
    sudo systemctl restart "${service_name}"
  fi
}

if [[ ! -f "${staged_dir}/pocketbase-auth-bff.js" ]]; then
  echo "Staged BFF entry file is missing: ${staged_dir}/pocketbase-auth-bff.js" >&2
  exit 1
fi

mv -f "${staged_dir}" "${release_dir}"

if [[ ! -f "${release_dir}/pocketbase-auth-bff.js" ]]; then
  echo "Deployed BFF entry file is missing: ${release_dir}/pocketbase-auth-bff.js" >&2
  rollback
  exit 1
fi

if [[ -L "${current_link}" ]]; then
  ln -sfn "$(readlink -f "${current_link}")" "${previous_link}"
fi

ln -sfn "${release_dir}" "${next_link}"
mv -Tf "${next_link}" "${current_link}"

sudo mkdir -p "/etc/systemd/system/${service_name}.service.d"
printf '[Service]\nEnvironment=EASYBAKE_APP_ENV=%s\n' "${app_env}" \
  | sudo tee "/etc/systemd/system/${service_name}.service.d/20-easybake-app-env.conf" >/dev/null
printf '[Service]\nExecStart=\nExecStart=/usr/bin/node %s/pocketbase-auth-bff.js\n' "${current_link}" \
  | sudo tee "/etc/systemd/system/${service_name}.service.d/80-atomic-release.conf" >/dev/null
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

REMOTE_SCRIPT

  ssh "${REMOTE_SSH_TARGET}" bash -s -- \
    "${BFF_RELEASES_PATH}" \
    "${BFF_CURRENT_LINK}" \
    "${BFF_RELEASES_TO_KEEP}" <<'REMOTE_SCRIPT'
set -euo pipefail

releases_path="$1"
current_link="$2"
releases_to_keep="$3"
previous_link="${current_link}.previous"
current_target="$(readlink -f "${current_link}" || true)"
previous_target="$(readlink -f "${previous_link}" || true)"
kept=0

while IFS= read -r release_path; do
  resolved_path="$(readlink -f "${release_path}")"
  if [[ "${resolved_path}" == "${current_target}" || "${resolved_path}" == "${previous_target}" ]]; then
    continue
  fi
  if (( kept < releases_to_keep - 2 )); then
    kept=$((kept + 1))
    continue
  fi
  rm -rf -- "${release_path}"
done < <(find "${releases_path}" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
REMOTE_SCRIPT
}

publish_frontend_release() {
  local release_id="$1"
  local staged_path="${FRONTEND_RELEASES_PATH}/${release_id}.next"
  local release_path="${FRONTEND_RELEASES_PATH}/${release_id}"

  ssh "${FRONTEND_REMOTE_SSH_TARGET}" "mkdir -p '${FRONTEND_RELEASES_PATH}' && chmod 755 '${FRONTEND_RELEASES_PATH}'"
  rsync -az --delete "${FRONTEND_RELEASE_DIR}/" "${FRONTEND_REMOTE_SSH_TARGET}:${staged_path}/"
  ssh "${FRONTEND_REMOTE_SSH_TARGET}" "chmod -R u=rwX,go=rX '${staged_path}'"

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

echo "🔨 Building BFF..."
npm run auth:bff:build

echo "📦 Staging frontend release..."
cp -R dist/. "${FRONTEND_RELEASE_DIR}/"
# 归一化产物权限：本地 600 权限文件（如协作工具写入）原样上线会导致 Nginx 403。
chmod -R u=rwX,go=rX "${FRONTEND_RELEASE_DIR}"

echo "🔍 Scanning release artifacts for secrets..."
verify_release_dir_has_no_secrets "${FRONTEND_RELEASE_DIR}"
verify_release_dir_has_no_secrets "dist/server"

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
