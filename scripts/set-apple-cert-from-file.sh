#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-filearchitect/app}"
P12_PATH="${2:-}"

if [[ -z "$P12_PATH" ]]; then
  echo "Usage: $0 [owner/repo] /absolute/path/to/certificate.p12"
  exit 1
fi

if [[ ! -f "$P12_PATH" ]]; then
  echo "Error: file not found: $P12_PATH"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is not installed."
  exit 1
fi

CERT_B64_SIZE=$(base64 -i "$P12_PATH" | tr -d '\n' | wc -c | tr -d '[:space:]')
if [[ "$CERT_B64_SIZE" -gt 65536 ]]; then
  echo "Error: base64 certificate is ${CERT_B64_SIZE} bytes, exceeds GitHub secret limit (65536)."
  exit 1
fi

printf 'Enter APPLE_CERTIFICATE_PASSWORD (for %s): ' "$P12_PATH"
read -rs CERT_PASS
echo

if [[ -z "$CERT_PASS" ]]; then
  echo "Error: APPLE_CERTIFICATE_PASSWORD cannot be empty"
  exit 1
fi

base64 -i "$P12_PATH" | tr -d '\n' | gh secret set APPLE_CERTIFICATE --repo "$REPO" --body -
printf '%s' "$CERT_PASS" | gh secret set APPLE_CERTIFICATE_PASSWORD --repo "$REPO" --body -

echo "Updated APPLE_CERTIFICATE and APPLE_CERTIFICATE_PASSWORD on $REPO"
gh secret list --repo "$REPO"
