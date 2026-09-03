# harness-targeting Specification

## Purpose

Defines project-local harness selection, detection, destinations, and shared-root behavior without coupling catalog or reconciliation logic to a specific coding agent.

## Requirements

### Requirement: Supported project-local harnesses
Mattpack SHALL support `agents`, `codex`, `zed`, `claude`, `opencode`, `pi`, `oh-my-pi`, `gemini`, `cursor`, `github-copilot`, `kimi`, `qwen`, and `kilocode` at their exact AGENTS.md destinations.

#### Scenario: Explicit harness selection
- **WHEN** one or more harness IDs are supplied through `--tools`
- **THEN** Mattpack treats that selection as authoritative and targets only their project-local skill roots

#### Scenario: Select every harness
- **WHEN** `--tools all` is supplied
- **THEN** all supported logical harnesses are selected

### Requirement: Shared physical target deduplication
Mattpack SHALL treat `agents`, `codex`, and `zed` as separate logical consumers of one `.agents/skills` physical tree.

#### Scenario: Shared consumers are selected together
- **WHEN** two or more shared-root harnesses are selected
- **THEN** Mattpack writes one skill tree and records every logical consumer in deterministic order

### Requirement: Advisory detection
Mattpack SHALL report detection evidence from established project files or directories without allowing detection to override explicit selection.

#### Scenario: Interactive selection has hints
- **WHEN** an interactive user has not selected a harness
- **THEN** detected harnesses and their evidence are shown as selection guidance

#### Scenario: Non-interactive selection is ambiguous
- **WHEN** a non-interactive command needs harnesses and none were explicitly supplied or persisted
- **THEN** Mattpack returns a stable input-required error instead of guessing

### Requirement: Contained destinations
Mattpack MUST reject any logical or real destination that escapes the selected project root, including traversal and linked path components.

#### Scenario: Linked root escapes the project
- **WHEN** a harness destination contains a symlink that resolves outside the project
- **THEN** planning fails before any target or state file is changed
