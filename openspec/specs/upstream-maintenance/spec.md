# upstream-maintenance Specification

## Purpose

Defines development-only Matt skills observation and maintenance in isolated worktrees, with recoverable ownership, evidence-backed updates, and draft pull requests.

## Requirements

### Requirement: Isolated whole-run ownership
Maintenance SHALL run only in a clean dedicated linked worktree for the configured repository and hold an exclusive repository-wide run lock until matching completion. Live owners and malformed lock metadata SHALL block new runs.

#### Scenario: Concurrent start
- **WHEN** another owner holds a valid run lock
- **THEN** start fails before switching branches or observing upstream

#### Scenario: Invalid workspace
- **WHEN** start is called from the main worktree or a dirty linked worktree
- **THEN** it fails without modifying tracked files

#### Scenario: Explicit recovery
- **WHEN** recover receives a matching run ID and can prove that its owner is dead
- **THEN** it releases only that run's lock and owned temporary checkout while preserving repository changes and reports

### Requirement: Fixed single observation
Each run SHALL resolve upstream main once to a full SHA and produce structured evidence comparing it with the bundled pin, without changing the lock or vendor. All maintenance in that run SHALL use the observed SHA.

#### Scenario: No update
- **WHEN** upstream main equals the bundled pin
- **THEN** the run reports noop without a commit, push, or PR

#### Scenario: Remote moves during review
- **WHEN** upstream main advances after observation
- **THEN** the run continues against its recorded SHA and leaves the later commit to another run

### Requirement: Reviewed snapshot reconciliation
Maintenance SHALL review the complete upstream diff, preserve upstream bytes, and reconcile catalog, dependencies, tests, generated documentation, release notes, and attribution. New skills SHALL NOT automatically expand curated default/general roots.

#### Scenario: Removed or renamed skill
- **WHEN** the fixed target removes or renames a selected root
- **THEN** maintenance records its evidence and updates the affected curated selection and regression coverage in the draft

#### Scenario: Unsafe or unresolved target
- **WHEN** source safety, license compatibility, or dependency semantics cannot be established
- **THEN** the run reports blocked without publishing an unverified update

### Requirement: Draft PR delivery
Maintenance SHALL deliver only reviewed changes that pass the complete package checks, using normal commits and pushes to its isolated branch. It SHALL reuse an open draft PR for that branch, create a new branch after closure or merge, and never auto-merge or publish an npm release.

#### Scenario: Validation failure
- **WHEN** any required validation or independent review fails
- **THEN** the run retains diagnostic state and does not publish successful delivery

#### Scenario: Existing draft
- **WHEN** an open maintenance draft exists
- **THEN** the next successful update adds a normal commit and updates that draft without force-pushing

### Requirement: Stable completion and scheduled configuration
The lifecycle SHALL expose machine-readable handoff, status, and completion reports with outcomes noop, draft_pr, blocked, or failed. The Orca task SHALL use the approved coordinator and existing role models, fresh sessions, daily 02:00 Asia/Shanghai, and disabled initial state.

#### Scenario: Successful finish
- **WHEN** finish receives a valid report for its matching run
- **THEN** it atomically stores the report and releases only that run's ownership

#### Scenario: First real acceptance
- **WHEN** the feature commit is used as the initial test baseline
- **THEN** a real Orca run completes and the final task configuration returns to origin/main while remaining disabled