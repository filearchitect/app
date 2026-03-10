# Changelog Workflow

Use this workflow during normal app development so release notes are always ready.

## Rule
Every PR that changes behavior should add at least one bullet to `CHANGELOG.md` under `## Unreleased`.

## Where to write
Update one of these sections in `CHANGELOG.md`:
- `### Added`
- `### Changed`
- `### Fixed`

Keep bullets user-facing and concise.

## Bullet style
- Start with an action/result, not implementation details.
- Mention scope if useful (for example: updater, licensing, editor, AI generation).
- Prefer one line per user-visible change.

Examples:
- Fixed updater loop where the same version was repeatedly offered after install.
- Changed release builds to sync app version from Git tags automatically.
- Added fallback for account and purchase links when app URL env is missing.

## Release cut process
1. Confirm `## Unreleased` accurately reflects all merged work.
2. Create a new version heading in `CHANGELOG.md` (for example `## 0.11.5`).
3. Move bullets from `Unreleased` into that version.
4. Reset `Unreleased` sections for the next cycle.
5. Use those bullets as GitHub release notes.

## Tag and publish checklist
Use this exact sequence to avoid CI failures in `Release (Tag)`:
1. Sync versions first: `node scripts/version-sync.mjs <x.y.z>`.
2. Verify version alignment: `node scripts/version-check.mjs <x.y.z>`.
3. Commit version updates (`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`).
4. Create a strict semver tag only: `git tag -a v<x.y.z> -m "Release v<x.y.z>"`.
5. Push commit and tag: `git push origin main && git push origin v<x.y.z>`.

## Preventing tag/version mismatch failures
- Do not use suffix tags for production releases (for example `v0.11.21-fix`). The release workflow validates that tag version exactly matches app version.
- Prefer `./scripts/tag-release.sh <x.y.z>` for release tagging. It syncs versions, validates them, and creates a matching tag.
- If a bad tag is pushed, cut a new semver release tag after version sync instead of retrying the same mismatched tag.
