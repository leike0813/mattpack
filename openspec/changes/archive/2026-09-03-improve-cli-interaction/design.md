## Context

The CLI already has a deterministic resolver, reconciliation planner, and transactional apply boundary. Interactive input was implemented directly in the entry point with line-oriented `readline` questions, while human output exposed counts with little plan structure. The published package must remain offline-capable and must not require installed runtime dependencies.

## Goals / Non-Goals

**Goals:**

- Improve terminal selection and confirmation without changing core planning semantics.
- Use the same reconciliation plan for dry runs, previews, and writes.
- Preserve the existing JSON envelope and non-interactive error codes.
- Keep the installed npm package self-contained.

**Non-Goals:**

- Replacing `node:util` argument parsing or introducing a general CLI framework.
- Adding animation, search, telemetry, global installation, or new harness behavior.
- Changing ownership, conflict classification, dependency resolution, or transaction handling.

## Decisions

### Keep prompting in the imperative shell

Preset, harness, and confirmation prompts live in one output-boundary module. The CLI converts configured and detected harness data into prompt choices, but the core service continues to accept explicit values and return structured results.

This preserves the functional-core boundary and keeps JSON and non-interactive paths independent of terminal UI. Extending the existing `readline` questions was rejected because it would retain free-form parsing and offer no navigable multi-select interaction.

### Plan first and apply through the existing boundary

Every mutating command asks its service for a dry-run result. The CLI renders that result, applies approval rules, and then passes the exact plan to the existing transactional apply function. No-op plans bypass confirmation, while conflicts retain the planner's established safety behavior.

Generating a second summary before applying was rejected because it could drift from the actual reconciliation plan.

### Keep human and JSON rendering separate

Human plans group actions by kind and physical target, then report conflicts and preserved drift separately. Completion and doctor output use short status summaries. JSON serialization keeps its existing structured envelope and does not reuse formatted human strings.

Color is a small renderer concern controlled by TTY detection, `NO_COLOR`, and `--no-color`; prompt packages are loaded lazily after option parsing so the flag also affects prompt styling.

### Bundle only the executable entry point

Inquirer's select, checkbox, and confirm packages provide the terminal primitives. Esbuild bundles them into `dist/cli.js`, and the package allowlist publishes only that compiled entry point and its source map from `dist`. Inquirer and esbuild remain development dependencies.

Shipping runtime dependencies was rejected because pnpm's linked development layout did not produce a reliable offline npm tarball. A handwritten selector was rejected because keyboard navigation, redraw, and cancellation handling would add more project-owned terminal code.

## Risks / Trade-offs

- Bundling introduces an additional build step → the package smoke test installs the tarball offline and exercises the lifecycle through the bundled executable.
- Terminal prompts are difficult to cover through ordinary piped tests → choice ordering and cancellation classification have focused tests, with real-TTY checks covering navigation and Ctrl+C behavior.
- Requiring `--yes` can break unattended mutation commands that relied on implicit writes → the CLI returns the existing stable non-interactive-input error and documents the required flag.
- ANSI cursor control remains necessary for navigable prompts → `--no-color` suppresses styling while retaining terminal control sequences needed to redraw the prompt.

## Migration Plan

1. Publish the bundled CLI and updated usage documentation together.
2. Existing interactive users receive selectors and plan confirmation automatically; scripts that mutate state add `--yes`.
3. Roll back by restoring the prior CLI entry point and TypeScript-only build; no consumer state migration is required because config, lock, and ownership formats are unchanged.
