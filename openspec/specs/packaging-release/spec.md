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
The npm artifact SHALL include compiled runtime code, package metadata, documentation, licenses, upstream.lock.json, and the pinned vendored snapshot, and SHALL exclude references/OpenSpec, maintenance scripts, coordinator skills, local automation configuration, reports, and other development-only artifacts.

#### Scenario: Packed file list is inspected
- **WHEN** pnpm test:pack reads npm's packed-file manifest
- **THEN** required vendor files are present and development maintenance artifacts and the OpenSpec reference are absent

### Requirement: Offline expanded harness smoke test
The packed CLI SHALL install new independent and shared-root harnesses with no network access and preserve healthy diagnosis, idempotent reinstall, and ownership-safe removal.

#### Scenario: New and shared targets are selected
- **WHEN** the packed CLI installs general for codex, minimax-code, and warp in a clean offline project
- **THEN** it creates two physical skill roots, records all three consumers, diagnoses healthy, reinstalls without changes, and removes proven owned bytes

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

### Requirement: Verified tag publishing
The release workflow SHALL publish `@leike0813/mattpack` publicly only for a stable `vX.Y.Z` tag matching the package version on a commit included in main, after the complete platform and supported-runtime checks pass. A manual run SHALL validate and rehearse packaging without publishing.

#### Scenario: Matching release tag
- **WHEN** a maintainer pushes an unpublished stable version tag matching the package on main
- **THEN** all release gates run before the npm publication

#### Scenario: Invalid release identity
- **WHEN** the tag differs from the package version, is a prerelease, or points outside main
- **THEN** publication stops before contacting npm to publish

#### Scenario: Manual rehearsal
- **WHEN** a maintainer manually runs the publishing workflow
- **THEN** validation and npm dry-run complete without publishing any version

### Requirement: Trusted npm authentication
The release workflow SHALL use GitHub-hosted OIDC trusted publishing and produce npm provenance for the public package, with repository metadata matching the GitHub source. The setup instructions SHALL identify the exact trusted repository and workflow filename without requiring a stored npm publishing token.

#### Scenario: Trusted Publisher configured
- **WHEN** npm trusts the specified GitHub repository and publishing workflow
- **THEN** a matching release authenticates through a short-lived OIDC identity and publishes provenance

#### Scenario: Trust is absent
- **WHEN** npm has not been configured to trust the publishing workflow
- **THEN** publication fails without falling back to a stored npm token

### Requirement: Release preparation precedes publication
The version preparation command SHALL update the package version, regenerate both README files, and run release checks before returning control to the maintainer. It SHALL leave those changes available for review without automatically committing, tagging, pushing, or publishing.

#### Scenario: Prepare next version
- **WHEN** a maintainer prepares a new stable version
- **THEN** package metadata and generated documentation agree and are checked before a release commit or tag is created