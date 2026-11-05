# Release automation verification

Recorded November 5, 2026. Current public release: **0.12.3**. This work has not promoted a new release.

## Evidence

- [Build dry run 41720539817](https://github.com/filearchitect/app/actions/runs/41720539817) passed for Apple Silicon, Intel Mac, and Windows. Mac builds passed automated signing and notarization checks. This branch dry run did not stage website records or exercise production promotion.
- Website release API tests previously passed with the full suite: 72 tests, 326 assertions. Coverage includes authentication, repeated staging, invalid metadata, promotion and rollback. Production checks returned 401 without authorization and 422 for an authenticated invalid payload. Those checks did not activate a release.
- [Windows test build 41875776093](https://github.com/filearchitect/app/actions/runs/41875776093) passed at app commit `b4b218a`. On November 4, its standalone executable activated a disposable local-server key through the private Tailscale connection. Account showed Once / Never immediately and after restart. Server repeat validation returned 200 without another slot; the second machine returned 200 and the third returned 422. Database inspection confirmed exactly two registered test identities. Update checking showed the latest-version message on 0.12.3.
- [PR 20](https://github.com/filearchitect/app/pull/20) merged the isolated test identity and per-run store into main at `1a594ad`. Temporary Windows test executables, key file, shortcut, and transfer probe were moved to Recycle Bin after testing.
- On November 4, both production website APIs advertised active 0.12.3; GitHub v0.12.3 remained public with eight assets. The Mac record contained both architecture entries.

## Audit findings and limits

The promotion feed request needed to follow GitHub redirects. This was corrected during the November 5 audit. Five simulated orchestration tests cover successful promotion, preparation failure before publication, failure after activation followed by rollback, failed website rollback retaining public downloads, and explicit rollback. They exercise the real promotion script with simulated external commands; they do not verify remote service availability or cryptographic artifact validity.

The tag staging job depends on both builds and the Mac manifest job succeeding. Manual promotion checks for a successful push-triggered release workflow for the checked-out commit and verifies the draft assets before publication. A manual dispatch is the approval mechanism; no separate environment reviewer is configured.

The complete new draft → production promotion → production rollback cycle remains unexercised on a new release. Native launch on Intel hardware and an actual update from an installed 0.11.22 Mac client were not established by the evidence above. Keep those as explicit checks for the next approved release; compatibility of the existing GitHub feed URL alone is not an end-to-end update test.

The owner confirmed zero Setapp active installs and trials. Runtime/build support was removed in a dedicated change. Dashboard submission status and contractual obligations were not independently verified. The historical integration plan is marked retired.
