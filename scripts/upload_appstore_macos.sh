#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
DEFAULT_PKG_PATH="$ROOT_DIR/dist/appstore/File Architect.pkg"

cd "$ROOT_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

trim() {
  printf '%s' "$1" \
    | tr -d '\r' \
    | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"//; s/"$//'
}

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$(trim "${value}")" ]]; then
    echo "Missing required environment variable: ${name}"
    exit 1
  fi
}

MODE="${1:-validate}"
PKG_PATH="${APPSTORE_PKG_PATH:-$DEFAULT_PKG_PATH}"

case "$MODE" in
  validate)
    ALTOOL_ACTION="--validate-app"
    ;;
  upload)
    ALTOOL_ACTION="--upload-app"
    ;;
  *)
    echo "Usage: $0 [validate|upload]"
    exit 1
    ;;
esac

require_env APPLE_ID
require_env APPLE_PASSWORD

APPLE_ID="$(trim "${APPLE_ID}")"
APPLE_PASSWORD="$(trim "${APPLE_PASSWORD}")"

if [[ ! -f "$PKG_PATH" ]]; then
  echo "Missing App Store package: $PKG_PATH"
  echo "Build it first with: pnpm tauri:build:appstore"
  exit 1
fi

ASC_PROVIDER_ARGS=()
if [[ -n "${APPSTORE_ASC_PROVIDER:-${PROVIDER_SHORT_NAME:-}}" ]]; then
  ASC_PROVIDER_ARGS=(--asc-provider "$(trim "${APPSTORE_ASC_PROVIDER:-${PROVIDER_SHORT_NAME:-}}")")
fi

echo "Running App Store Connect ${MODE} for:"
echo "$PKG_PATH"

ALTOOL_CMD=(
  xcrun altool "$ALTOOL_ACTION"
  --type macos
  --file "$PKG_PATH"
  --username "$APPLE_ID"
  --password "$APPLE_PASSWORD"
)

if [[ ${#ASC_PROVIDER_ARGS[@]} -gt 0 ]]; then
  ALTOOL_CMD+=("${ASC_PROVIDER_ARGS[@]}")
fi

"${ALTOOL_CMD[@]}"
