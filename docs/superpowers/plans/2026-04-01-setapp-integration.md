# Setapp Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate macOS Setapp build flavor that bypasses the current licensing server, grants full non-AI access, removes direct-sale license UI, and disables the current macOS updater while keeping the standalone build unchanged.

**Architecture:** Split the macOS distribution into two flavors: direct-sale and Setapp. Keep the direct-sale path on the existing auth and updater system, and add a Setapp-specific entitlement path backed by a small macOS-only native bridge in `src-tauri`. Centralize feature gating in the auth layer so UI components consume one normalized entitlement model regardless of source.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vitest, macOS native bridge, Setapp framework

---

## File Map

### Existing files to modify

- `src/features/auth/types.ts`
  Responsibility: expand license/auth model to support Setapp as a first-class entitlement source.
- `src/features/auth/services.ts`
  Responsibility: split direct-sale licensing from Setapp entitlement resolution and centralize normalized license conversion.
- `src/features/auth/AuthProvider.tsx`
  Responsibility: expose unified app entitlement state to the React tree.
- `src/pages/preferences/AccountPreferences.tsx`
  Responsibility: hide direct-sale purchase and activation UI for Setapp builds.
- `src/features/updater/useAutoUpdater.ts`
  Responsibility: disable current macOS updater path for Setapp builds.
- `src-tauri/src/main.rs`
  Responsibility: register new Tauri commands and Setapp bridge setup.
- `src-tauri/build.rs`
  Responsibility: pass Setapp build-time values into the macOS bundle and native build.
- `src-tauri/tauri.production.conf.json`
  Responsibility: keep direct-sale production config unchanged or minimally adjusted if shared fields move.
- `src-tauri/tauri.conf.json`
  Responsibility: keep common defaults only; move flavor-specific behavior out where needed.
- `src-tauri/entitlements.plist`
  Responsibility: confirm compatibility with Setapp packaging and any new macOS requirements.
- `scripts/build_macos.sh`
  Responsibility: keep direct-sale build path explicit and separate from Setapp.
- `README.md`
  Responsibility: document flavor-specific build behavior for maintainers.

### New files to create

- `src/features/auth/setapp.ts`
  Responsibility: frontend-facing Setapp entitlement helpers and feature-gating helpers.
- `src/features/auth/__tests__/setappLicenseFlow.test.tsx`
  Responsibility: verify Setapp entitlement behavior in the React/auth layer.
- `src/features/updater/__tests__/useAutoUpdater.setapp.test.ts`
  Responsibility: verify updater logic is disabled or no-op in Setapp mode.
- `src-tauri/src/setapp.rs`
  Responsibility: Rust-side Tauri command layer for Setapp APIs and fallback behavior.
- `src-tauri/src/setapp_bridge.swift` or `src-tauri/src/setapp_bridge.mm`
  Responsibility: macOS-native bridge to `SetappManager` APIs.
- `src-tauri/tauri.setapp.conf.json`
  Responsibility: Setapp-specific bundle ID, updater removal, and plist extensions.
- `scripts/build_setapp_macos.sh`
  Responsibility: build the Setapp macOS app flavor separately from the direct-sale build.
- `src-tauri/resources/setappPublicKey.pem`
  Responsibility: Setapp public key resource included only in Setapp builds.

## Task 1: Define the unified entitlement model

**Files:**
- Modify: `src/features/auth/types.ts`
- Create: `src/features/auth/setapp.ts`
- Test: `src/features/auth/__tests__/setappLicenseFlow.test.tsx`

- [ ] **Step 1: Write the failing auth model tests**

Add tests that define the expected Setapp behavior:

- Setapp entitlement source is distinct from direct-sale licenses
- Setapp grants full core access
- Setapp disables AI access
- Setapp is treated as non-expiring for core access checks
- Setapp does not require a license key

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm vitest run src/features/auth/__tests__/setappLicenseFlow.test.tsx
```

Expected:

- FAIL because Setapp-specific types/helpers do not exist yet

- [ ] **Step 3: Add the minimal shared entitlement model**

Implement:

- `source: "direct" | "trial" | "setapp"`
- normalized feature flags such as `hasCoreAccess`, `hasAiAccess`, `canManageLicense`
- helper constructors for Setapp entitlement shape

Keep direct-sale behavior unchanged unless tests require otherwise.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:

```bash
pnpm vitest run src/features/auth/__tests__/setappLicenseFlow.test.tsx
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/types.ts src/features/auth/setapp.ts src/features/auth/__tests__/setappLicenseFlow.test.tsx
git commit -m "feat: add unified entitlement model for setapp"
```

## Task 2: Split auth resolution between direct-sale and Setapp

**Files:**
- Modify: `src/features/auth/services.ts`
- Modify: `src/features/auth/AuthProvider.tsx`
- Test: `src/features/auth/__tests__/setappLicenseFlow.test.tsx`
- Test: existing auth tests in `src/features/auth/__tests__/AuthProvider.test.tsx`

- [ ] **Step 1: Write the failing service/provider tests**

Add tests that assert:

- Setapp builds bypass `/machines` and `/licenses/validation`
- Auth provider can initialize from Setapp entitlement source
- Existing direct-sale flows still work

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
pnpm vitest run src/features/auth/__tests__/setappLicenseFlow.test.tsx src/features/auth/__tests__/AuthProvider.test.tsx
```

