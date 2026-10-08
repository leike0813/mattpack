# Proposal

## Why

Mattpack has platform validation and published npm versions, but no automated publish workflow. The current version-bump command can push a tag before regenerating the versioned README, leaving the tagged source incomplete.

## What Changes

- Publish the public scoped package from a matching version tag only after the existing platform and Node.js compatibility gates pass.
- Use GitHub Actions OIDC and npm Trusted Publishing with provenance, without a persistent npm token.
- Provide a publish-free workflow rehearsal and documented npm-side setup.
- Prepare version and generated documentation together before maintainers commit and push the release tag.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `packaging-release`: verified tag-driven publishing, release preparation, and Trusted Publisher setup.

## Impact

GitHub workflows, package metadata and release scripts, release validation tests, generated README guidance, and development release documentation. No dependency, runtime, snapshot, or package-version bump is part of this change. The owner configures the npm Trusted Publisher; the first actual release remains a separate maintainer action.
