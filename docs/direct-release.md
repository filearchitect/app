# Direct-sale release (macOS and Windows)

## One source of truth

Develop in the permanent public `filearchitect/app` checkout. Its GitHub release supplies the macOS Tauri updater manifest and the Windows manual installer. The website stores separate API/download records, now generated from that same release. The private `seblavoie/filearchitect-app` checkout and old B2 publishing scripts are historical and must not publish new versions. Setapp submissions are paused pending an active-user check.

Existing macOS 0.11.22 clients read GitHub's `releases/latest/download/latest.json` directly. Keep that URL, the embedded updater public key, and both Mac architectures compatible. Windows remains an unsigned, manual-download flow.

## Prepare and build

1. Verify the website is healthy and its release API is deployed. Note the currently active version for rollback. Confirm both repositories have the matching `RELEASE_API_TOKEN` secret; the website deploy workflow installs it into Forge's shared environment file without printing it.
2. Choose a version greater than all published/tagged versions. Run `node scripts/version-sync.mjs <version>`, review the manifest and changelog changes, and commit. Run `node scripts/version-check.mjs <version>`, `pnpm test`, and `pnpm build`.
3. Run the `Release (Tag)` workflow on the branch with macOS and Windows enabled. This dry run signs and notarizes both Mac builds and builds Windows; it does not publish or activate. Test Windows licensing with a disposable local-server key over Tailscale: first registration, repeat validation, machine-limit rejection, Account state, and no-update response. Check the standalone Windows executable from a clean location. Test both Mac architectures where hardware is available.
4. Merge the verified branch into public `main`. Run `scripts/tag-release.sh <version>` and push its tag. The tag workflow creates a **draft** release, builds both Mac architectures and Windows from that commit, checks signing, notarization and Gatekeeper, creates `latest.json`, downloads and hashes all eight assets, and stages inactive website records. Require every job to pass.
5. Review the `Verify release and stage website records` job summary: same version, both macOS signatures, all assets and checksums, Windows EXE, and inactive website state. Do not promote if an artifact or behavior check fails.

## Manual promotion

After the release report is approved, manually dispatch `Promote or Roll Back Release` with the version and `promote` action. It rechecks the draft and successful tag workflow, publishes GitHub, verifies the public updater feed, asks the website to validate all assets/signatures and activate both records in one transaction, then checks the website APIs and Mac ARM/Intel/Windows download redirects. A failed check attempts website rollback and returns GitHub to draft.

For a post-release problem, dispatch the same workflow with `rollback`. It restores the previous website records and returns GitHub to draft. Already updated installations require a later fix; rollback does not downgrade them.

Local `build_macos.sh` and `build_windows.sh` only build and verify. `build_all.sh` intentionally exits. No local script uploads artifacts or changes the advertised version.
