## MODIFIED Requirements

### Requirement: Safe update, diagnosis, and removal
`update` SHALL reconcile stored preset, additional skill, harness, and dependency intent against the running package snapshot, including upstream source moves, resource renames, and removed skills. `doctor` SHALL report drift without repair, and `remove` SHALL delete only bytes still proven owned. Invalid stored additional roots SHALL fail before consumer mutation.

#### Scenario: Preset or harness contracts
- **WHEN** desired managed files or physical roots are removed from intent
- **THEN** matching owned bytes are removed while modified and unrelated bytes remain

#### Scenario: Doctor sees drift
- **WHEN** state, sidecars, managed files, or extra files diverge
- **THEN** doctor returns structured findings without changing the project

#### Scenario: Managed skill moves between upstream buckets
- **WHEN** a managed skill keeps its name but moves from in-progress to engineering and its installed files still match the prior lock
- **THEN** update keeps the same consumer directory, refreshes its source identity and content, and leaves a healthy installation whose next update is a no-op
- **AND** extra consumer files are preserved

#### Scenario: Upstream resource is renamed
- **WHEN** an unchanged managed resource has a new name in the bundled snapshot
- **THEN** update installs the new resource and removes the unchanged old resource
- **AND** a local modification to the old resource causes a conflict before replacement

#### Scenario: Upstream removes a preset skill
- **WHEN** a previously managed preset skill is absent from the desired snapshot and roots
- **THEN** update removes only bytes matching the prior lock, preserves modified and extra files, and drops the obsolete managed entry from the new lock

#### Scenario: Stored explicit skill was removed upstream
- **WHEN** an additional root stored in config is absent from the bundled catalog
- **THEN** update returns `UNKNOWN_SKILL` before any consumer writes and preserves the stored selection for the user to resolve

#### Scenario: Consumer domain documents use the old convention
- **WHEN** update installs skills using `GLOSSARY.md` and `GLOSSARY-MAP.md` into a project with `CONTEXT.md` or `CONTEXT-MAP.md`
- **THEN** Mattpack preserves those consumer documents and leaves their migration to the user
