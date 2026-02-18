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
