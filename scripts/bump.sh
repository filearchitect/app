#!/usr/bin/env bash
set -euo pipefail

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

NEW_VERSION="${1:-}"

if [[ -z "${NEW_VERSION}" ]]; then
  read -r -p "Enter the new version number: " NEW_VERSION
fi

node scripts/version-sync.mjs "$NEW_VERSION"
node scripts/version-check.mjs "$NEW_VERSION"

echo "Updated app version to ${NEW_VERSION#v}"
