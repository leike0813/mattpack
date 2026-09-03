## MODIFIED Requirements

### Requirement: Interactive and non-interactive behavior
Missing init or inspect choices SHALL be prompted only on a TTY through navigable selectors; `--yes` may choose the `default` preset but SHALL NOT guess an absent harness. Existing configuration SHALL be pre-selected, and first-time setup SHALL pre-select detected harnesses when no configuration exists.

#### Scenario: No-command interactive invocation
- **WHEN** `mattpack` runs in a TTY without enough input
- **THEN** it prompts for preset and harness rather than silently installing `default`

#### Scenario: Non-interactive ambiguity
- **WHEN** required input is missing outside a TTY
- **THEN** the command fails with `NON_INTERACTIVE_INPUT_REQUIRED`

#### Scenario: Declined confirmation
- **WHEN** a user declines a write confirmation
- **THEN** Mattpack exits successfully without mutation

#### Scenario: Interrupted prompt
- **WHEN** a user presses Ctrl+C during a prompt
- **THEN** Mattpack exits with status 130 without a stack trace

## ADDED Requirements

### Requirement: Plan confirmation
Interactive `init`, `update`, and `remove` SHALL display the real deterministic plan before writing and SHALL default confirmation to No. Non-interactive or JSON writes SHALL require `--yes`, while dry runs and no-op updates SHALL not require approval.

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
