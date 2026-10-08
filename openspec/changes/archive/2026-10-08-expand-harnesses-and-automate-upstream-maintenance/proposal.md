# Proposal

## Why

Mattpack's pinned reference misses verified project-local skill targets and contains outdated mappings. Matt skills maintenance currently depends on a manual audit; a scheduled, isolated draft-PR workflow can keep the bundled snapshot reviewed without changing offline consumer behavior.

## What Changes

- Add fourteen evidence-backed harnesses, including hosted Replit's versioned project skills and shared `.agents` / `.roo` consumers.
- **BREAKING**: Correct CoStrict and Kilo destinations, identify Roo Code separately from Zoo Code, and retire the unverified Amazon Q target. Preserve managed-file safety during migration and removal.
- Use reviewed official sources to supplement or correct the pinned OpenSpec reference; record applicability and evidence without changing the reference pin.
- Add development-only Matt skills observation, whole-run locking, structured reports, and a coordinator skill that reuses `upstream-bump`.
- Deliver updates to fixed observed main SHAs as reviewed draft PRs, including deletions and renames, while keeping curated presets explicit.
- Register a disabled daily Orca task at 02:00 Asia/Shanghai using the approved MiniMax coordinator and existing native agent roles.

## Capabilities

### New Capabilities

- `upstream-maintenance`: Isolated observation, reconciliation, validation, recovery, and draft-PR delivery of Matt skills updates.

### Modified Capabilities

- `harness-targeting`: Evidence-backed supported targets, corrected destinations, shared roots, and retired-target recovery.
- `packaging-release`: Keep maintenance tooling and state outside the offline published CLI.

## Impact

Changes touch the harness registry, existing contract/lifecycle tests, package smoke test, development scripts and their tests, project skill, generated documentation, agent guidance, and Orca registration. Consumer schemas and adapter interfaces remain unchanged. No dependency installation, npm release, auto-merge, incidental upstream/reference bump, or modification of the main workspace is included. The implementation is delivered from an independent worktree as a draft PR.
