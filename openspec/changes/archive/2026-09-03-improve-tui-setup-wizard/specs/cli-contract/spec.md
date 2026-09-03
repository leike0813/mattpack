## ADDED Requirements

### Requirement: Interactive TUI setup navigation and presentation

When interactive setup requires both a preset and harness selection, the CLI SHALL present a two-step TUI with Preset as step 1 and Harnesses as step 2. The TUI SHALL allow navigation between steps before final submission, preserve selections when moving backward, and show the current step in the header.

#### Scenario: Editable two-step setup
- **WHEN** a user moves from Preset to Harnesses and presses the left arrow before final submission
- **THEN** the TUI returns to Preset, preserves the harness selection, and allows the preset to be changed before returning to Harnesses

#### Scenario: Final submission boundary
- **WHEN** a user is on the Preset step
- **THEN** Enter or the right arrow advances to Harnesses without submitting the installation
- **WHEN** a user is on the Harnesses step and submits with at least one harness selected
- **THEN** the selection flow ends and the normal installation plan confirmation is shown

#### Scenario: Wide terminal presentation
- **WHEN** the terminal is wide enough for the complete labels
- **THEN** each Preset and Harness row displays its name and description or target in separate left-aligned columns, with the active name using a distinct highlight from its description and selected Harnesses visibly marked

#### Scenario: Narrow terminal presentation
- **WHEN** the terminal is too narrow for a complete two-column row
- **THEN** the current step displays only selectable names in the list and shows only the active item's description below the list

#### Scenario: Local prompt redraw
- **WHEN** a user navigates, changes a preset, or toggles a harness
- **THEN** the TUI updates only its own prompt area without clearing unrelated terminal output
- **WHEN** a user presses an unsupported key
- **THEN** the TUI does not redraw or change selection state

## MODIFIED Requirements

### Requirement: Interactive and non-interactive behavior

Missing init or inspect choices SHALL be prompted only on a TTY through navigable selectors; when both preset and harness choices are missing, the interactive flow SHALL use the two-step TUI setup flow. `--yes` may choose the `default` preset but SHALL NOT guess an absent harness. Existing configuration SHALL be pre-selected, and first-time setup SHALL pre-select detected harnesses when no configuration exists.

#### Scenario: No-command interactive invocation
- **WHEN** `mattpack` runs in a TTY without enough input
- **THEN** it prompts for preset and harness through the editable two-step setup flow rather than silently installing `default`

#### Scenario: Non-interactive ambiguity
- **WHEN** required input is missing outside a TTY
- **THEN** the command fails with `NON_INTERACTIVE_INPUT_REQUIRED`

#### Scenario: Declined confirmation
- **WHEN** a user declines a write confirmation
- **THEN** Mattpack exits successfully without mutation

#### Scenario: Interrupted prompt
- **WHEN** a user presses Ctrl+C during a prompt
- **THEN** Mattpack exits with status 130 without a stack trace

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
