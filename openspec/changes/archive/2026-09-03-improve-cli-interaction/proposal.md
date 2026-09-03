## Why

Mattpack's line-oriented prompts and terse operation summaries make interactive setup harder to navigate and give users too little context before filesystem changes. The CLI should provide the same deliberate selection, preview, and cancellation flow users expect from OpenSpec while preserving Mattpack's deterministic core and machine-readable contract.

## What Changes

- Replace free-form preset and harness input with navigable terminal selectors that pre-select configured or detected harnesses.
- Show the real reconciliation plan before interactive `init`, `update`, and `remove` writes, with confirmation defaulting to No.
- Require `--yes` for non-interactive mutations while allowing dry runs and no-op updates without approval.
- Group human-readable plans by target and action, add concise completion and doctor summaries, and support `--no-color` and `NO_COLOR`.
- Treat a declined confirmation as a successful no-op and Ctrl+C as cancellation with exit status 130.
- Bundle the prompt implementation into the published CLI so package installation and normal operation remain offline-capable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-contract`: Extend the interactive selection, mutation confirmation, cancellation, and human-output requirements.

## Impact

- Affects the CLI entry point and human output modules without changing the core resolver, planner, ownership model, or JSON envelope.
- Adds Inquirer prompt packages and esbuild as development dependencies; prompt code is bundled into `dist/cli.js`, so the published package has no installed runtime dependencies.
- Updates CLI tests, package smoke tests, generated README content, and third-party notices.
