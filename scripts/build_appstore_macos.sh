#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
BUILD_TARGET="universal-apple-darwin"
APP_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/$BUILD_TARGET/release/bundle/macos/File Architect.app"
APP_INFO_PLIST="$APP_BUNDLE_DIR/Contents/Info.plist"
APP_EXECUTABLE="$APP_BUNDLE_DIR/Contents/MacOS/filearchitect-app"
ARTIFACTS_DIR="$ROOT_DIR/dist/appstore"
PKG_PATH="$ARTIFACTS_DIR/File Architect.pkg"
GENERATED_CONFIG="$ROOT_DIR/src-tauri/target/tauri.appstore.generated.conf.json"

cd "$ROOT_DIR"

if [[ -z "${DEVELOPER_DIR:-}" && -d "/Applications/Xcode.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

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

require_codesign_identity() {
  local identity="$1"
  if ! security find-identity -v -p codesigning | grep -Fq "$identity"; then
    echo "Missing codesigning identity in keychain: $identity"
    echo "Install the certificate from Apple Developer, then try again."
    exit 1
  fi
}

require_installer_identity() {
  local identity="$1"
  if ! security find-identity -v | grep -Fq "$identity"; then
    echo "Missing installer identity in keychain: $identity"
    echo "Install the Mac Installer Distribution certificate from Apple Developer, then try again."
    exit 1
  fi
}

require_env APPSTORE_APP_SIGNING_IDENTITY
require_env APPSTORE_INSTALLER_SIGNING_IDENTITY

APPSTORE_APP_SIGNING_IDENTITY="$(trim "${APPSTORE_APP_SIGNING_IDENTITY}")"
APPSTORE_INSTALLER_SIGNING_IDENTITY="$(trim "${APPSTORE_INSTALLER_SIGNING_IDENTITY}")"

require_codesign_identity "$APPSTORE_APP_SIGNING_IDENTITY"
require_installer_identity "$APPSTORE_INSTALLER_SIGNING_IDENTITY"

export APP_ENV=production
export NODE_ENV=production
export VITE_APP_ENV=production
export VITE_APP_URL='https://filearchitect.com'
export VITE_API_URL='https://filearchitect.com/api/v1'
export VITE_IS_APPSTORE='true'
export APPLE_SIGNING_IDENTITY="$APPSTORE_APP_SIGNING_IDENTITY"

# App Store Connect processes submitted builds. Avoid Tauri's direct-distribution
# notarization path if .env contains stale Apple notarization credentials.
unset APPLE_ID
unset APPLE_PASSWORD
unset APPLE_TEAM_ID
unset APPLE_API_KEY
unset APPLE_API_ISSUER
unset APPLE_API_KEY_PATH

mkdir -p "$(dirname "$GENERATED_CONFIG")"
node - "$ROOT_DIR/src-tauri/tauri.appstore.conf.json" "$GENERATED_CONFIG" "$APPSTORE_APP_SIGNING_IDENTITY" "$ROOT_DIR/src-tauri/entitlements.appstore.plist" <<'NODE'
const fs = require("fs");

const [sourcePath, outputPath, signingIdentity, entitlementsPath] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
config.bundle ??= {};
config.bundle.macOS ??= {};
config.bundle.macOS.signingIdentity = signingIdentity;
config.bundle.macOS.entitlements = entitlementsPath;
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
NODE

for required_target in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -qx "$required_target"; then
    echo "Missing Rust target: $required_target"
    echo "Install it with: rustup target add aarch64-apple-darwin x86_64-apple-darwin"
    exit 1
  fi
done

echo "Building Mac App Store flavor..."
pnpm tauri build \
  --config "$GENERATED_CONFIG" \
  --target "$BUILD_TARGET" \
  --bundles app

if [[ ! -d "$APP_BUNDLE_DIR" ]]; then
  echo "Missing App Store app bundle at $APP_BUNDLE_DIR"
  exit 1
fi

if [[ -n "${APPSTORE_BUILD_NUMBER:-}" ]]; then
  APPSTORE_BUILD_NUMBER="$(trim "${APPSTORE_BUILD_NUMBER}")"
  if [[ -z "$APPSTORE_BUILD_NUMBER" ]]; then
    echo "APPSTORE_BUILD_NUMBER is set but empty after trimming"
    exit 1
  fi

  echo "Setting App Store build number to $APPSTORE_BUILD_NUMBER..."
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $APPSTORE_BUILD_NUMBER" "$APP_INFO_PLIST"

  echo "Re-signing App Store app after build-number update..."
  codesign \
    --force \
    --sign "$APPSTORE_APP_SIGNING_IDENTITY" \
    --entitlements "$ROOT_DIR/src-tauri/entitlements.appstore.plist" \
    "$APP_EXECUTABLE"
  codesign \
    --force \
    --sign "$APPSTORE_APP_SIGNING_IDENTITY" \
    --entitlements "$ROOT_DIR/src-tauri/entitlements.appstore.plist" \
    "$APP_BUNDLE_DIR"
fi

mkdir -p "$ARTIFACTS_DIR"
rm -f "$PKG_PATH"

echo "Packaging signed installer for App Store Connect..."
productbuild \
  --component "$APP_BUNDLE_DIR" /Applications \
  --sign "$APPSTORE_INSTALLER_SIGNING_IDENTITY" \
  "$PKG_PATH"

echo
echo "Mac App Store build complete."
echo "App bundle: $APP_BUNDLE_DIR"
echo "PKG artifact: $PKG_PATH"
echo
echo "Upload with Transporter, or run:"
echo "xcrun altool --upload-app --type macos --file \"$PKG_PATH\" --username <apple-id> --password <app-specific-password>"
