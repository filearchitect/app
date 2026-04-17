#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
BUILD_TARGET="universal-apple-darwin"
APP_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/$BUILD_TARGET/release/bundle/macos/File Architect.app"
ARTIFACTS_DIR="$ROOT_DIR/dist/setapp"
ZIP_STAGING_DIR="$ARTIFACTS_DIR/staging"
APP_ICON_PNG="$ROOT_DIR/app-icon.png"

cd "$ROOT_DIR"

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
SETAPP_FRAMEWORK_VERSION="${SETAPP_FRAMEWORK_VERSION:-5.1.0}"
SETAPP_CACHE_ROOT="${SETAPP_CACHE_ROOT:-${HOME}/.cache/filearchitect/setapp-sdk}"
SETAPP_CACHE_DIR="$SETAPP_CACHE_ROOT/$SETAPP_FRAMEWORK_VERSION"
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

download_setapp_framework() {
  local framework_zip="$SETAPP_CACHE_DIR/Setapp.xcframework.zip"
  local resources_zip="$SETAPP_CACHE_DIR/SetappFramework-Resources.bundle.zip"
  local cached_sdk_dir="$SETAPP_CACHE_DIR/Setapp.xcframework/macos-arm64_x86_64"
  local cached_resources_dir="$SETAPP_CACHE_DIR/SetappFramework-Resources.bundle"

  mkdir -p "$SETAPP_CACHE_DIR"

  if [[ ! -f "$cached_sdk_dir/libSetapp.a" ]]; then
    if [[ ! -f "$framework_zip" ]]; then
      echo "Downloading Setapp.xcframework ${SETAPP_FRAMEWORK_VERSION}..."
      curl -Lf \
        "https://github.com/MacPaw/Setapp-framework/releases/download/${SETAPP_FRAMEWORK_VERSION}/Setapp.xcframework.zip" \
        -o "$framework_zip"
    fi

    rm -rf "$SETAPP_CACHE_DIR/Setapp.xcframework"
    ditto -x -k "$framework_zip" "$SETAPP_CACHE_DIR"
  fi

  if [[ ! -d "$cached_resources_dir" ]]; then
    if [[ ! -f "$resources_zip" ]]; then
      echo "Downloading SetappFramework-Resources.bundle ${SETAPP_FRAMEWORK_VERSION}..."
      curl -Lf \
        "https://github.com/MacPaw/Setapp-framework/releases/download/${SETAPP_FRAMEWORK_VERSION}/SetappFramework-Resources.bundle.zip" \
        -o "$resources_zip"
    fi

    rm -rf "$SETAPP_CACHE_DIR/SetappFramework-Resources.bundle"
    ditto -x -k "$resources_zip" "$SETAPP_CACHE_DIR"
  fi

  if [[ -n "$SETAPP_SDK_DIR" && ! -f "$SETAPP_SDK_DIR/libSetapp.a" ]]; then
    echo "Ignoring stale SETAPP_SDK_DIR: $SETAPP_SDK_DIR"
    SETAPP_SDK_DIR=""
  fi

  if [[ -n "$SETAPP_RESOURCES_BUNDLE" && ! -d "$SETAPP_RESOURCES_BUNDLE" ]]; then
    echo "Ignoring stale SETAPP_RESOURCES_BUNDLE: $SETAPP_RESOURCES_BUNDLE"
    SETAPP_RESOURCES_BUNDLE=""
  fi

  if [[ -z "$SETAPP_SDK_DIR" ]]; then
    SETAPP_SDK_DIR="$cached_sdk_dir"
  fi

  if [[ -z "$SETAPP_RESOURCES_BUNDLE" ]]; then
    SETAPP_RESOURCES_BUNDLE="$cached_resources_dir"
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

download_setapp_framework

if [[ -z "$SETAPP_SDK_DIR" ]]; then
  echo "Missing SETAPP_SDK_DIR."
  echo "Point it to the macOS slice directory that contains libSetapp.a and Headers/."
  exit 1
fi

for required_target in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -qx "$required_target"; then
    echo "Missing Rust target: $required_target"
    echo "Install it with: rustup target add aarch64-apple-darwin x86_64-apple-darwin"
    exit 1
  fi
done

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
pnpm tauri build --config src-tauri/tauri.setapp.conf.json --target "$BUILD_TARGET" --bundles app

if [[ ! -d "$APP_BUNDLE_DIR" ]]; then
  echo "Missing Setapp app bundle at $APP_BUNDLE_DIR"
  exit 1
fi

mkdir -p "$ARTIFACTS_DIR"
ZIP_NAME="filearchitect_setapp_${SETAPP_VERSION_TAG}_universal.zip"
ZIP_PATH="$ARTIFACTS_DIR/$ZIP_NAME"
rm -rf "$ZIP_STAGING_DIR"
mkdir -p "$ZIP_STAGING_DIR"

if [[ ! -f "$APP_ICON_PNG" ]]; then
  echo "Missing Setapp upload icon at $APP_ICON_PNG"
  exit 1
fi

ditto "$APP_BUNDLE_DIR" "$ZIP_STAGING_DIR/$(basename "$APP_BUNDLE_DIR")"
cp "$APP_ICON_PNG" "$ZIP_STAGING_DIR/File Architect.png"
rm -f "$ZIP_PATH"
(
  cd "$ZIP_STAGING_DIR"
  /usr/bin/zip -qry "$ZIP_PATH" "File Architect.app" "File Architect.png"
)

echo
echo "Setapp build complete."
echo "App bundle: $APP_BUNDLE_DIR"
echo "ZIP artifact: $ZIP_PATH"
echo "ZIP staging dir: $ZIP_STAGING_DIR"
