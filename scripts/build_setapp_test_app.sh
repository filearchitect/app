#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
BUILD_TARGET="universal-apple-darwin"
APP_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/$BUILD_TARGET/release/bundle/macos/File Architect Setapp Test.app"
INSTALL_DIR="/Applications/File Architect Setapp Test.app"

cd "$ROOT_DIR"

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
export VITE_SETAPP_LOCAL_TEST='true'
export SETAPP_LOCAL_TEST='true'

for required_target in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -qx "$required_target"; then
    echo "Missing Rust target: $required_target"
    echo "Install it with: rustup target add aarch64-apple-darwin x86_64-apple-darwin"
    exit 1
  fi
done

pnpm tauri build --config src-tauri/tauri.setapp-local.conf.json --target "$BUILD_TARGET"

if [[ ! -d "$APP_BUNDLE_DIR" ]]; then
  echo "Missing local Setapp test app bundle at $APP_BUNDLE_DIR"
  exit 1
fi

rm -rf "$INSTALL_DIR"
ditto "$APP_BUNDLE_DIR" "$INSTALL_DIR"

echo "Installed local Setapp test app at $INSTALL_DIR"
