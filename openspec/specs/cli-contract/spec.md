# cli-contract Specification

## Purpose

Defines Mattpack's command-line inputs and stable human and machine-readable behavior for interactive users, scripts, and package smoke tests.

## Requirements

### Requirement: Command surface
Mattpack SHALL implement `init`, `inspect`, `list`, `update`, `doctor`, and `remove`, with omitted command and direct preset forms resolving to `init`.

#### Scenario: Direct preset form
- **WHEN** a user runs `mattpack default --tools codex`
- **THEN** it behaves as `mattpack init default --tools codex`

#### Scenario: Unknown syntax
- **WHEN** a command, preset, tool, option, or option combination is invalid
- **THEN** Mattpack returns a stable argument error and help guidance without mutation

### Requirement: Project-root resolution
Mattpack SHALL resolve the project root in order from explicit `--dir`, an ancestor containing Mattpack state, Git top-level, then current working directory.

#### Scenario: Explicit directory is supplied
- **WHEN** `--dir` names a valid project directory
- **THEN** that directory wins over state, Git, and current-directory discovery

### Requirement: Interactive and non-interactive behavior
Missing init or inspect tool choices SHALL be prompted only on a TTY through the setup TUI. An interactive `init` with no preset SHALL start at the preset step, while an explicit preset SHALL start at the tool step. Supplying `--tools` SHALL skip the setup TUI, and an omitted preset SHALL then resolve to `default`. Existing configuration SHALL be pre-selected, and first-time setup SHALL pre-select detected harnesses when no configuration exists.

#### Scenario: No-command interactive invocation
- **WHEN** `mattpack` runs in a TTY without enough input
- **THEN** it prompts for preset and tools through the editable two-step setup flow

#### Scenario: Explicit preset interactive invocation
- **WHEN** a user runs `mattpack init general` in a TTY without `--tools`
- **THEN** the setup TUI starts at the tool step with `general` fixed as the preset

#### Scenario: Explicit non-interactive tool selection
- **WHEN** a user runs `mattpack init --tools codex`
- **THEN** the setup TUI is skipped and the preset resolves to `default`

#### Scenario: Non-interactive ambiguity
- **WHEN** required input is missing outside a TTY
- **THEN** the command fails with `NON_INTERACTIVE_INPUT_REQUIRED`

#### Scenario: Declined confirmation
- **WHEN** a user declines a write confirmation
- **THEN** Mattpack exits successfully without mutation

#### Scenario: Interrupted prompt
- **WHEN** a user presses Ctrl+C during a prompt
- **THEN** Mattpack exits with status 130 without a stack trace

### Requirement: Interactive TUI setup navigation and presentation

When interactive setup requires both a preset and tool selection, the CLI SHALL present a two-step TUI with Preset as step 1 and Tools as step 2. The TUI SHALL allow navigation between steps before final submission, preserve selections when moving backward, and show the current step in the header. When a preset was supplied, the same TUI SHALL open directly on the Tools step without backward navigation.

#### Scenario: Editable two-step setup
- **WHEN** a user moves from Preset to Tools and presses the left arrow before final submission
- **THEN** the TUI returns to Preset, preserves the tool selection, and allows the preset to be changed before returning to Tools

#### Scenario: Final submission boundary
- **WHEN** a user is on the Preset step
- **THEN** Enter or the right arrow advances to Tools without submitting the installation
- **WHEN** a user is on the Tools step and submits with at least one tool selected
- **THEN** the selection flow ends and the normal installation plan confirmation is shown

#### Scenario: Wide terminal presentation
- **WHEN** the terminal is wide enough for the complete labels
- **THEN** each Preset and Tool row displays its name and description or target in separate left-aligned columns, with the active name using a distinct highlight from its description and selected tools visibly marked

#### Scenario: Narrow terminal presentation
- **WHEN** the terminal is too narrow for a complete two-column row
- **THEN** the current step displays only selectable names in the list and shows only the active item's description below the list

#### Scenario: Local prompt redraw
- **WHEN** a user navigates, changes a preset, or toggles a harness
- **THEN** the TUI updates only its own prompt area without clearing unrelated terminal output
- **WHEN** a user presses an unsupported key
- **THEN** the TUI does not redraw or change selection state

### Requirement: Plan confirmation
Interactive `init`, `update`, and `remove` SHALL display the real deterministic plan before writing and SHALL default confirmation to Yes. Non-interactive or JSON writes SHALL require `--yes`, while dry runs and no-op updates SHALL not require approval.

#### Scenario: Default confirmation
- **WHEN** an interactive write plan requires confirmation
- **THEN** the confirmation prompt has Yes selected by default and pressing Enter accepts it

#### Scenario: Non-interactive mutation
- **WHEN** an init, update, or remove plan contains writes outside a TTY and `--yes` is absent
- **THEN** Mattpack returns `NON_INTERACTIVE_INPUT_REQUIRED` without mutation

#### Scenario: No-op update
- **WHEN** update resolves to no changes outside a TTY
- **THEN** Mattpack reports the installation is already current without requiring `--yes`

### Requirement: Human output
Human output SHALL group planned actions by target and action kind, distinguish completion from inspection, and provide conflict or recovery guidance without changing the JSON contract. `--no-color` and `NO_COLOR` SHALL suppress ANSI styling.

#### Scenario: Human-readable plan
- **WHEN** an operation plan is rendered for an interactive user
- **THEN** actions are grouped by target and action kind with conflicts and preserved drift called out separately

#### Scenario: Plain output
- **WHEN** `--no-color` is passed or `NO_COLOR` is set
- **THEN** human-readable output contains no ANSI styling

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
