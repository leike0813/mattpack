# safe-reconciliation Specification

## Purpose

Defines the ownership evidence and transactional reconciliation needed to install, update, diagnose, and remove skills without damaging consumer-owned bytes.

## Requirements

### Requirement: Real deterministic plan
Mattpack SHALL classify additions, replacements, removals, unchanged files, conflicts, and divergences before mutation, and `inspect` and `--dry-run` SHALL use that same planner.

#### Scenario: Repeated installation
- **WHEN** intent, bundled snapshot, lock, sidecars, and managed bytes are unchanged
- **THEN** the plan contains no writes and installation is a true no-op

#### Scenario: Plan ordering
- **WHEN** the same filesystem state and intent are planned repeatedly
- **THEN** all externally visible collections and actions appear in the same order

### Requirement: Proven ownership
Mattpack SHALL recognize a managed skill only when its lock entry, installation ID sidecar, source identity, path, and prior file hashes agree.

#### Scenario: Unowned destination exists
- **WHEN** a desired skill directory exists without matching ownership evidence
- **THEN** Mattpack reports a conflict and performs no mutation unless forced

#### Scenario: Managed file changed locally
- **WHEN** a prior managed file no longer matches its lock hash
- **THEN** Mattpack reports a conflict and preserves the file unless forced

#### Scenario: Extra file exists in a managed directory
- **WHEN** a file is not listed in the prior lock
- **THEN** Mattpack preserves it as consumer-owned and reports divergence

### Requirement: Recoverable forced replacement
Mattpack SHALL copy every conflicting byte affected by `--force` into a unique path beneath `.mattpack/backups/` before replacement.

#### Scenario: Force resolves a conflict
- **WHEN** a conflicting install or update is executed with `--force`
- **THEN** the old bytes remain recoverable from the reported backup path and desired managed bytes are installed

### Requirement: Transactional application
Mattpack SHALL stage desired trees, revalidate planned preconditions, roll back failed swaps, and commit `lock.json` only after all intended target writes and `config.json` succeed.

#### Scenario: Apply fails partway
- **WHEN** a filesystem operation fails during application
- **THEN** Mattpack restores completed swaps where possible and never leaves a lock claiming incomplete output

### Requirement: Safe update, diagnosis, and removal
`update` SHALL reconcile stored intent against the running package snapshot, `doctor` SHALL report drift without repair, and `remove` SHALL delete only bytes still proven owned.

#### Scenario: Preset or harness contracts
- **WHEN** desired managed files or physical roots are removed from intent
- **THEN** matching owned bytes are removed while modified and unrelated bytes remain

#### Scenario: Doctor sees drift
- **WHEN** state, sidecars, managed files, or extra files diverge
- **THEN** doctor returns structured findings without changing the project