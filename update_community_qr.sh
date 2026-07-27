#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/community-qr.png" >&2
  exit 1
fi

LOCAL_QR_PATH="$1"
REMOTE_SSH_TARGET="${COMMUNITY_QR_SSH_TARGET:-easybake}"
REMOTE_QR_PATH="${COMMUNITY_QR_REMOTE_PATH:-/var/www/easybake-assets/community-qr.png}"
REMOTE_TEMP_PATH=""
LOCAL_TEMP_DIR=""
UPLOAD_QR_PATH="${LOCAL_QR_PATH}"

if [[ ! -f "${LOCAL_QR_PATH}" ]]; then
  echo "QR code image does not exist: ${LOCAL_QR_PATH}" >&2
  exit 1
fi

MIME_TYPE="$(file --brief --mime-type "${LOCAL_QR_PATH}")"

case "${MIME_TYPE}" in
  image/png)
    ;;
  image/jpeg)
    if ! command -v sips >/dev/null 2>&1; then
      echo "JPEG conversion requires macOS sips. Convert the image to PNG first." >&2
      exit 1
    fi

    LOCAL_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/easybake-community-qr.XXXXXX")"
    UPLOAD_QR_PATH="${LOCAL_TEMP_DIR}/community-qr.png"
    sips -s format png "${LOCAL_QR_PATH}" --out "${UPLOAD_QR_PATH}" >/dev/null
    ;;
  *)
    echo "The community QR code must contain PNG or JPEG image data." >&2
    exit 1
    ;;
esac

cleanup() {
  if [[ -n "${REMOTE_TEMP_PATH}" ]]; then
    ssh "${REMOTE_SSH_TARGET}" bash -s -- "${REMOTE_TEMP_PATH}" <<'REMOTE_SCRIPT' >/dev/null 2>&1 || true
rm -f -- "$1"
REMOTE_SCRIPT
  fi
  [[ -z "${LOCAL_TEMP_DIR}" ]] || rm -rf "${LOCAL_TEMP_DIR}"
}

trap cleanup EXIT

REMOTE_TEMP_PATH="$(ssh "${REMOTE_SSH_TARGET}" 'mktemp /tmp/easybake-community-qr.XXXXXX.png')"
scp "${UPLOAD_QR_PATH}" "${REMOTE_SSH_TARGET}:${REMOTE_TEMP_PATH}"
ssh "${REMOTE_SSH_TARGET}" bash -s -- "${REMOTE_TEMP_PATH}" "${REMOTE_QR_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
sudo install -m 644 -- "$1" "$2"
rm -f -- "$1"
REMOTE_SCRIPT
REMOTE_TEMP_PATH=""

echo "Community QR code updated: ${REMOTE_QR_PATH}"