Expected:

- FAIL because auth resolution is still direct-sale only

- [ ] **Step 3: Implement flavor-aware auth resolution**

Implement minimal changes:

- Add a build/runtime flag for Setapp flavor
- In Setapp flavor, resolve entitlement from the Setapp bridge, not your API
- In direct-sale flavor, preserve existing server-backed behavior
- Normalize both flows into the same auth context shape

- [ ] **Step 4: Run the auth tests to verify they pass**

Run:

```bash
pnpm vitest run src/features/auth/__tests__/setappLicenseFlow.test.tsx src/features/auth/__tests__/AuthProvider.test.tsx
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/services.ts src/features/auth/AuthProvider.tsx src/features/auth/__tests__/setappLicenseFlow.test.tsx src/features/auth/__tests__/AuthProvider.test.tsx
git commit -m "feat: support setapp entitlement resolution"
```

## Task 3: Add the macOS Setapp native bridge

**Files:**
- Create: `src-tauri/src/setapp.rs`
- Create: `src-tauri/src/setapp_bridge.swift` or `src-tauri/src/setapp_bridge.mm`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/build.rs`

- [ ] **Step 1: Write the failing bridge contract test or compile contract**

Because this bridge is native/macOS-only, use a compile-oriented contract:

- Define Rust command signatures for:
  - `get_setapp_status`
  - `get_setapp_purchase_type`
  - `show_setapp_release_notes`
- Add minimal Rust unit tests where practical for command response shaping

- [ ] **Step 2: Run the targeted Rust checks to verify failure**

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected:

- FAIL because the Setapp bridge module and symbols do not exist yet

- [ ] **Step 3: Implement the minimal bridge**

Implement:

- macOS-only bridge wrapping `SetappManager`
- fallback stubs for non-Setapp or non-macOS builds
- Tauri commands returning normalized values to TypeScript
- build-time gating so the direct-sale build does not require Setapp linkage

Avoid auth-code and usage-reporting complexity beyond what is needed for launch entitlement unless required by build integration.

- [ ] **Step 4: Run Rust checks to verify the bridge compiles**

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected:

- PASS on the current toolchain, or a clear Xcode-only blocker if full app bundling is required

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/setapp.rs src-tauri/src/setapp_bridge.swift src-tauri/src/main.rs src-tauri/build.rs
git commit -m "feat: add macos setapp bridge"
```

If Objective-C++ is a better fit than Swift in practice, substitute `src-tauri/src/setapp_bridge.mm` in the commit.

## Task 4: Add a separate Setapp macOS build flavor

**Files:**
- Create: `src-tauri/tauri.setapp.conf.json`
- Create: `scripts/build_setapp_macos.sh`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/tauri.production.conf.json`
- Modify: `scripts/build_macos.sh`
- Create: `src-tauri/resources/setappPublicKey.pem`

- [ ] **Step 1: Write the failing build config checks**

Define expected Setapp build properties:

- bundle ID `com.filearchitect.app-setapp`
- no Tauri updater config
- `NSUpdateSecurityPolicy` included
- Setapp public key included as resource

- [ ] **Step 2: Run the targeted config validation to verify it fails**

Run:

```bash
jq '.identifier, .plugins.updater' src-tauri/tauri.setapp.conf.json
```

Expected:

- FAIL because the Setapp config does not exist yet

- [ ] **Step 3: Implement the Setapp flavor build path**

Add:

- standalone Setapp config file
- Setapp-specific build script
- clean separation from direct-sale macOS script
- explicit resource handling for the public key

Do not mutate the existing direct-sale build path into a mixed multi-mode script if that makes maintenance harder.

- [ ] **Step 4: Run the config validation to verify it passes**

Run:

```bash
jq '.identifier, .plugins.updater, .bundle.macOS' src-tauri/tauri.setapp.conf.json
```

Expected:

- Setapp bundle ID present
- updater absent or disabled for Setapp
- macOS plist extensions visible

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.setapp.conf.json scripts/build_setapp_macos.sh src-tauri/tauri.conf.json src-tauri/tauri.production.conf.json scripts/build_macos.sh src-tauri/resources/setappPublicKey.pem
git commit -m "build: add setapp macos flavor"
```

## Task 5: Remove direct-sale license UI from Setapp builds

