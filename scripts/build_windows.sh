#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
VERSION="$(node -p 'require("./package.json").version')"
node scripts/version-check.mjs "$VERSION"

if [[ "$(uname -s)" != "MINGW"* && "$(uname -s)" != "MSYS"* ]]; then
  echo "Build the Windows executable on Windows. The release workflow uses windows-latest."
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
export VITE_APP_ENV=production
export VITE_APP_URL=https://filearchitect.com
export VITE_API_URL=https://filearchitect.com/api/v1
export NODE_ENV=production

pnpm tauri build --config src-tauri/tauri.production.conf.json --target x86_64-pc-windows-msvc --no-bundle
EXE="src-tauri/target/x86_64-pc-windows-msvc/release/filearchitect-app.exe"
test -s "$EXE"
echo "Built Windows $VERSION executable at $EXE"
echo "This script only builds. See docs/direct-release.md before publishing."
