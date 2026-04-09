# Setapp Release

Setapp builds are produced locally on a Mac, not in GitHub Actions. The hosted macOS runners do not currently provide a Swift toolchain compatible with the Setapp SDK version used by this app.

## Required local inputs

- A populated `.env` in the repo root with:
  - `APPLE_SIGNING_IDENTITY`
  - `PROVIDER_SHORT_NAME`
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_CERTIFICATE`
- A real Setapp public key at `src-tauri/resources/setappPublicKey.pem`
- A local Setapp SDK checkout or extracted framework directory

## Required SDK paths

Export:

```bash
export SETAPP_SDK_DIR="/absolute/path/to/Setapp.xcframework/macos-arm64_x86_64"
export SETAPP_RESOURCES_BUNDLE="/absolute/path/to/SetappFramework-Resources.bundle"
```

`SETAPP_RESOURCES_BUNDLE` is optional if the bundle sits next to the SDK slice directory. The script will infer it from `SETAPP_SDK_DIR` in that case.

## Build command

From the repo root:

```bash
bash ./scripts/build_setapp_macos.sh
```

The script:

- loads `.env`
- validates the Apple signing and notarization variables
- stages the Setapp SDK under `src-tauri/.setapp-sdk/`
- builds the Setapp flavor with `src-tauri/tauri.setapp.conf.json`
- notarizes and staples the final DMG artifact
- writes distributable artifacts to `dist/setapp/`

## Output artifacts

After a successful build:

- app bundle: `src-tauri/target/release/bundle/macos/File Architect.app`
- zip: `dist/setapp/filearchitect_setapp_<version>_universal.zip`
- dmg, if Tauri produced one: `dist/setapp/filearchitect_setapp_<version>.dmg`

## Notes

- `UPDATE_API_PASSWORD` is not used for Setapp builds because the Setapp flavor does not publish Tauri updater artifacts.
- `PROVIDER_SHORT_NAME` can stay in `.env` for consistency with other macOS release scripts, but the Setapp build currently relies on the macOS bundle configuration already checked into `src-tauri/tauri.conf.json`.

## Local Setapp UX testing

If you want to test the app's own Setapp-specific UX locally before real Setapp provisioning is available, create `~/fa.json` with a `setapp` override block and build the local test app:

```bash
bash ./scripts/build_setapp_test_app.sh
open "/Applications/File Architect Setapp Test.app"
```

This produces a local-only app with bundle ID `com.filearchitect.app-setapp-local`. It uses the Setapp frontend/license paths but intentionally does not link the Setapp SDK, so SetappAgent cannot block the app before the UI loads.

The app also checks `~/Documents/fa.json` as a fallback, but `~/fa.json` is preferred because it avoids macOS Documents-folder privacy prompts during local testing.

Example active override:

```json
{
    "setapp": {
      "active": true,
      "available": true,
      "purchaseType": "single_app"
  }
}
```

Example blocked override:

```json
{
  "setapp": {
    "active": false,
    "available": true
  }
}
```

Supported fields:

- `active`: `true` or `false`
- `available`: `true` or `false`
- `enabled`: optional, defaults to `true`
- `purchaseType`: `"single_app"` for the Setapp Marketplace one-time purchase flow, or `"membership"` if testing the classic Setapp membership flow
- `expirationDate`: ISO timestamp or `null`

This override is for local testing only. Use `scripts/build_setapp_macos.sh` for real Setapp validation and submission builds, because that path uses bundle ID `com.filearchitect.app-setapp`, links the Setapp SDK, and exercises SetappAgent provisioning.
