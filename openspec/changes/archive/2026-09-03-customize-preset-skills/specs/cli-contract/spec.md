## ADDED Requirements

### Requirement: Additional skill option
`init` and `inspect` SHALL accept `--skills <ids>` as a comma-separated list of explicit skill roots. Supplied IDs SHALL be added to persisted selections, while omitting the option SHALL preserve persisted selections.

#### Scenario: Additional skills are supplied for init
- **WHEN** `--skills a,b` is supplied to `init` for an existing installation
- **THEN** `a` and `b` are merged with the configured additional roots, deduplicated, and included in the installation plan

#### Scenario: Additional skills are supplied for inspect
- **WHEN** `--skills a,b` is supplied to `inspect`
- **THEN** the inspection plan includes the merged roots without changing persisted state

#### Scenario: Skill option is used by another command
- **WHEN** `--skills` is supplied to `list`, `update`, `doctor`, or `remove`
- **THEN** Mattpack returns `INVALID_ARGUMENT` without mutation

#### Scenario: Explicit skills enter interactive setup
- **WHEN** `--skills` is supplied and the setup TUI is still required
- **THEN** those roots are pre-selected and remain editable before final submission

## MODIFIED Requirements

### Requirement: Interactive and non-interactive behavior
Missing init or inspect tool choices SHALL be prompted only on a TTY through the setup TUI. An interactive `init` with no preset SHALL start at the preset step, while an explicit preset SHALL start at the tool step with that preset initially selected. Supplying `--tools` SHALL skip the setup TUI, and an omitted preset SHALL then resolve to `default`. Existing preset, additional skill, and tool configuration SHALL be pre-selected, and first-time setup SHALL pre-select detected harnesses when no configuration exists.

#### Scenario: No-command interactive invocation
- **WHEN** `mattpack` runs in a TTY without enough input
- **THEN** it prompts for preset, optional additional skills, and tools through the editable two-step setup flow

#### Scenario: Explicit preset interactive invocation
- **WHEN** a user runs `mattpack init general` in a TTY without `--tools`
- **THEN** the setup TUI starts at the tool step with `general` selected and allows returning to edit the preset or additional skills

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
The CLI SHALL retain Preset and Tools as its two main setup steps. The Preset step SHALL open a nested Skill page that preserves explicit selections, and the Tools step SHALL allow returning to an editable Preset step before final submission. All prompt pages SHALL show their current context and update only the prompt region.

#### Scenario: Editable two-step setup
- **WHEN** a user moves from Preset to Tools and presses the left arrow before final submission
- **THEN** the TUI returns to Preset, preserves tool and additional skill selections, and allows the preset to be changed

#### Scenario: Skill page navigation
- **WHEN** a user presses `S` on Preset, toggles skills, and returns with Enter, Escape, or the left arrow
- **THEN** the nested Skill page returns to Preset with those explicit selections preserved

#### Scenario: Skill catalog paging
- **WHEN** all skills do not fit in the available terminal height
- **THEN** the Skill page supports item navigation and PageUp or PageDown paging with a visible page indicator

#### Scenario: Tool catalog paging
- **WHEN** all supported tools do not fit in the available terminal height
- **THEN** the Tools page uses the same bounded paging behavior without changing selected tools

#### Scenario: Skill catalog reference data
- **WHEN** the Skill page is displayed
- **THEN** it makes every skill name and description available and shows root, dependency, or not-included relationships for every canonical preset

#### Scenario: Final submission boundary
- **WHEN** a user is on the Preset step
- **THEN** Enter or the right arrow advances to Tools without submitting the installation
- **WHEN** a user is on the Tools step and submits with at least one tool selected
- **THEN** the selection flow ends and the normal installation plan confirmation is shown

#### Scenario: Wide terminal presentation
- **WHEN** the terminal is wide enough for the complete labels
- **THEN** selectable rows show names with descriptions or target details in aligned columns and the Skill page shows the complete relationship matrix

#### Scenario: Narrow terminal presentation
- **WHEN** a complete row does not fit the terminal
- **THEN** the list shows compact selectable names and the active item's detail area shows its description and complete preset relationships

#### Scenario: Local prompt redraw
- **WHEN** a user navigates, changes a selection, or changes pages
- **THEN** the TUI updates only its own prompt area without clearing unrelated terminal output
- **WHEN** a user presses an unsupported key
- **THEN** the TUI does not redraw or change selection state
