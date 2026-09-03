## Why

The interactive setup wizard now supports richer preset and harness selection, but these behaviors are not yet locked into the CLI contract. Without a specification, future prompt changes can regress editable step navigation, responsive layouts, terminal styling, redraw behavior, or the safer default confirmation choice.

## What Changes

- Define a two-step interactive setup flow for preset and harness selection.
- Allow users to move between steps before final submission and preserve edits when navigating back.
- Specify wide-screen aligned columns, distinct selection styling, and narrow-screen description placement for both preset and harness pages.
- Require local prompt redraws instead of clearing the entire terminal for ordinary navigation input.
- Make the interactive plan confirmation default to Yes while preserving explicit cancellation behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-contract`: specify the interactive TUI navigation, responsive presentation, redraw behavior, styling, and Yes-default plan confirmation requirements.

## Impact

- `src/output/prompts.ts`: interactive setup rendering, keyboard handling, responsive layout, styling, and confirmation default.
- `src/output/render.ts`: shared ANSI styling used by the interactive prompt.
- Existing CLI contract and its interactive smoke-test expectations.
- No new dependencies or changes to non-interactive JSON behavior.
