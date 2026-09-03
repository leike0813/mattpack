## 1. Interactive Flow

- [x] 1.1 Add the editable two-step Preset → Harnesses flow with left/right navigation, step indicators, preserved selections, and final submission from Harnesses only. Verify with an interactive TTY run that Enter/right advances, left returns, and prior selections remain editable.
- [x] 1.2 Preserve configuration and detection defaults, canonical harness ordering, and existing single-selector behavior when only one input is missing. Verify with the existing prompt, harness, and CLI contract tests.

## 2. Responsive Presentation

- [x] 2.1 Restore shared ANSI styling for prompt titles, active names, descriptions, selected Harnesses, instructions, and errors while honoring `NO_COLOR`. Verify in a color-enabled TTY and with `NO_COLOR` set.
- [x] 2.2 Align Preset and Harness names with their descriptions or targets in wide terminals without a separator character. Verify with a wide TTY rendering.
- [x] 2.3 Add narrow-terminal layouts that list names only and show the active description below the list for both steps. Verify with a constrained-width TTY rendering.

## 3. Redraw and Confirmation

- [x] 3.1 Replace full-screen clearing during prompt updates with local prompt-region redraw and ignore unsupported keys without changing state. Verify by sending an unsupported key and navigation keys during an interactive TTY run.
- [x] 3.2 Make interactive plan confirmation default to Yes while retaining explicit cancellation and non-interactive `--yes` requirements. Verify the prompt displays `(Y/n)` and declining it leaves the temporary project unchanged.
- [x] 3.3 Run `pnpm typecheck`, `pnpm lint`, and `pnpm build`, then validate the OpenSpec change. Verify all commands pass and the change reports apply-ready.
