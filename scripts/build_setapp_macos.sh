#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

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
