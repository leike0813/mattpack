# Spec Delta

## MODIFIED Requirements

### Requirement: Supported project-local harnesses
Mattpack SHALL support reviewed native project-local skill targets from official documentation or source, using the pinned OpenSpec reference as a baseline. Newer verified evidence SHALL take precedence over outdated reference mappings. Global-only and unverified targets SHALL remain unsupported.

#### Scenario: Explicit harness selection
- **WHEN** one or more harness IDs are supplied through `--tools`
- **THEN** Mattpack treats that selection as authoritative and targets only their project-local skill roots

#### Scenario: Select every harness
- **WHEN** `--tools all` is supplied
- **THEN** all 51 supported logical harnesses resolve to 43 physical project-local targets

#### Scenario: A newer source establishes a local target
- **WHEN** official MiniMax Code source establishes workspace `.minimax/skills`
- **THEN** Mattpack supports `minimax-code` despite the pinned reference's global-only mapping

#### Scenario: OpenSpec tool has only a global target
- **WHEN** a reference tool has only a home-directory target and no newer reviewed source establishes a project-local skill target
- **THEN** Mattpack excludes it from the project-local harness registry

#### Scenario: A hosted harness versions project skills
- **WHEN** Replit Agent is explicitly selected
- **THEN** Mattpack writes project-relative `.agents/skills` without accessing Replit or global workspace configuration

#### Scenario: An unsupported target is requested
- **WHEN** `amazon-q` is supplied
- **THEN** Mattpack returns `UNKNOWN_TOOL` before mutation

### Requirement: Shared physical target deduplication
Mattpack SHALL preserve distinct logical consumers of each shared physical skill root, including the eight `.agents/skills` consumers and the Roo Code and Zoo Code `.roo/skills` consumers.

#### Scenario: Shared consumers are selected together
- **WHEN** two or more shared-root harnesses are selected
- **THEN** Mattpack writes one skill tree and records every logical consumer in deterministic order

## ADDED Requirements

### Requirement: Corrected target migration
Mattpack SHALL reconcile CoStrict from `.cospec/skills` to `.costrict/skills` and Kilo from `.kilocode/skills` to `.kilo/skills` through normal ownership planning without changing stored harness IDs.

#### Scenario: A prior target contains user bytes
- **WHEN** update migrates a previous target containing modified managed files or extra files
- **THEN** unchanged owned bytes are removed from the old target, user bytes are retained, and divergence is reported

#### Scenario: New target is unowned
- **WHEN** the corrected target already contains an unowned skill
- **THEN** the normal conflict blocks mutation unless the user explicitly requests force with backup

### Requirement: Retired target recovery
Mattpack SHALL reject retired IDs in update and doctor before mutation while allowing removal using previously validated ownership state.

#### Scenario: Stored Amazon Q selection
- **WHEN** a project config contains `amazon-q` and update or doctor runs
- **THEN** it returns `UNKNOWN_TOOL` without altering project state

#### Scenario: Remove an old Amazon Q installation
- **WHEN** remove runs against an old Amazon Q lock
- **THEN** it removes only unchanged proven owned files and preserves modified and extra files
