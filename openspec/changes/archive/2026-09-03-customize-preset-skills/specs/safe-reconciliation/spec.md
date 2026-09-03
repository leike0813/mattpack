## ADDED Requirements

### Requirement: Persisted additional skill intent
Mattpack SHALL store sorted, deduplicated additional skill roots in `config.json`, treat a missing field in schema version 1 state as an empty selection, and record the combined resolved roots in `lock.json` without duplicating the intent field.

#### Scenario: Existing state predates additional selections
- **WHEN** Mattpack reads a valid schema version 1 config without `additionalSkills`
- **THEN** it behaves as if the field were an empty list

#### Scenario: Additional selections are reapplied
- **WHEN** `update` or `doctor` evaluates an initialized project
- **THEN** it resolves the stored additional roots together with the stored preset and dependency setting

#### Scenario: Preset already includes an explicit root
- **WHEN** a stored additional root is also resolved by the stored preset
- **THEN** the config preserves that explicit intent while the lock and managed files contain no duplicate skill

## MODIFIED Requirements

### Requirement: Safe update, diagnosis, and removal
`update` SHALL reconcile stored preset, additional skill, harness, and dependency intent against the running package snapshot, `doctor` SHALL report drift without repair, and `remove` SHALL delete only bytes still proven owned.

#### Scenario: Preset or harness contracts
- **WHEN** desired managed files or physical roots are removed from intent
- **THEN** matching owned bytes are removed while modified and unrelated bytes remain

#### Scenario: Doctor sees drift
- **WHEN** state, sidecars, managed files, or extra files diverge
- **THEN** doctor returns structured findings without changing the project
