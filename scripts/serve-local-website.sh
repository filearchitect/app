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
PORT=8374
echo "Private website: http://$DNS:$PORT"
echo "Windows test VITE_APP_URL=http://$DNS:$PORT"
echo "Windows test VITE_API_URL=http://$DNS:$PORT/api/v1"
echo "The Laravel server runs until you stop this command."
cd "$WEBSITE_DIR"
php artisan serve --host="$IP" --port="$PORT"
