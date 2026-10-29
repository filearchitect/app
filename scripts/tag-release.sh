#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "${VERSION}" ]]; then
  echo "Usage: ./scripts/tag-release.sh <version>"
  exit 1
fi

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Release tags must be created from the merged production main branch."
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree must be clean before tagging."
  exit 1
fi
PRODUCTION_REMOTE=""
for remote in production origin; do
  if [[ "$(git remote get-url "$remote" 2>/dev/null || true)" == "https://github.com/filearchitect/app.git" ]]; then
    PRODUCTION_REMOTE="$remote"
    break
  fi
done
if [[ -z "$PRODUCTION_REMOTE" ]]; then
  echo "Configure a remote for https://github.com/filearchitect/app.git before tagging."
  exit 1
fi

TAG_VERSION="${VERSION#v}"
TAG_NAME="v${TAG_VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG_NAME}" >/dev/null; then
  echo "Tag ${TAG_NAME} already exists."
  exit 1
fi
if [[ -n "$(git ls-remote --tags "$PRODUCTION_REMOTE" "refs/tags/${TAG_NAME}")" ]]; then
  echo "Tag ${TAG_NAME} already exists on $PRODUCTION_REMOTE."
  exit 1
fi

node scripts/version-check.mjs "${TAG_VERSION}"

git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"

echo "Created ${TAG_NAME} with synchronized versions."
echo "Next: git push $PRODUCTION_REMOTE ${TAG_NAME} (creates a draft release; publish only after verification)."
