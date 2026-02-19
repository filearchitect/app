#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "${VERSION}" ]]; then
  echo "Usage: ./scripts/tag-release.sh <version>"
  exit 1
fi

TAG_VERSION="${VERSION#v}"
TAG_NAME="v${TAG_VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG_NAME}" >/dev/null; then
  echo "Tag ${TAG_NAME} already exists."
  exit 1
fi

node scripts/version-sync.mjs "${TAG_VERSION}"
node scripts/version-check.mjs "${TAG_VERSION}"

git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json

if ! git diff --cached --quiet; then
  git commit -m "chore(release): ${TAG_NAME}"
fi

git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"

echo "Created ${TAG_NAME} with synchronized versions."
echo "Next: git push origin main && git push origin ${TAG_NAME}"
