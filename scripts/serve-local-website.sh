#!/usr/bin/env bash
set -euo pipefail

WEBSITE_DIR="${1:?Usage: serve-local-website.sh /path/to/filearchitect-website}"
test -f "$WEBSITE_DIR/artisan" || { echo "Laravel website checkout not found" >&2; exit 1; }
command -v tailscale >/dev/null
command -v php >/dev/null
command -v jq >/dev/null

IP="$(tailscale status --json | jq -r '.Self.TailscaleIPs[0] // empty')"
DNS="$(tailscale status --json | jq -r '.Self.DNSName // empty' | sed 's/\.$//')"
test -n "$IP" && test -n "$DNS" || { echo "Start Tailscale on this Mac first" >&2; exit 1; }
test "$DNS" = "sebastiens-macbook-pro-1.tailadfdf5.ts.net" || {
  echo "Tailnet hostname changed; update the test capability before using this script" >&2
  exit 1
}

PORT=8374
tailscale serve --bg --https=443 "http://127.0.0.1:$PORT"
echo "Private website: https://$DNS"
echo "Windows test VITE_APP_URL=https://$DNS"
echo "Windows test VITE_API_URL=https://$DNS/api/v1"
echo "The Laravel server runs until you stop this command."
cd "$WEBSITE_DIR"
php artisan serve --host=127.0.0.1 --port="$PORT"
