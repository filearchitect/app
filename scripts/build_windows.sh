#!/bin/bash
# Cross-compile to Windows (x86_64) from macOS using xwin + clang-cl.
# Prerequisites: rustup target add x86_64-pc-windows-msvc; brew install llvm lld; cargo install xwin
# Deploy (optional): b2 CLI installed and authorized; exe signed with minisign for in-app updater (creates .sig).
# Run from project root so xwin can use .xwin-cache if present.

set -e

# Load local environment variables if present.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Ensure LLVM (clang-cl, llvm-lib) and LLD (lld-link) are on PATH. Homebrew keeps them keg-only.
LLVM_PREFIX=""
LLD_PREFIX=""
if command -v brew &>/dev/null; then
  LLVM_PREFIX=$(brew --prefix llvm 2>/dev/null || true)
  LLD_PREFIX=$(brew --prefix lld 2>/dev/null || true)
fi
if [[ -n "$LLVM_PREFIX" && -d "$LLVM_PREFIX/bin" ]]; then
  export PATH="$LLVM_PREFIX/bin:$PATH"
fi
if [[ -n "$LLD_PREFIX" && -d "$LLD_PREFIX/bin" ]]; then
  export PATH="$LLD_PREFIX/bin:$PATH"
fi
if ! command -v lld-link &>/dev/null; then
  echo "lld-link not found. Install with: brew install llvm lld"
  echo "  (llvm provides clang-cl and llvm-lib; lld provides lld-link)"
  exit 1
fi
if ! command -v clang-cl &>/dev/null; then
  echo "clang-cl not found. Install with: brew install llvm lld"
  exit 1
fi

# xwin splat output: CRT and SDK headers/libs (crt/include, sdk/include/ucrt, etc.)
XWIN_DIR="${XWIN_DIR:-$HOME/.xwin}"
if [[ ! -d "$XWIN_DIR/crt/include" ]]; then
  echo "Running xwin splat (one-time) to $XWIN_DIR..."
  xwin --accept-license splat --output "$XWIN_DIR"
fi

# Cross-compilation toolchain (clang-cl needs Windows include paths via CFLAGS)
export CC_x86_64_pc_windows_msvc=clang-cl
export CXX_x86_64_pc_windows_msvc=clang-cl
export AR_x86_64_pc_windows_msvc=llvm-lib
export XWIN_ARCH=x86_64
export XWIN_CACHE_DIR="${XWIN_CACHE_DIR:-$HOME/.xwin}"

# Windows CRT/SDK include paths so clang-cl finds assert.h, stdlib.h, etc.
# --target=x86_64-pc-windows-msvc is required on macOS (arm64): without it clang produces
# host (arm64) object files, which then conflict with ring's x86_64 pregenerated .o files.
CL_FLAGS="-Wno-unused-command-line-argument -fuse-ld=lld-link --target=x86_64-pc-windows-msvc"
CL_FLAGS="$CL_FLAGS -I$XWIN_DIR/crt/include"
CL_FLAGS="$CL_FLAGS -I$XWIN_DIR/sdk/include/ucrt"
CL_FLAGS="$CL_FLAGS -I$XWIN_DIR/sdk/include/um"
CL_FLAGS="$CL_FLAGS -I$XWIN_DIR/sdk/include/shared"
export CFLAGS_x86_64_pc_windows_msvc="$CL_FLAGS"
export CXXFLAGS_x86_64_pc_windows_msvc="$CL_FLAGS"

# Linker lib search paths and linker binary
export RUSTFLAGS="-Lnative=$XWIN_DIR/crt/lib/x86_64 -Lnative=$XWIN_DIR/sdk/lib/um/x86_64 -Lnative=$XWIN_DIR/sdk/lib/ucrt/x86_64"
export CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=lld-link

# Production build environment
export APP_ENV=production
export VITE_APP_URL='https://filearchitect.com'
export VITE_API_URL='https://filearchitect.com/api/v1'
export VITE_APP_ENV=production
export NODE_ENV=production
export RUST_BACKTRACE=1

# Clean previous build artifacts (skip when run after build_macos in build_all.sh)
if [[ -z "${RUNNING_ALL_BUILDS:-}" ]]; then
  echo "Cleaning previous build..."
  rm -rf dist/
  rm -rf src-tauri/target/
else
  echo "Skipping clean (preserving macOS build artifacts)..."
fi

# Optional: bump version (uncomment and run ./scripts/bump.sh if needed)
# CURRENT_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
# echo "Current version: $CURRENT_VERSION"
# ./scripts/bump.sh

# Build with production configuration for Windows x86_64
echo "Building for Windows (x86_64) with production configuration..."
VITE_USER_NODE_ENV="production"
VITE_APP_ENV="production"
NODE_ENV="production"
VITE_APP_URL="https://filearchitect.com"
VITE_API_URL="https://filearchitect.com/api/v1"
# Tauri expects CI to be true/false, not 1; unset to avoid invalid --ci 1
unset CI

# --no-bundle: NSIS/makensis fails when cross-compiling on macOS; the .exe is still produced.
pnpm tauri build --config src-tauri/tauri.production.conf.json --target x86_64-pc-windows-msvc --no-bundle

# Clean up js files in src directory
echo "Cleaning up source directory..."
cd src/ && find . -name "*.js" -type f -delete
cd ..

