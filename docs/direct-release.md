# Direct-sale release (macOS and Windows)

## One source of truth

Develop in the permanent public `filearchitect/app` checkout. Its GitHub release supplies the macOS Tauri updater manifest and the Windows manual installer. The website stores separate API/download records, now generated from that same release. The private `seblavoie/filearchitect-app` checkout and old B2 publishing scripts are historical and must not publish new versions. Setapp was retired after confirming zero active installs and trials; only the direct-sale build is released.

Existing macOS 0.11.22 clients read GitHub's `releases/latest/download/latest.json` directly. Keep that URL, the embedded updater public key, and both Mac architectures compatible. Windows remains an unsigned, manual-download flow.

## Prepare and build

1. Verify the website is healthy and its release API is deployed. Note the currently active version for rollback. Confirm both repositories have the matching `RELEASE_API_TOKEN` secret; the website deploy workflow installs it into Forge's shared environment file without printing it.
2. Choose a version greater than all published/tagged versions. Run `node scripts/version-sync.mjs <version>`, review the manifest and changelog changes, and commit. Run `node scripts/version-check.mjs <version>`, `pnpm test`, and `pnpm build`.
3. Run the `Release (Tag)` workflow on the branch with macOS and Windows enabled. This dry run signs and notarizes both Mac builds and builds Windows; it does not publish or activate. Follow [Windows licensing tests over Tailscale](windows-tailnet-test.md) with a disposable local-server key: first registration, repeat validation, machine-limit rejection, Account state, and no-update response. Check the standalone Windows executable from a clean location. Test both Mac architectures where hardware is available.
4. Merge the verified branch into public `main`. Run `scripts/tag-release.sh <version>` and push its tag. The tag workflow creates a **draft** release, builds both Mac architectures and Windows from that commit, checks signing, notarization and Gatekeeper, creates `latest.json`, downloads and hashes all eight assets, and stages inactive website records. Require every job to pass.
5. Review the `Verify release and stage website records` job summary: same version, both macOS signatures, all assets and checksums, Windows EXE, and inactive website state. Do not promote if an artifact or behavior check fails.

## Manual promotion

After the release report is approved, manually dispatch `Promote or Roll Back Release` with the version and `promote` action. It rechecks the draft and successful tag workflow, publishes GitHub, verifies the public updater feed, asks the website to validate all assets/signatures and activate both records in one transaction, then checks the website APIs and Mac ARM/Intel/Windows download redirects. A failed check attempts website rollback and returns GitHub to draft.

For a post-release problem, dispatch the same workflow with `rollback`. It restores the previous website records and returns GitHub to draft. Already updated installations require a later fix; rollback does not downgrade them.

Local `build_macos.sh` and `build_windows.sh` only build and verify. `build_all.sh` intentionally exits. No local script uploads artifacts or changes the advertised version.

## Approval and access

The approval step is a deliberate manual dispatch of `Promote or Roll Back Release` by a repository maintainer after reviewing the report. There is currently no separate GitHub environment reviewer gate. Do not dispatch promotion on someone else's behalf without their explicit approval of that release. The preparation workflow never grants approval by succeeding.

## Credentials and rotation

Maintain these app repository Actions secrets: `RELEASE_API_TOKEN`; `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD`; `APPLE_SIGNING_IDENTITY`; `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), and `APPLE_TEAM_ID`; `TAURI_SIGNING_PRIVATE_KEY` and its password when encrypted. Legacy `TAURI_PRIVATE_KEY` names remain supported by the workflow. `GITHUB_TOKEN` is supplied automatically. The current build also accepts `VITE_DEEPINFRA_API_KEY` or its `DEEPINFRA_API_KEY` fallback; review client-side AI credential delivery separately from release operations.

For release API credential rotation, generate a new random credential in a password manager, update the website repository's `RELEASE_API_TOKEN`, deploy the website successfully, then update the app repository's matching secret. Do not stage or promote during that interval. Verify an unauthenticated API request returns 401 and an authenticated invalid payload returns 422 without recording the credential in output. The credential grants release operations only.

Renew Developer ID credentials before certificate expiry and verify both architectures in a dry build. Preserve the Tauri updater signing key: existing clients trust its public key. Replacing it requires a planned client migration; changing a GitHub secret alone is insufficient.

## Recovery

If promotion fails, inspect the workflow log and both live website APIs before retrying. If website rollback fails, the script keeps GitHub downloads public so active website records do not point to unavailable files. Restore website state first, verify its download routes, then return the failed GitHub release to draft. A failed GitHub draft operation also requires manual intervention. Do not delete release assets during recovery. Run the rollback workflow from the same release version being reverted.

See [verification evidence and limits](release-verification.md) before the first production promotion with this automation. Run `python3 scripts/tests/test_release_promote.py` when changing promotion orchestration; it uses simulated services and does not publish anything.
