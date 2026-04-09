#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
APP_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle/macos/File Architect.app"
BUNDLE_ROOT_DIR="$ROOT_DIR/src-tauri/target/release/bundle"
ARTIFACTS_DIR="$ROOT_DIR/dist/setapp"

if [[ -z "${DEVELOPER_DIR:-}" && -d "/Applications/Xcode.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

export APP_ENV=production
export NODE_ENV=production
export VITE_APP_ENV=production
export VITE_APP_URL='https://filearchitect.com'
export VITE_API_URL='https://filearchitect.com/api/v1'
export VITE_IS_SETAPP='true'

SETAPP_STAGE_DIR="$ROOT_DIR/src-tauri/.setapp-sdk"
SETAPP_SDK_DIR="${SETAPP_SDK_DIR:-}"
SETAPP_RESOURCES_BUNDLE="${SETAPP_RESOURCES_BUNDLE:-}"

trim() {
  printf '%s' "$1" \
    | tr -d '\r' \
    | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"//; s/"$//'
}

notarize_and_staple() {
  local artifact_path="$1"
  local artifact_label="$2"

  echo "Notarizing ${artifact_label}..."
  xcrun notarytool submit "$artifact_path" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

  echo "Stapling ${artifact_label}..."
  xcrun stapler staple "$artifact_path"
}

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$(trim "${value}")" ]]; then
    echo "Missing required environment variable: ${name}"
    exit 1
  fi
}

APP_VERSION="$(node -p "require('${ROOT_DIR}/src-tauri/tauri.conf.json').version")"
SETAPP_VERSION_TAG="${SETAPP_VERSION_TAG:-$APP_VERSION}"

require_env APPLE_SIGNING_IDENTITY
require_env APPLE_ID
require_env APPLE_PASSWORD
require_env APPLE_TEAM_ID
require_env APPLE_CERTIFICATE_PASSWORD
require_env APPLE_CERTIFICATE

export APPLE_SIGNING_IDENTITY="$(trim "${APPLE_SIGNING_IDENTITY}")"
export APPLE_ID="$(trim "${APPLE_ID}")"
export APPLE_PASSWORD="$(trim "${APPLE_PASSWORD}")"
export APPLE_TEAM_ID="$(trim "${APPLE_TEAM_ID}")"
export APPLE_CERTIFICATE_PASSWORD="$(trim "${APPLE_CERTIFICATE_PASSWORD}")"
export APPLE_CERTIFICATE="$(printf '%s' "${APPLE_CERTIFICATE}" | tr -d '\r\n')"

if ! printf '%s' "$APPLE_CERTIFICATE" | base64 -d >/dev/null 2>&1; then
  echo "APPLE_CERTIFICATE is not valid base64 PKCS#12 content."
  exit 1
fi

if [[ -n "${PROVIDER_SHORT_NAME:-}" ]]; then
  export PROVIDER_SHORT_NAME="$(trim "${PROVIDER_SHORT_NAME}")"
fi

if grep -q "REPLACE_WITH_SETAPP_PUBLIC_KEY" "$ROOT_DIR/src-tauri/resources/setappPublicKey.pem"; then
  echo "Setapp public key placeholder is still present in src-tauri/resources/setappPublicKey.pem"
  echo "Replace it with the public key downloaded from your Setapp release page before building."
  exit 1
fi

if [[ -z "$SETAPP_SDK_DIR" ]]; then
  echo "Missing SETAPP_SDK_DIR."
  echo "Point it to the macOS slice directory that contains libSetapp.a and Headers/."
  exit 1
fi

if [[ ! -f "$SETAPP_SDK_DIR/libSetapp.a" ]]; then
  echo "Missing Setapp SDK static library at $SETAPP_SDK_DIR/libSetapp.a"
  exit 1
fi

if [[ -z "$SETAPP_RESOURCES_BUNDLE" ]]; then
  SETAPP_RESOURCES_BUNDLE="$(cd "$SETAPP_SDK_DIR/.." && pwd)/SetappFramework-Resources.bundle"
fi

if [[ ! -d "$SETAPP_RESOURCES_BUNDLE" ]]; then
  echo "Missing Setapp framework resources bundle at $SETAPP_RESOURCES_BUNDLE"
  exit 1
fi

echo "Staging Setapp SDK artifacts..."
rm -rf "$SETAPP_STAGE_DIR"
mkdir -p "$SETAPP_STAGE_DIR"
cp -R "$SETAPP_SDK_DIR" "$SETAPP_STAGE_DIR/"
cp -R "$SETAPP_RESOURCES_BUNDLE" "$SETAPP_STAGE_DIR/SetappFramework-Resources.bundle"

export SETAPP_SDK_DIR="$SETAPP_STAGE_DIR/$(basename "$SETAPP_SDK_DIR")"

echo "Building Setapp macOS flavor..."
pnpm tauri build --config src-tauri/tauri.setapp.conf.json

if [[ ! -d "$APP_BUNDLE_DIR" ]]; then
  echo "Missing Setapp app bundle at $APP_BUNDLE_DIR"
  exit 1
fi

mkdir -p "$ARTIFACTS_DIR"
ZIP_NAME="filearchitect_setapp_${SETAPP_VERSION_TAG}_universal.zip"
ZIP_PATH="$ARTIFACTS_DIR/$ZIP_NAME"
ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE_DIR" "$ZIP_PATH"

DMG_PATH="$(find "$BUNDLE_ROOT_DIR" -maxdepth 3 -name '*.dmg' | head -n1 || true)"
FINAL_DMG_PATH=""
if [[ -n "${DMG_PATH}" ]]; then
  FINAL_DMG_PATH="$ARTIFACTS_DIR/filearchitect_setapp_${SETAPP_VERSION_TAG}.dmg"
  cp "$DMG_PATH" "$FINAL_DMG_PATH"
  notarize_and_staple "$FINAL_DMG_PATH" "Setapp DMG"
fi

echo
echo "Setapp build complete."
echo "App bundle: $APP_BUNDLE_DIR"
echo "ZIP artifact: $ZIP_PATH"
if [[ -n "${FINAL_DMG_PATH}" ]]; then
  echo "DMG artifact: $FINAL_DMG_PATH"
fi
