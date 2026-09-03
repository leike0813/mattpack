## Purpose

Defines Mattpack's command-line inputs and stable human and machine-readable behavior for interactive users, scripts, and package smoke tests.

## ADDED Requirements

### Requirement: Command surface
Mattpack SHALL implement `init`, `inspect`, `list`, `update`, `doctor`, and `remove`, with omitted command and direct preset forms resolving to `init`.

#### Scenario: Direct preset form
- **WHEN** a user runs `mattpack default --harness codex`
- **THEN** it behaves as `mattpack init default --harness codex`

#### Scenario: Unknown syntax
- **WHEN** a command, preset, harness, option, or option combination is invalid
- **THEN** Mattpack returns a stable argument error and help guidance without mutation

### Requirement: Project-root resolution
Mattpack SHALL resolve the project root in order from explicit `--dir`, an ancestor containing Mattpack state, Git top-level, then current working directory.

#### Scenario: Explicit directory is supplied
- **WHEN** `--dir` names a valid project directory
- **THEN** that directory wins over state, Git, and current-directory discovery

### Requirement: Interactive and non-interactive behavior
Missing init or inspect choices SHALL be prompted only on a TTY; `--yes` may choose the `default` preset but SHALL NOT guess an absent harness.

#### Scenario: No-command interactive invocation
- **WHEN** `mattpack` runs in a TTY without enough input
- **THEN** it prompts for preset and harness rather than silently installing `default`

#### Scenario: Non-interactive ambiguity
- **WHEN** required input is missing outside a TTY
- **THEN** the command fails with `NON_INTERACTIVE_INPUT_REQUIRED`

### Requirement: Dry-run and JSON contracts
`inspect` and `--dry-run` SHALL never mutate. In `--json` mode stdout SHALL contain one valid JSON envelope and diagnostics SHALL use stderr.

#### Scenario: Successful JSON command
- **WHEN** a command succeeds with `--json`
- **THEN** stdout contains `{ok, command, projectRoot, result}` with deterministic structured data

#### Scenario: Failed JSON command
- **WHEN** a command fails with `--json`
- **THEN** stdout contains `{ok:false,error:{code,message,details}}` and no human prose

### Requirement: Process boundary
Core modules SHALL return structured values and typed domain errors; only the CLI entry point may print output or set process exit status.

#### Scenario: Core operation fails
- **WHEN** a catalog, state, planning, or filesystem boundary rejects input
- **THEN** the CLI maps its stable error code to the selected output format and a nonzero status
