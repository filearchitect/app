#!/bin/bash
# Run macOS build (and optional deploy), then Windows build (and optional deploy).
# When chained, Windows script skips cleaning so macOS artifacts are preserved.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "========== Step 1/2: macOS build =========="
"$SCRIPT_DIR/build_macos.sh"

echo ""
echo "========== Step 2/2: Windows build =========="
export RUNNING_ALL_BUILDS=1
"$SCRIPT_DIR/build_windows.sh"

echo ""
echo "========== All builds finished =========="
