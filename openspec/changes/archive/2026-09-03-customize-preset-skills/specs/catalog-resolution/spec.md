## ADDED Requirements

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
