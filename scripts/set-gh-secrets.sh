#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-filearchitect/app}"
ENV_FILE="${2:-.env}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is not installed."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE"
  echo "Usage: $0 [owner/repo] [path/to/.env]"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

required=(
  APPLE_CERTIFICATE
  APPLE_CERTIFICATE_PASSWORD
  APPLE_SIGNING_IDENTITY
  APPLE_ID
  APPLE_PASSWORD
  APPLE_TEAM_ID
  TAURI_SIGNING_PRIVATE_KEY
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD
)

missing=()
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Error: missing required variables in $ENV_FILE:"
  for key in "${missing[@]}"; do
    echo "  - $key"
  done
  exit 1
fi

# Allow TAURI_SIGNING_PRIVATE_KEY to be provided as a file path.
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" && -f "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  TAURI_SIGNING_PRIVATE_KEY="$(cat "${TAURI_SIGNING_PRIVATE_KEY}")"
fi

echo "Setting secrets on $REPO ..."
for key in "${required[@]}"; do
  printf '%s' "${!key}" | gh secret set "$key" --repo "$REPO"
  echo "  ✓ $key"
done

# Keep compatibility with workflows/tools that still expect TAURI_PRIVATE_KEY names.
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  printf '%s' "${TAURI_SIGNING_PRIVATE_KEY}" | gh secret set TAURI_PRIVATE_KEY --repo "$REPO"
  echo "  ✓ TAURI_PRIVATE_KEY (alias)"
fi
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
  printf '%s' "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD}" | gh secret set TAURI_PRIVATE_KEY_PASSWORD --repo "$REPO"
  echo "  ✓ TAURI_PRIVATE_KEY_PASSWORD (alias)"
fi

echo "Done. Current repo secrets:"
gh secret list --repo "$REPO"