**Files:**
- Modify: `src/pages/preferences/AccountPreferences.tsx`
- Possibly modify: `src/features/auth/components/LicenseActivationForm.tsx`
- Possibly modify: `src/features/auth/components/LicenseInfoSection.tsx`
- Test: `src/features/auth/__tests__/setappLicenseFlow.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

Add tests asserting that in Setapp mode:

- no activation form is shown
- no purchase/manage license CTA is shown
- no renewal/upgrade language is shown
- Setapp-friendly account messaging is shown if any account section remains

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run:

```bash
pnpm vitest run src/features/auth/__tests__/setappLicenseFlow.test.tsx
```

Expected:

- FAIL because direct-sale UI is still rendered

- [ ] **Step 3: Implement minimal UI gating**

Implement:

- Setapp-aware conditional rendering in account/preferences screens
- removal of direct-sale activation and purchase paths in Setapp flavor

Avoid large UI refactors. Keep the change narrowly scoped.

- [ ] **Step 4: Run the targeted UI test to verify it passes**

Run:

```bash
pnpm vitest run src/features/auth/__tests__/setappLicenseFlow.test.tsx
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/preferences/AccountPreferences.tsx src/features/auth/components/LicenseActivationForm.tsx src/features/auth/components/LicenseInfoSection.tsx src/features/auth/__tests__/setappLicenseFlow.test.tsx
git commit -m "feat: remove direct-sale licensing ui for setapp"
```

Only include component files that were actually changed.

## Task 6: Disable current updater behavior in Setapp builds

**Files:**
- Modify: `src/features/updater/useAutoUpdater.ts`
- Create: `src/features/updater/__tests__/useAutoUpdater.setapp.test.ts`

- [ ] **Step 1: Write the failing updater tests**

Add tests that assert:

- Setapp build does not attempt current GitHub/Tauri updater flow on macOS
- direct-sale build behavior remains unchanged

- [ ] **Step 2: Run the targeted updater tests to verify they fail**

Run:

```bash
pnpm vitest run src/features/updater/__tests__/useAutoUpdater.setapp.test.ts
```

Expected:

- FAIL because updater logic is still shared

- [ ] **Step 3: Implement the minimal updater split**

Implement:

- early Setapp flavor exit in updater flow
- optional Setapp-native release notes hook if desired

Do not remove updater behavior for direct-sale macOS.

- [ ] **Step 4: Run updater tests to verify they pass**

Run:

```bash
pnpm vitest run src/features/updater/__tests__/useAutoUpdater.setapp.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/updater/useAutoUpdater.ts src/features/updater/__tests__/useAutoUpdater.setapp.test.ts
git commit -m "feat: disable direct updater path for setapp builds"
```

## Task 7: End-to-end verification and maintainer docs

**Files:**
- Modify: `README.md`
- Possibly modify: `docs/setapp-technical-spike-2026-04-01.md`

- [ ] **Step 1: Add maintainer documentation**

Document:

- how to build direct-sale macOS
- how to build Setapp macOS
- where Setapp public key lives
- what behavior differs between flavors

- [ ] **Step 2: Run the full project verification**

Run:

```bash
pnpm test -- --runInBand
cargo check --manifest-path src-tauri/Cargo.toml
```

If available on a machine with full Xcode selected, also run:

```bash
pnpm tauri build --config src-tauri/tauri.setapp.conf.json
```

Expected:

- JS tests pass
- Rust checks pass
- Setapp app build either passes or produces a narrow packaging issue to fix

- [ ] **Step 3: Verify no licensing API calls are made by Setapp mode**

Use targeted tests or runtime inspection to confirm Setapp auth path does not call:

- `/machines`
- `/licenses/validation`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/setapp-technical-spike-2026-04-01.md
git commit -m "docs: document setapp build and verification"
```

## Final Acceptance Checklist

- [ ] Direct-sale macOS build still uses current licensing and updater
- [ ] Setapp build uses `com.filearchitect.app-setapp`
- [ ] Setapp build links to Setapp framework through a macOS-native bridge
- [ ] Setapp build bypasses your licensing server for core entitlement
- [ ] Setapp build grants full non-AI access
- [ ] Setapp build does not expose purchase, activation, or renewal UI
- [ ] Setapp build does not use the current Tauri updater flow
- [ ] Documentation explains the difference between direct-sale and Setapp builds

## Notes

- The spike already showed a local environment limitation: `xcodebuild` is unavailable with the current `xcode-select` target. That is not a blocker for writing code, but full macOS bundle validation should be done on a machine with full Xcode selected.
- The Setapp framework source suggests a Swift package plus native bridge is viable. If direct Tauri integration prefers Objective-C++, switch the bridge file type without changing the surrounding plan.
- The subagent review loop from the skill is intentionally not executed here because this session was not authorized for delegation. The plan is still saved and ready for implementation.
