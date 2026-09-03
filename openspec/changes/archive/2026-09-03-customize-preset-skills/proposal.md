## Why

Presets provide useful defaults, but users currently cannot keep a preset while adding a small number of individually chosen skills. They must select a broader preset or go without those skills, and the interactive setup offers no catalog view for making an informed choice.

## What Changes

- Allow users to add explicit skill roots on top of a preset through a new `--skills` option.
- Persist manually selected roots as user intent and include them in normal dependency resolution, update, doctor, and safe reconciliation behavior.
- Add a nested Skill page to the existing two-step setup TUI with descriptions, pagination, selection, and a preset relationship matrix.
- Read skill descriptions from the pinned upstream frontmatter and derive preset relationships from the existing catalog and dependency resolver.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-resolution`: Resolve explicit user-selected roots together with preset roots and expose catalog metadata needed for selection.
- `cli-contract`: Accept additional skill selections through the CLI and the existing two-step interactive setup flow.
- `safe-reconciliation`: Persist additional root intent and safely reconcile later additions or removals.

## Impact

The change affects upstream catalog metadata, consumer configuration, installation resolution, CLI parsing, the setup prompt, generated documentation, and their existing tests. It adds no runtime dependency, network behavior, global installation target, or change to vendored skill contents.
