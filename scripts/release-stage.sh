#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: release-stage.sh <version>}"
VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release version" >&2; exit 1; }
TAG="v$VERSION"
REPO="filearchitect/app"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

node scripts/version-check.mjs "$VERSION"
IS_DRAFT="$(gh release view "$TAG" --repo "$REPO" --json isDraft --jq '.isDraft')"
if [[ "${RELEASE_STAGE_DRY_RUN:-0}" != 1 ]]; then
  test "$IS_DRAFT" = true
fi
gh release download "$TAG" --repo "$REPO" --dir "$WORK" --clobber

NAMES=(
  "filearchitect_${VERSION}_darwin-aarch64.dmg"
  "filearchitect_${VERSION}_darwin-x86_64.dmg"
  "filearchitect_${VERSION}_darwin-aarch64.app.tar.gz"
  "filearchitect_${VERSION}_darwin-aarch64.app.tar.gz.sig"
  "filearchitect_${VERSION}_darwin-x86_64.app.tar.gz"
  "filearchitect_${VERSION}_darwin-x86_64.app.tar.gz.sig"
  "filearchitect_${VERSION}_windows-x86_64.exe"
  "latest.json"
)
for name in "${NAMES[@]}"; do
  test -s "$WORK/$name" || { echo "Missing or empty release asset: $name" >&2; exit 1; }
done

jq -e --arg version "$VERSION" '.version == $version and (.platforms | keys == ["darwin-aarch64", "darwin-x86_64"])' "$WORK/latest.json" >/dev/null
for arch in darwin-aarch64 darwin-x86_64; do
  name="filearchitect_${VERSION}_${arch}.app.tar.gz"
  expected_url="https://github.com/${REPO}/releases/download/${TAG}/${name}"
  actual_url="$(jq -r --arg arch "$arch" '.platforms[$arch].url' "$WORK/latest.json")"
  actual_sig="$(jq -r --arg arch "$arch" '.platforms[$arch].signature' "$WORK/latest.json")"
  test "$actual_url" = "$expected_url"
  test "$actual_sig" = "$(cat "$WORK/$name.sig")"
done

NOTES="$(awk -v ver="$VERSION" '$0 == "## " ver { found=1; next } found && /^## / { exit } found { print }' CHANGELOG.md)"
test -n "$NOTES" || NOTES="File Architect $VERSION"
jq -n --arg version "$VERSION" --arg notes "$NOTES" --slurpfile manifest "$WORK/latest.json" \
  '{version:$version,notes:$notes,manifest:$manifest[0]}' > "$WORK/payload.json"

REPORT="${RELEASE_REPORT_PATH:-${RUNNER_TEMP:-/tmp}/filearchitect-release-report-${VERSION}.md}"
{
  printf '# File Architect %s release report\n\n' "$VERSION"
  printf 'Source: `%s` at `%s`\n\n' "$TAG" "$(git rev-parse --short HEAD)"
  printf 'Verified: two macOS archives and signatures, two DMGs, Windows EXE, updater manifest.\n\n'
  printf '| Asset | SHA-256 |\n|---|---|\n'
  for name in "${NAMES[@]}"; do
    if command -v sha256sum >/dev/null 2>&1; then
      hash="$(sha256sum "$WORK/$name" | cut -d ' ' -f 1)"
    else
      hash="$(shasum -a 256 "$WORK/$name" | cut -d ' ' -f 1)"
    fi
    printf '| `%s` | `%s` |\n' "$name" "$hash"
  done
  printf '\nGitHub release draft: `%s`. This verification does not change release state.\n' "$IS_DRAFT"
} > "$REPORT"
cat "$REPORT"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$REPORT" >> "$GITHUB_STEP_SUMMARY"
fi

if [[ "${RELEASE_STAGE_DRY_RUN:-0}" == "1" ]]; then
  echo "Dry run: website staging skipped."
  exit 0
fi

test -n "${RELEASE_API_TOKEN:-}" || { echo "Missing RELEASE_API_TOKEN" >&2; exit 1; }
API_BASE="${RELEASE_API_BASE:-https://filearchitect.com/api/internal/releases}"
curl --fail-with-body --silent --show-error --retry 3 \
  -H "Authorization: Bearer $RELEASE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$WORK/payload.json" "$API_BASE/stage" > "$WORK/response.json"
jq -e --arg version "$VERSION" '.version == $version and .state == "staged"' "$WORK/response.json" >/dev/null
echo "Website release records staged inactive."
