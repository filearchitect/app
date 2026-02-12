#!/bin/bash

# Load local environment variables if present.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Default local behavior: sign with the identity already in macOS Keychain.
# Only use PKCS12 import when explicitly requested (mainly CI).
if [[ "${TAURI_USE_APPLE_CERT_IMPORT:-false}" != "true" ]]; then
  unset APPLE_CERTIFICATE
  unset APPLE_CERTIFICATE_PASSWORD
else
  if [[ -z "${APPLE_CERTIFICATE:-}" || -z "${APPLE_CERTIFICATE_PASSWORD:-}" ]]; then
    echo "TAURI_USE_APPLE_CERT_IMPORT=true but APPLE_CERTIFICATE / APPLE_CERTIFICATE_PASSWORD is missing."
    exit 1
  fi
fi

# Set environment variables for production build.
# Sensitive values must come from your shell/.env and are never hardcoded.
if [[ -z "${APPLE_ID:-}" || -z "${APPLE_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
  echo "Missing Apple signing credentials. Set APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID."
  exit 1
fi

export APP_ENV=production
export VITE_APP_URL='https://filearchitect.com'
export VITE_API_URL='https://filearchitect.com/api/v1'
export VITE_APP_ENV=production
export NODE_ENV=production
# export TAURI_DEBUG=true
export RUST_BACKTRACE=1

# Clean previous build artifacts
echo "Cleaning previous build..."
rm -rf dist/
rm -rf src-tauri/target/

# Get current version and ask for new version
# CURRENT_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
# echo "Current version: $CURRENT_VERSION"
# read -r -p "Enter new version: " NEW_VERSION

# echo "Updating version to $NEW_VERSION..."
./scripts/bump.sh "$NEW_VERSION"

# Build with production configuration
echo "Building with production configuration..."
VITE_USER_NODE_ENV="production"
VITE_APP_ENV="production"
NODE_ENV="production"
VITE_APP_URL="https://filearchitect.com"
VITE_API_URL="https://filearchitect.com/api/v1"

pnpm tauri build --config src-tauri/tauri.production.conf.json 

# Clean up js files in src directory
echo "Cleaning up source directory..."
cd src/ && find . -name "*.js" -type f -delete 
cd ..

echo "Build completed successfully!"

# Ask about deployment
echo "Do you want to deploy this build? [Y/n]"
read -r deploy_answer

if [[ ! "$deploy_answer" =~ ^[Nn]$ ]]; then
    if [[ -z "${UPDATE_API_PASSWORD:-}" ]]; then
        echo "Missing UPDATE_API_PASSWORD. Set it in your environment or .env before deploying."
        exit 1
    fi

    # Get current version from package.json
    CURRENT_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
    echo "Current version: $CURRENT_VERSION"

    # Ask if we should use current version
    read -r -p "Use current version $CURRENT_VERSION? [Y/n]: " version_answer
    if [[ "$version_answer" =~ ^[Nn]$ ]]; then
        read -r -p "Enter version number (e.g. 0.1.1): " VERSION
    else
        VERSION=$CURRENT_VERSION
    fi

    # Ask about deployment environment
    # read -r -p "Deploy to production or local? (production/local): " DEPLOYMENT_ENV

    # if [[ "$DEPLOYMENT_ENV" == "production" ]]; then
    BASE_URL="https://filearchitect.com"    
    API_URL="$BASE_URL/api/updates-fxkFU46XsIMbRKz28d/macos"
    # else
        # BASE_URL="https://filearchitect-website.test"
        # API_URL="$BASE_URL/api/updates-fxkFU46XsIMbRKz28d"
    # fi

    # B2 bucket configuration
    BUCKET_NAME="filearchitect-juvosBQkaJRTM5Wq8VPF"
    BUCKET_URL="https://f001.backblazeb2.com/file/$BUCKET_NAME"

    # Upload update file
    UPDATE_FILE="./src-tauri/target/release/bundle/macos/File Architect.app.tar.gz"
    SIGNATURE_FILE=$(cat "$UPDATE_FILE.sig")
    UPDATE_REMOTE_PATH="releases/File Architect.app.tar.gz"
    
    echo "Uploading update file to B2..."
    FILE_INFO=$(b2 file upload "$BUCKET_NAME" "$UPDATE_FILE" "$UPDATE_REMOTE_PATH")
    UPDATE_URL=$(echo "$FILE_INFO" | grep -o 'https://f001\.backblazeb2\.com/file[^ "]*')

    # Upload DMG file
    DMG_FILE="./src-tauri/target/release/bundle/dmg/File Architect_${VERSION}_aarch64.dmg"
    DMG_REMOTE_PATH="releases/File Architect_${VERSION}_aarch64.dmg"
    
    echo "Uploading DMG file to B2..."
    FILE_INFO=$(b2 file upload "$BUCKET_NAME" "$DMG_FILE" "$DMG_REMOTE_PATH")
    DMG_URL=$(echo "$FILE_INFO" | grep -o 'https://f001\.backblazeb2\.com/file[^ "]*')

    # Debug output
    echo "UPDATE_URL: $UPDATE_URL"
    echo "DMG_URL: $DMG_URL"

    # Construct and send API request
    REQUEST_BODY=$(cat <<EOF
{
    "password": "$UPDATE_API_PASSWORD",
    "version": "$VERSION",
    "notes": "Update notes",
    "dmg_url": "$DMG_URL",
    "platforms": {
        "darwin-aarch64": {
            "signature": "$SIGNATURE_FILE",
            "url": "$UPDATE_URL"
        }
    }
}
EOF
    )

    echo "Sending request to server: $API_URL"
    echo "$REQUEST_BODY"

    RESPONSE=$(curl -X POST "$API_URL" \
         -H "Content-Type: application/json" \
         -H "Accept: application/json" \
         -d "$REQUEST_BODY")

    echo "Response: $RESPONSE"
    echo "App deployed to production with version $VERSION"
    echo "To make it available to users you need to make it active in admin panel: $BASE_URL/admin"
else
    echo "Build completed without deployment"
fi
