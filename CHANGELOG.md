# Changelog

## Unreleased

- No unreleased changes yet.

## 0.11.21

### Changed

- Removed internal GitHub roadmap and issue-triage scaffolding from the repository to keep project docs focused on the app itself.

## 0.11.20

### Changed

- Hardened structure editor indentation rules so the first line cannot start indented, lines cannot jump more than one level deeper than the previous non-empty line, and empty lines below files cannot be indented.
- Normalized leading spaces in indentation to tabs while keeping trailing spaces editable and trimming them only when creating the structure.
- Added clearer editor feedback for blocked indentation and automatic indentation cleanup.
- Enabled `Tab` and `Shift+Tab` to indent or outdent all selected lines together when a multi-line selection is active.

## 0.11.19

### Added

- Added Emmet-like repeater syntax support in structure input (for example `filename_$*5.psd`).
- Added nested repeater block expansion, so children are repeated under each generated parent (for example `0_$*3` with `test` creates `0_1/test`, `0_2/test`, `0_3/test`).

### Changed

- Updated `@filearchitect/core` to `0.0.22` to consume repeater parsing at core level.

## 0.11.18

### Fixed

- Allowed empty replacement values during structure creation so deletion-style rename rules are applied (for example `test` -> ``).
- Aligned replacement persistence/serialization logic so saved structures keep empty replacement targets.
- Kept replacement handling consistent between preview and actual create execution.

## 0.11.17

### Changed

- Switched functional blank file downloads to `raw.githubusercontent.com` and aligned Tauri HTTP capabilities accordingly.
- Removed create-time preflight checks to speed up structure creation when clicking Create.
- Reduced verbose functional blank console logging to keep runtime output focused on errors.

### Fixed

- Corrected functional blank URL resolution for relative paths from `files.json` (ensures `files/` prefix is applied).
- Improved reliability for binary template creation (for example `.docx`, `.xlsx`, `.pptx`) by avoiding CDN responses that returned blocked/invalid payloads.

## 0.11.10

### Changed

- Improved release CI reliability for TruffleHog git scans by switching to a file URI path.

## 0.11.9

### Changed

- Improved release publishing reliability by setting the repository explicitly and fixing TruffleHog history scan paths in CI.

## 0.11.8

### Added

- Added a restart action to the post-install update toast.

### Changed

- Removed the obsolete "structure click behavior" preference setting.
- Improved release workflow ordering so GitHub releases are published only after artifacts are available.

## 0.11.7

- Release housekeeping updates.

## 0.11.6

### Changed

- Updated README content and product screenshots.

## 0.11.5

### Added

- Added updater option to skip a specific version from recurring prompts.
- Added a "Copy report" action in the structure creation failure dialog for faster support/debug sharing.

### Changed

- Updated expired-trial modal copy and styling for a cleaner layout and consistent primary action button color.
- Improved updater feedback by surfacing technical error details in the update dialog.
- Improved structure creation flow with non-blocking preflight conflict warnings and a detailed partial-failure report.
- Improved structure creation failure dialog readability with truncated path rows and expandable error details.
- License activation now refreshes account state in-place (no full app reload), including closing activation dialogs on success.

### Fixed

- Removed hard page reload behavior after license activation to avoid stale-state and UX loop issues.

## 0.11.4

### Fixed

- Hardened license and purchase links with an app URL fallback.

## 0.11.3

### Changed

- Synced app version from the release tag before building release artifacts.

## 0.11.2

### Fixed

- Let Tauri resolve the macOS target automatically in updater flow.
- Corrected updater URL generation based on uploaded release asset names.

## 0.11.1

### Fixed

- Stripped reasoning text from AI output and enforced structure-only output.

### Changed

- Updated release CI to pass the DeepInfra key into release builds.

## 0.11.0

### Changed

- Prepared `0.11.0` and hardened release "latest" behavior.

## 0.9.1

### Improved

- Template editor UI

## 0.9.0

### Added

- Button to copy the content of a path to the editor

### Fixed

- `⌘`+`,` now opens preferences
- Bug with blank files not being loaded correctly

### Changed

- Updated blank files to latest version

## 0.8.0

### Changed

- New template editor UI

## 0.7.0

### Added

- Improved the handling of templates with a new dialog that offers multiple options.

### Fixed

- Tooltip from editor now showing properly on small screens
- Template editor now scrolls on small screens
- Added drag region to top of window

## 0.6.1

### Fixed

- Template editor bug
- File name replacement bug in structure copy

## 0.6.0

### Added

- Template destination path saving and loading
- Improved template UI design

### Changed

- Code refactoring for better maintainability
- Performance optimizations

## 0.5.2

### Added

- Help tooltip now available in the editor

## 0.5.1

### Fixed

- Bug with license validation

## 0.5.0

### Added

- Folder names can have dots by escaping them with a backslash `Folder\.01`
- `⌘`+`,` now opens preferences

### Fixed

- Fixed editor disable bug
- Fixed drag and drop functionality issues

### Changed

- Moved AI functionality outside of the structure creator for better architecture
- Improved drag and drop code organization and reliability
- General code cleanup and improvements for better maintainability
- Removed duplicate code to open-source codebase
- Updated Preview Toggle Button component

### Updated

- Updated Tauri dependencies to latest versions

## 0.4.1

### Added

- Added deeplink functionality for better integration

### Fixed

- Fixed updater bug affecting the application update process
- Fixed AI generation bug improving AI-powered features

### Changed

- Enhanced tab functionality and user experience
- Removed autocomplete, autoComplete, autoCapitalize and spellcheck from text fields

### Updated

- Updated npm dependencies

## 0.3.3

- Fixed issue with blank file bundles like .logicx. They should work seemlessly now.
- Removed autocorrect, autoComplete, autoCapitalize and spellcheck in the main text editor and in replacement fields.
- Fixed issue with name replacements removals

## 0.1.14

### Added

- Added a help section with links to the documentation, GitHub repository, and support

## 0.1.13

### Added

- Added visual indications that files will be copied or imported

### Changed

- Changed license validation method
- Changed syntax for copying and moving files

## 0.1.0

- Initial release
