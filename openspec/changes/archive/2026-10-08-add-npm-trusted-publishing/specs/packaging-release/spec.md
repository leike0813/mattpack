# Spec Delta

## ADDED Requirements

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
