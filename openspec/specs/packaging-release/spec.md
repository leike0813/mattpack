# packaging-release Specification

## Purpose

Defines the reproducible package contents, licenses, maintenance commands, and release gates required for Mattpack to run through npx without runtime services.

## Requirements

### Requirement: npm package contract
Mattpack SHALL publish one ESM package named `mattpack` for Node.js 20 or newer with `dist/cli.js` as the `mattpack` binary and no runtime dependencies.

#### Scenario: Package is installed from a tarball
- **WHEN** the packed artifact is installed in a clean offline project
- **THEN** its binary can init, diagnose, reinstall idempotently, and remove a managed installation

### Requirement: Package contents
The npm artifact SHALL include compiled runtime code, package metadata, documentation, licenses, `upstream.lock.json`, and the pinned vendored snapshot, and SHALL exclude `references/OpenSpec` and development-only artifacts.

#### Scenario: Packed file list is inspected
- **WHEN** `pnpm test:pack` reads npm's packed-file manifest
- **THEN** required vendor files are present and the OpenSpec reference is absent

### Requirement: Third-party provenance
Mattpack SHALL record the exact upstream commit and MIT attribution and SHALL keep the OpenSpec reference pinned as a development-only submodule.

#### Scenario: Provenance is reviewed
- **WHEN** a maintainer inspects the lock, notices, vendor license, and submodule
- **THEN** both fixed commits and their distinct bundled/reference roles are explicit

### Requirement: Upstream maintenance validation
Developer scripts SHALL fetch only an explicitly locked commit, copy upstream files byte-for-byte without executing them, and validate paths, file types, frontmatter, source buckets, plugin membership, presets, and dependencies.

#### Scenario: Upstream snapshot is regenerated
- **WHEN** a maintainer intentionally changes the lock and runs the sync command
- **THEN** a validated staged snapshot replaces the vendor tree as one operation

### Requirement: Release gates
The repository SHALL expose `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:pack`, and `pnpm check`, with CI running the complete check on Linux, macOS, and Windows.

#### Scenario: Release validation succeeds
- **WHEN** all required commands and the platform matrix pass
- **THEN** the source, runtime behavior, package contents, and supported platform contract are ready for release