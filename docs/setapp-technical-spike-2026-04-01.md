# Setapp Technical Spike

Date: 2026-04-01
Branch: `codex/setapp-spike`

## Goal

Determine whether File Architect can support a Setapp-specific macOS build without reusing the current direct-sale licensing flow, and identify the smallest viable integration path for this Tauri app.

## Current App Constraints

The current macOS build has two direct conflicts with Setapp requirements:

- Custom licensing is handled by the frontend auth layer and your server in `src/features/auth/services.ts`.
- The macOS build enables Tauri's in-app updater in `src-tauri/tauri.conf.json`, `src-tauri/tauri.production.conf.json`, and `src/features/updater/useAutoUpdater.ts`.

Setapp's macOS integration docs require a separate `-setapp` bundle ID and say built-in licensing/update frameworks must be disabled for the Setapp version.

## What I Verified

### 1. Isolated spike branch

The spike was created in an isolated worktree on branch `codex/setapp-spike`.

### 2. Repo test baseline

After installing dependencies in the worktree, the existing app test suite passed:

- `6` test files passed
- `20` tests passed

Command used:

```bash
pnpm test -- --runInBand
```

### 3. Setapp framework packaging model

The public Setapp framework repo confirms that the modern integration surface is:

- `Setapp.xcframework`
- `SetappResources` bundle
- Swift package wrapper target
- Objective-C-compatible API exposed through `SetappManager` / `STPManager`

Relevant confirmed APIs from the shipped Swift interface:

- `SetappManager.shared.subscription`
- `SetappManager.shared.requestPurchaseType(...)`
- `SetappManager.shared.requestAuthorizationCode(...)`
- `SetappManager.shared.showReleaseNotesWindowIfNeeded()`
- `SetappManager.shared.reportUsageEvent(...)`
- `SetappManager.shared.askUserToShareEmail()`

This is important because it means Tauri does not need to integrate Setapp through your server. A thin macOS-native bridge is sufficient for the core subscription path.

### 4. Swift Package Manager feasibility

On this machine, Swift Package Manager can resolve and build the public Setapp framework package artifacts using Command Line Tools alone.

What completed successfully:

- `swift --version` works
- `swift build` in the public Setapp framework repo created `.build` outputs, copied `libSetapp.a`, and copied `SetappFramework-Resources.bundle`

This reduces risk for a native bridge approach.

### 5. Environment limitation

This machine does not currently have full Xcode selected:

```bash
xcodebuild -version
```

Result:

```text
xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance
```

Because of that, this spike does not fully prove end-to-end Tauri app bundling, signing, or Setapp runtime activation on this machine.

## Best Integration Shape For This Repo

### Build flavors

Create a separate Setapp macOS build flavor rather than trying to make one macOS binary behave differently at runtime.

Why:

- direct-sale licensing stays untouched
- Setapp compliance stays explicit
- updater behavior can diverge safely
- review risk is lower

### Entitlement model

Represent Setapp as a distinct local entitlement source in the app, not as a normal direct-sale license returned by your API.

Recommended behavior:

- full core app access
- no line limits
- no AI access
- no dependency on your licensing server
- no purchase / activation / renewal UI

### Native bridge

The most practical Tauri approach is:

1. Add a small macOS-only bridge in `src-tauri` that exposes Setapp status and helper actions through Tauri commands.
2. Keep the JS/frontend layer unaware of native Setapp details beyond a minimal app-facing interface.
3. Gate the bridge behind a Setapp build flag so the direct build never links Setapp.

This is conceptually the same pattern Setapp uses for Electron:

- native manager underneath
- JS-facing wrapper on top

### Updater strategy

Disable the current Tauri updater in the Setapp build.

The Setapp docs also require adding `NSUpdateSecurityPolicy` for macOS 13+ update permissions in the Setapp app bundle.

## Recommended Repo Changes

### Phase 1: Build split

- Add a Setapp-specific Tauri config, for example `src-tauri/tauri.setapp.conf.json`
- Change bundle identifier to `com.filearchitect.app-setapp`
- Disable Tauri updater plugin/config for that flavor
- Add Setapp-specific `Info.plist` extensions such as `NSUpdateSecurityPolicy`
- Add a Setapp build script, for example `scripts/build_setapp_macos.sh`

### Phase 2: App licensing abstraction

- Expand auth types to support entitlement source information
- Add a Setapp-specific auth provider path that bypasses your server
- Keep direct-sale logic in place for existing production builds

### Phase 3: Native bridge

Add macOS-only commands for:

- reading current Setapp subscription state
- reading purchase type
- showing release notes
- optional auth code request
- optional usage events if manual reporting is needed later

### Phase 4: UI gating

Hide for Setapp builds:

- license activation form
- purchase links
- manage-license links
- expired trial modal / renewal messaging

### Phase 5: Verification

Verify:

- direct build still uses current licensing and updater
- Setapp build bypasses your server for licensing
- Setapp build grants full non-AI access
- Setapp build exposes no purchase / activation UI
- both apps can coexist because of the distinct bundle ID

## Likely Files To Change

- `src/features/auth/types.ts`
- `src/features/auth/services.ts`
- `src/features/auth/AuthProvider.tsx`
- `src/pages/preferences/AccountPreferences.tsx`
- `src/features/updater/useAutoUpdater.ts`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.production.conf.json`
- `src-tauri/build.rs`
- `src-tauri/src/main.rs`
- `src-tauri/entitlements.plist`
- `scripts/build_macos.sh`
- new Setapp-specific bridge files under `src-tauri`

## Open Questions

These are not blockers for starting implementation, but they affect polish:

- whether to use the Setapp library downloaded from your developer portal versus the public framework package in the repo
- whether usage reporting beyond default launch/activate events is needed for this app class
- whether to support Setapp release notes immediately or defer
- whether to add local settings migration from the direct app

## Recommendation

This spike is sufficient to proceed to implementation planning.

The highest-confidence path is:

1. separate Setapp macOS build flavor
2. native `src-tauri` bridge to SetappManager
3. frontend entitlement abstraction
4. Setapp-specific UI and updater removal

The next step should be a file-by-file implementation plan, followed by incremental work starting with the build split and entitlement abstraction.
