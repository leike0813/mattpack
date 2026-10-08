## MODIFIED Requirements

### Requirement: Canonical presets and aliases
Mattpack SHALL expose `default`, `general`, `full`, `beta-only`, and `everything` with the current pinned snapshot's roots, aliases, exclusions, and expected counts defined in `AGENTS.md`.

#### Scenario: Alias resolution is canonical
- **WHEN** a user selects `dev`, `developing`, `in-progress`, `beta`, or `experimental`
- **THEN** Mattpack records and reports the corresponding canonical preset

#### Scenario: Dynamic presets follow source buckets
- **WHEN** `full`, `beta-only`, or `everything` is resolved
- **THEN** roots are discovered from the allowed stable, in-progress, and misc buckets and deprecated or out-of-scope content is excluded

#### Scenario: Audited snapshot is selected
- **WHEN** the bundled upstream commit is `b0618bc436ad893b3c5e84e55fba86586d34a404` and dependencies are enabled
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
