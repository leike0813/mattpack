## Context

The interactive setup path needs to collect two related choices before building the installation plan. The existing selector prompts are independent, so submitting the preset prompt prevents users from revisiting it while choosing Harnesses. The setup flow also needs to remain offline, honor the existing `NO_COLOR` behavior, and avoid disturbing welcome text or other terminal output during navigation.

See `proposal.md` for the motivation and `specs/cli-contract/spec.md` for the externally visible contract.

## Goals / Non-Goals

**Goals:**

- Provide one editable two-step TUI for the case where both preset and Harness choices are missing.
- Keep selection defaults from configuration and harness detection.
- Render readable wide and narrow layouts with shared ANSI styling.
- Redraw only the prompt region and ignore unsupported keys.
- Preserve the existing plan/confirmation and non-interactive behavior outside the combined wizard.

**Non-Goals:**

- Add a prompt framework, runtime dependency, or persistent UI state.
- Change preset resolution, harness detection, installation planning, or JSON output.
- Add global installation or resize-aware layout management.

## Decisions

1. **Use a small raw-keypress wizard in the prompt module.** The two selectors must share mutable step state, selected values, and the final submission boundary. Existing selector prompts remain for partial-input cases where only one choice is missing.

2. **Keep the data path unchanged.** Harness options continue to be ordered and defaulted by the existing prompt-choice mapping. The wizard returns the selected preset and harness IDs, and the CLI continues to canonicalize and sort harnesses before planning.

3. **Share the existing ANSI style helper.** Prompt colors use the same TTY and `NO_COLOR` gate as human CLI output. Active names use a distinct highlight, descriptions use cyan, selected Harnesses use green, and instructions use dim text.

4. **Choose layout from the current terminal width.** Wide rows calculate the maximum visible name and description widths and pad the name column. When a complete row would not fit, the list contains only names and the active item's description is rendered below it.

5. **Redraw in place.** The renderer returns its logical line count. Subsequent state changes move the cursor to the beginning of the previous prompt block and erase downward before writing the next frame. Initial rendering leaves the welcome text intact; unsupported keys do not render.

6. **Submit only from Harnesses.** Enter or the right arrow advances from Preset; the left arrow returns from Harnesses. Harness selection remains mutable until Enter submits with at least one selected Harness. The existing plan confirmation then defaults to Yes.

## Risks / Trade-offs

- ANSI cursor movement assumes prompt rows do not wrap; the width-aware layouts keep the supported labels within the normal terminal width, but very unusual Unicode width behavior can still vary by terminal.
- A raw-keypress prompt owns terminal raw mode temporarily and must restore it on submit or cancellation; cleanup is kept on every terminal exit path.
- The combined wizard is intentionally limited to interactive cases missing both inputs. Supplying one choice through CLI arguments keeps the established single-selector behavior and avoids introducing an unnecessary multi-step screen.