echo "Build completed successfully!"
EXE_PATH="./src-tauri/target/x86_64-pc-windows-msvc/release/filearchitect-app.exe"
echo "Windows .exe: $EXE_PATH"

# TODO: Re-enable when implementing real signing for in-app updater on Windows
# Generate .sig for in-app updater (Tauri expects this; key from TAURI_PRIVATE_KEY, TAURI_PRIVATE_KEY_PATH, or TAURI_SIGNING_PRIVATE_KEY)
# export TAURI_PRIVATE_KEY="${TAURI_PRIVATE_KEY:-${TAURI_SIGNING_PRIVATE_KEY:-}}"
# if [[ ! -f "${EXE_PATH}.sig" ]] && { [[ -n "${TAURI_PRIVATE_KEY:-}" ]] || [[ -n "${TAURI_PRIVATE_KEY_PATH:-}" ]]; }; then
#     echo "Signing exe for updater..."
#     pnpm tauri signer sign "$EXE_PATH"
# fi
# if [[ ! -f "${EXE_PATH}.sig" ]]; then
#     echo "Note: No .sig file (set TAURI_PRIVATE_KEY or TAURI_PRIVATE_KEY_PATH and re-run to enable in-app updates)."
# fi

# Deploy to B2 and website API (mirrors build_macos.sh flow)
echo "Do you want to deploy this build? [Y/n]"
read -r deploy_answer

if [[ ! "$deploy_answer" =~ ^[Nn]$ ]]; then
    if [[ -z "${UPDATE_API_PASSWORD:-}" ]]; then
        echo "Missing UPDATE_API_PASSWORD. Set it in your environment or .env before deploying."
        exit 1
    fi

    CURRENT_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
    echo "Current version: $CURRENT_VERSION"
    read -r -p "Use current version $CURRENT_VERSION? [Y/n]: " version_answer
    if [[ "$version_answer" =~ ^[Nn]$ ]]; then
        read -r -p "Enter version number (e.g. 0.10.0): " VERSION
    else
        VERSION=$CURRENT_VERSION
    fi

    BASE_URL="https://filearchitect.com"
    API_URL="$BASE_URL/api/updates-fxkFU46XsIMbRKz28d/windows"
    BUCKET_NAME="filearchitect-juvosBQkaJRTM5Wq8VPF"

    EXE_PATH="./src-tauri/target/x86_64-pc-windows-msvc/release/filearchitect-app.exe"
    EXE_REMOTE_NAME="File Architect_${VERSION}_x64.exe"
    # Tauri updater expects platforms key "windows-x86_64" (OS-ARCH), not Rust triple
    EXE_REMOTE_PATH="releases/$EXE_REMOTE_NAME"

    echo "Uploading $EXE_REMOTE_NAME to B2..."
    b2 file upload "$BUCKET_NAME" "$EXE_PATH" "$EXE_REMOTE_PATH"
    EXE_URL="https://f001.backblazeb2.com/file/$BUCKET_NAME/$EXE_REMOTE_PATH"

    # TODO: Re-enable when implementing real signing (Windows uses manual download from website for now)
    # Updater requires .sig (from "tauri signer sign" step above; needs TAURI_PRIVATE_KEY or TAURI_PRIVATE_KEY_PATH)
    SIGNATURE_FILE=""
    # if [[ -f "${EXE_PATH}.sig" ]]; then
    #     SIG_REMOTE_PATH="releases/${EXE_REMOTE_NAME}.sig"
    #     echo "Uploading signature to B2..."
    #     b2 file upload "$BUCKET_NAME" "${EXE_PATH}.sig" "$SIG_REMOTE_PATH"
    #     SIGNATURE_FILE=$(cat "${EXE_PATH}.sig")
    # else
    #     echo "Warning: No .sig file — in-app updater will not work until you sign the exe (set TAURI_PRIVATE_KEY or TAURI_PRIVATE_KEY_PATH and re-run build)."
    # fi

    # Build JSON: Tauri expects platforms key "windows-x86_64" (OS-ARCH). jq escapes signature newlines.
    if command -v jq &>/dev/null; then
        REQUEST_BODY=$(jq -n \
            --arg version "$VERSION" \
            --arg exe_url "$EXE_URL" \
            --arg signature "$SIGNATURE_FILE" \
            --arg password "$UPDATE_API_PASSWORD" \
            '{ password: $password, version: $version, notes: "Windows update", exe_url: $exe_url, platforms: { "windows-x86_64": { signature: $signature, url: $exe_url } } }')
    else
        # Fallback: escape newlines in signature for JSON
        SIGNATURE_ESCAPED="${SIGNATURE_FILE//$'\n'/\\n}"
        REQUEST_BODY=$(cat <<EOF
{
    "password": "$UPDATE_API_PASSWORD",
    "version": "$VERSION",
    "notes": "Windows update",
    "exe_url": "$EXE_URL",
    "platforms": {
        "windows-x86_64": {
            "signature": "$SIGNATURE_ESCAPED",
            "url": "$EXE_URL"
        }
    }
}
EOF
        )
    fi

    echo "Sending request to: $API_URL"
    RESPONSE=$(curl -s -X POST "$API_URL" \
         -H "Content-Type: application/json" \
         -H "Accept: application/json" \
         -d "$REQUEST_BODY")
    echo "Response: $RESPONSE"
    echo "Windows build deployed with version $VERSION"
    echo "Make it active in admin panel: $BASE_URL/admin"
else
    echo "Build completed without deployment"
fi
