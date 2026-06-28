# Mac App Store Release

The Mac App Store build is a separate macOS flavor for App Store Connect. It is not the direct-download build and it is not the Setapp build.

## Product model

- Bundle ID: `com.filearchitect.app-mas`
- First release model: paid upfront app
- No license-key activation, trial creation, external purchase CTA, or in-app updater
- Updates are delivered by the Mac App Store
- AI access is not included in this first App Store flavor

## Required local inputs

Create or update `.env` with:

```bash
APPSTORE_APP_SIGNING_IDENTITY="Apple Distribution: SEBASTIEN LAVOIE (3C582ZLBF3)"
APPSTORE_INSTALLER_SIGNING_IDENTITY="3rd Party Mac Developer Installer: SEBASTIEN LAVOIE (3C582ZLBF3)"
```

If Apple Developer shows older Mac-specific certificate names, use the exact names from:

```bash
security find-identity -v -p codesigning
```

Also make sure both Rust macOS targets are installed:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

## Build command

From the repo root:

```bash
pnpm tauri:build:appstore
```

The script:

- loads `.env`
- sets `VITE_IS_APPSTORE=true`
- validates the App Store application and installer signing identities exist in the local keychain
- builds with `src-tauri/tauri.appstore.conf.json`
- generates a temporary config under `src-tauri/target/` with the local App Store signing identity
- disables Tauri updater artifacts
- uses `src-tauri/entitlements.appstore.plist`
- builds a universal macOS app bundle
- packages a signed `.pkg` under `dist/appstore/`
- prints an App Store Connect upload command

## Expected artifacts

- App bundle: `src-tauri/target/universal-apple-darwin/release/bundle/macos/File Architect.app`
- App Store package: `dist/appstore/File Architect.pkg`

Upload the `.pkg` with Transporter or the command printed by the script.

## Verification matrix

Before submitting:

```bash
pnpm test
pnpm build
pnpm tauri:build:appstore
```

Also verify the normal direct build and Setapp build separately:

```bash
env -u APPLE_ID -u APPLE_PASSWORD -u APPLE_TEAM_ID pnpm tauri build --config src-tauri/tauri.production.conf.json --bundles app
bash scripts/build_setapp_test_app.sh
```

## Review notes

- The App Store flavor stores internal templates in the app container and functional blank-file cache in the app cache directory.
- Project structures are written only to user-selected destinations.
- If a saved destination is no longer accessible inside the sandbox, ask the user to reselect it.
- The regular direct-download app keeps its own license, updater, and broad filesystem behavior.
- The Setapp app keeps SetappAgent entitlement checks and Setapp-managed updates.
