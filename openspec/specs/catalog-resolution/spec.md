# catalog-resolution Specification

## Purpose

Defines how Mattpack turns one pinned upstream repository snapshot and a named preset into a reproducible, explainable set of complete skill directories.

## Requirements

### Requirement: Pinned offline catalog
Mattpack SHALL load skills only from the snapshot bundled with the running package and SHALL validate that snapshot against `upstream.lock.json` before planning mutations.

#### Scenario: Normal resolution has no network dependency
- **WHEN** a user resolves any preset after installing the npm package
- **THEN** Mattpack reads the bundled snapshot without fetching GitHub

#### Scenario: Invalid snapshot is rejected
- **WHEN** the lock, source buckets, frontmatter, plugin manifest, paths, or skill identities are invalid
- **THEN** Mattpack returns a stable catalog error before writing consumer files

### Requirement: Canonical presets and aliases
Mattpack SHALL expose `default`, `general`, `full`, `beta-only`, and `everything` with the current pinned snapshot's roots, aliases, exclusions, and expected counts defined in `AGENTS.md`.

#### Scenario: Alias resolution is canonical
- **WHEN** a user selects `dev`, `developing`, `in-progress`, `beta`, or `experimental`
- **THEN** Mattpack records and reports the corresponding canonical preset

#### Scenario: Dynamic presets follow source buckets
- **WHEN** `full`, `beta-only`, or `everything` is resolved
- **THEN** roots are discovered from the allowed stable, in-progress, and misc buckets and deprecated or out-of-scope content is excluded

#### Scenario: Audited snapshot is selected
- **WHEN** the bundled upstream commit is `49dd158d1076134a641b33efb035946536778336` and dependencies are enabled
- **THEN** `default`, `general`, `full`, `beta-only`, and `everything` resolve to 15, 6, 27, 9, and 38 skills respectively
- **AND** `beta-only` distinguishes its seven beta roots from its two stable dependencies

#### Scenario: Promoted and new skills follow their buckets
- **WHEN** a user resolves the audited snapshot's dynamic presets
- **THEN** `full` includes `implement-spec`, `retro`, and `pr`, while `beta-only` includes `chief-of-staff` as a root and excludes the promoted skills from its roots
- **AND** `everything` includes all four skills

#### Scenario: Default retains its curated boundary
- **WHEN** a user resolves `default` against the audited snapshot
- **THEN** `resolving-merge-conflicts` is absent and the other existing default roots remain selected
- **AND** the new and promoted skills do not automatically become default roots

### Requirement: Explicit dependency closure
Mattpack SHALL resolve `requires` and `setupCompanions` recursively, deterministically, without duplicates, and with one deterministic reason chain for every added skill.

#### Scenario: Dependency closure succeeds
- **WHEN** all referenced skills exist and the graph is acyclic
- **THEN** Mattpack returns sorted roots, added dependencies, dependency types, reason chains, and the combined skill set

#### Scenario: Invalid dependency graph is rejected
- **WHEN** a dependency is missing or a cycle is reached
- **THEN** Mattpack reports a stable error with the failing node or cycle before writing files

#### Scenario: Dependencies are explicitly disabled
- **WHEN** the user supplies `--no-deps`
- **THEN** Mattpack resolves only preset roots, persists that intent, and emits a warning that the installation may be unusable

#### Scenario: Implement-spec is selected independently
- **WHEN** `implement-spec` is selected as a root with dependencies enabled
- **THEN** its closure includes `tdd`, `code-review`, `codebase-design`, and `setup-matt-pocock-skills`
- **AND** setup is reported as a setup companion and the other additions as required skills, with reason chains originating at `implement-spec`

### Requirement: Additional skill roots
Mattpack SHALL accept explicit skill roots in addition to the selected preset, preserve those roots as user intent, and resolve the deterministic union through the existing dependency graph.

#### Scenario: Skill is added to a preset
- **WHEN** a user selects a skill that is not resolved by the current preset
- **THEN** Mattpack treats it as a root and installs its transitive dependencies together with the preset result

#### Scenario: Explicit root overlaps preset resolution
- **WHEN** an explicitly selected skill is already a root or dependency of the current preset
- **THEN** Mattpack installs one copy while preserving the explicit selection for later preset changes

#### Scenario: Additional skill is unknown
- **WHEN** an additional root does not exist in the bundled catalog
- **THEN** Mattpack returns `UNKNOWN_SKILL` before planning any writes

#### Scenario: Dependencies are disabled
- **WHEN** additional roots are selected together with `--no-deps`
- **THEN** Mattpack installs only the combined explicit roots and emits the existing unusable-installation warning

### Requirement: Skill selection metadata
The bundled catalog SHALL expose every installable skill's name and non-empty upstream description, and SHALL derive each skill's relationship to every canonical preset as root, dependency, or not included.

#### Scenario: Preset relationship matrix is requested
- **WHEN** interactive setup prepares the skill catalog
- **THEN** every installable skill has one relationship for each canonical preset, computed from the preset roots and normal dependency closure

#### Scenario: Upstream description is invalid
- **WHEN** a bundled skill has missing or invalid description frontmatter
- **THEN** catalog validation fails before installation planning
