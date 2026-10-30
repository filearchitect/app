#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: release-promote.sh <version> <promote|rollback>}"
VERSION="${VERSION#v}"
ACTION="${2:?Specify promote or rollback}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release version" >&2; exit 1; }
[[ "$ACTION" == promote || "$ACTION" == rollback ]] || { echo "Invalid action" >&2; exit 1; }
test -n "${RELEASE_API_TOKEN:-}" || { echo "Missing RELEASE_API_TOKEN" >&2; exit 1; }
TAG="v$VERSION"
REPO="filearchitect/app"
API_BASE="${RELEASE_API_BASE:-https://filearchitect.com/api/internal/releases}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

website_action() {
  local action="$1"
  jq -n --arg version "$VERSION" '{version:$version}' > "$WORK/request.json"
  curl --fail-with-body --silent --show-error --retry 3 \
    -H "Authorization: Bearer $RELEASE_API_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary "@$WORK/request.json" "$API_BASE/$action" > "$WORK/response.json"
  jq -e --arg version "$VERSION" --arg state "$( [[ "$action" == promote ]] && echo active || echo rolled_back )" \
    '.version == $version and .state == $state' "$WORK/response.json" >/dev/null
}

if [[ "$ACTION" == rollback ]]; then
  website_action rollback
  gh release edit "$TAG" --repo "$REPO" --draft
  echo "Website release rolled back and GitHub release returned to draft. Already updated clients are not downgraded."
  exit 0
fi

node scripts/version-check.mjs "$VERSION"
test "$(gh release view "$TAG" --repo "$REPO" --json isDraft --jq '.isDraft')" = true
COMMIT="$(git rev-parse HEAD)"
gh run list --repo "$REPO" --workflow release-tag.yml --limit 100 \
  --json headSha,conclusion,event \
  --jq '.[] | select(.headSha == "'"$COMMIT"'" and .event == "push" and .conclusion == "success") | .conclusion' \
  | grep -qx success

RELEASE_STAGE_DRY_RUN=1 bash scripts/release-stage.sh "$VERSION"

PUBLISHED=0
PROMOTION_ATTEMPTED=0
recover_on_error() {
  local result=$?
  if [[ "$result" != 0 && "$PUBLISHED" == 1 ]]; then
    echo "Promotion failed; attempting rollback" >&2
    if [[ "$PROMOTION_ATTEMPTED" == 1 ]]; then website_action rollback || true; fi
    gh release edit "$TAG" --repo "$REPO" --draft || true
  fi
  rm -rf "$WORK"
  exit "$result"
}
trap recover_on_error EXIT

gh release edit "$TAG" --repo "$REPO" --draft=false
PUBLISHED=1

MANIFEST="$(curl --fail --silent --show-error --retry 5 \
  "https://github.com/$REPO/releases/latest/download/latest.json")"
printf '%s' "$MANIFEST" | jq -e --arg version "$VERSION" \
  '.version == $version and (.platforms | keys == ["darwin-aarch64", "darwin-x86_64"])' >/dev/null

LATEST="$(gh api "repos/$REPO/releases/latest")"
printf '%s' "$LATEST" | jq -e --arg tag "$TAG" '.tag_name == $tag and .draft == false' >/dev/null
PROMOTION_ATTEMPTED=1
website_action promote

for platform in macos windows; do
  curl --fail --silent --show-error --retry 5 \
    "https://filearchitect.com/api/updates/$platform/latest" \
    | jq -e --arg version "$VERSION" '.version == $version and (.active == true or .active == 1)' >/dev/null
done
for path in "macos" "macos?arch=intel" "windows"; do
  destination="$(curl --silent --show-error --output /dev/null --write-out '%{redirect_url}' \
    "https://filearchitect.com/download/$path")"
  [[ "$destination" == "https://github.com/$REPO/releases/download/$TAG/"* ]]
done

PUBLISHED=0
PROMOTION_ATTEMPTED=0
echo "File Architect $VERSION is live in the GitHub updater and both website platforms."
