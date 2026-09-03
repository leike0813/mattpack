## Why

Mattpack currently has a complete v1 product contract but no implementation. This change turns that contract into a publishable, deterministic CLI that installs the pinned Matt Pocock skill snapshot safely into project-local agent harnesses.

## What Changes

- Add the strict TypeScript ESM package, `mattpack` executable, release metadata, and zero-runtime-dependency toolchain.
- Vendor and validate the exact upstream skill snapshot and pin the OpenSpec design reference as a development-only submodule.
- Add preset discovery, explicit dependency closure, all 13 project-local harness adapters, shared-target deduplication, and deterministic human/JSON inspection.
- Add ownership-aware planning and reconciliation for init, update, doctor, and remove, including drift preservation, force backups, staging, and rollback.
- Add generated documentation, cross-platform tests, CI, and an offline package smoke test.

## Capabilities

### New Capabilities

- `catalog-resolution`: Resolve pinned upstream skills, presets, aliases, and explicit dependencies deterministically.
- `harness-targeting`: Detect and target all supported project-local harness roots while deduplicating shared physical roots.
- `safe-reconciliation`: Plan and apply ownership-safe installs, updates, drift diagnosis, backups, and removals.
- `cli-contract`: Expose the complete interactive, human-readable, and JSON CLI surface.
- `packaging-release`: Produce and verify an offline-capable npm package with pinned third-party content and licensing.

### Modified Capabilities

None.

## Impact

This creates the entire application under `src/`, build and release scripts, tests, documentation, the pinned vendor tree, and one read-only reference submodule. Runtime behavior remains project-scoped and offline; only developer maintenance commands fetch pinned upstream sources.
