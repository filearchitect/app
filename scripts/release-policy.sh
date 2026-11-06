#!/usr/bin/env bash
# Source after VERSION is set. 0.13.0 is the final Intel transition release.
LEGACY_MAC_VERSION=0.13.0
MANIFEST_NAME=apple-silicon.json
MAC_ARCHES=(darwin-aarch64)
if [[ "$VERSION" == "$LEGACY_MAC_VERSION" ]]; then
  MAC_ARCHES+=(darwin-x86_64)
fi
NAMES=(latest.json apple-silicon.json "filearchitect_${VERSION}_windows-x86_64.exe")
for arch in "${MAC_ARCHES[@]}"; do
  NAMES+=("filearchitect_${VERSION}_${arch}.dmg" "filearchitect_${VERSION}_${arch}.app.tar.gz" "filearchitect_${VERSION}_${arch}.app.tar.gz.sig")
done
