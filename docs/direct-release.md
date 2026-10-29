# Direct-sale app release (macOS and Windows)

## Source of truth

The public `filearchitect/app` repository is the production app. Existing 0.11.22 installations check `https://github.com/filearchitect/app/releases/latest/download/latest.json`; Windows checks that repository's latest release API. Publish both platforms from **one commit** in this repository. The private `seblavoie/filearchitect-app` repository and its B2 release files are not an updater feed for installed 0.11.22 clients.

The website (`filearchitect-website`) keeps separate download records. Keep those records inactive until the matching public GitHub release and files have been verified. Do not use an old B2 artifact for a new GitHub release. The Setapp release is a separate flow in [setapp-release.md](setapp-release.md).

Production builds always use the public release store key already embedded in installed versions. Developer `.env` overrides are ignored for that key in production so local and CI artifacts can read the same stored license.

## Prepare

1. Confirm the production website is healthy and its licensing and update APIs respond. Note the currently active website versions for rollback.
2. Merge all app changes to public `filearchitect/app/main`. Confirm the working tree is clean and `main` is current. Keep unrelated work in another branch.
3. Choose a version greater than every version already released or tagged across both app repositories. A failed/tagged version is never reused. For the current recovery, use **0.12.1**: private 0.12.0 exists, while public 0.11.25 is the baseline.
4. Run `node scripts/version-sync.mjs 0.12.1`. Review and commit `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, and `CHANGELOG.md`. Run `node scripts/version-check.mjs 0.12.1`, `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`.
5. Verify Windows activation on a disposable local-server license key: first activation, repeat validation, full-machine-limit rejection, Account-screen state, and the no-update response. Verify Setapp behavior separately. Do not register a production license for this test.

## Build a draft

1. On public `main`, run `./scripts/tag-release.sh 0.12.1`, then push the tag to the public repository. The tag workflow creates a **draft** GitHub release and builds ARM macOS, Intel macOS, and Windows from the same commit. No workflow job publishes it automatically.
2. Require all `Release (Tag)` jobs to pass. The macOS jobs must verify the Developer ID signature, Gatekeeper acceptance, and stapled notarization ticket before uploading. The draft must contain both `.app.tar.gz` archives and `.sig` files, both DMGs, a `latest.json` manifest, and `filearchitect_0.12.1_windows-x86_64.exe`.
3. Inspect `latest.json`: version, both macOS architecture keys, URLs to this exact tag, and signatures equal to the matching `.sig` assets. Download each asset and record SHA-256 checksums. Test the DMG/app on a clean Mac; test the standalone EXE from a clean folder on Windows. Confirm production API URL, activation, Account state, update check, and Windows download behavior.

## Publish and activate

1. Publish the verified GitHub draft. Confirm `https://github.com/filearchitect/app/releases/latest/download/latest.json` now reports 0.12.1 and both macOS archives download. Confirm the Windows latest-release API advertises 0.12.1 and its EXE downloads.
2. Create **inactive** macOS and Windows 0.12.1 records in the website admin with the verified GitHub asset URLs and updater signature. Check each record and its links; then activate both. Confirm the website update APIs and `/download` point to 0.12.1.
3. From an installed 0.11.22 Mac, run Check for Updates and complete the signed update. On Windows, confirm Check for Updates offers the manual download and the new EXE launches. Confirm the app reports 0.12.1 after installation.

## Stop and rollback

If any build, notarization, signature, standalone launch, or licensing check fails, leave the GitHub release in draft and the website records inactive. If post-publication checks fail, set the GitHub release back to draft and reactivate the previous website records. Users who have already installed the new version require a subsequent fix; rollback does not downgrade them.

Local `build_macos.sh` and `build_windows.sh` only build and verify their respective targets. They never change versions, delete the target directory, upload to B2, or publish website records. `build_all.sh` is retired to prevent mixing macOS and cross-compiled Windows artifacts.
