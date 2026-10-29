#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
VERSION="$(node -p 'require("./package.json").version')"
node scripts/version-check.mjs "$VERSION"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
  echo "APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID are required for notarization."
  exit 1
fi
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-${TAURI_PRIVATE_KEY:-}}" ]]; then
  echo "A Tauri updater signing private key is required."
  exit 1
fi
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-${TAURI_PRIVATE_KEY_PASSWORD:-}}" ]]; then
  echo "A Tauri updater signing key password is required."
  exit 1
fi

if [[ "${TAURI_USE_APPLE_CERT_IMPORT:-false}" != "true" ]]; then
  unset APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD
fi

export VITE_APP_ENV=production
export VITE_APP_URL=https://filearchitect.com
export VITE_API_URL=https://filearchitect.com/api/v1
export NODE_ENV=production

TARGET="${1:-aarch64-apple-darwin}"
case "$TARGET" in
  aarch64-apple-darwin|x86_64-apple-darwin) ;;
  *) echo "Unsupported macOS target: $TARGET"; exit 1 ;;
esac

pnpm tauri build --config src-tauri/tauri.production.conf.json --target "$TARGET"

BUNDLE="src-tauri/target/$TARGET/release/bundle"
APP="$BUNDLE/macos/File Architect.app"
ARCHIVE="$BUNDLE/macos/File Architect.app.tar.gz"
test -d "$APP"
test -s "$ARCHIVE"
test -s "$ARCHIVE.sig"
codesign --verify --deep --strict --verbose=2 "$APP"
spctl --assess --type execute --verbose=4 "$APP"
xcrun stapler validate "$APP"

echo "Verified signed and notarized macOS $VERSION ($TARGET) build at $BUNDLE"
echo "This script only builds. See docs/direct-release.md before publishing."
