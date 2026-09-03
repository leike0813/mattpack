## 1. Interactive selection

- [x] 1.1 Add navigable preset and harness selectors with configured/detected preselection, and verify choice ordering and defaults in prompt unit tests.
- [x] 1.2 Route TTY init and inspect input through the selectors while preserving explicit CLI values, and verify non-interactive ambiguity still returns `NON_INTERACTIVE_INPUT_REQUIRED`.

## 2. Plan approval and cancellation

- [x] 2.1 Make init, update, and remove obtain a dry-run plan before mutation, apply that exact plan after approval, and verify changed non-interactive operations require `--yes` while no-op updates do not.
- [x] 2.2 Default interactive confirmations to No, preserve state when declined, and verify Ctrl+C exits with status 130 without a stack trace in a real TTY.

## 3. Output and distribution

- [x] 3.1 Group human plan actions by kind and target, add concise completion and doctor summaries, and verify JSON output retains its existing envelope.
- [x] 3.2 Add `--no-color` and `NO_COLOR` handling, and verify real TTY prompt output suppresses ANSI styling while retaining required cursor controls.
- [x] 3.3 Bundle the Inquirer prompt implementation into `dist/cli.js`, restrict the package allowlist to the bundled entry point, and verify the packed artifact completes the offline lifecycle smoke test.
- [x] 3.4 Update generated documentation, third-party notices, and CLI behavior tests, then verify the complete change with `pnpm check`.
