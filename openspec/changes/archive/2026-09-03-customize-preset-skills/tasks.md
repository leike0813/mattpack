## 1. Catalog and Intent

- [x] 1.1 Parse and validate skill descriptions, derive deterministic preset relationship data, and verify catalog tests cover all three relationship states.
- [x] 1.2 Add normalized `additionalSkills` config intent with schema version 1 fallback and verify state tests read both old and new configs.
- [x] 1.3 Merge preset and additional roots through the existing resolver, restore them during update and doctor, and verify integration tests cover overlap, persistence, and safe contraction.

## 2. CLI and TUI

- [x] 2.1 Add additive `--skills` parsing and command validation, including `UNKNOWN_SKILL`, and verify CLI tests cover init, inspect, persistence, and unsupported commands.
- [x] 2.2 Extend the setup state machine with the nested paginated Skill page, responsive descriptions, the five-preset relationship matrix, and editable return navigation; verify pure prompt tests cover paging and selection preservation.

## 3. Documentation and Gates

- [x] 3.1 Update the product contract and generated English and Chinese command documentation, then verify `pnpm docs:check` passes.
- [x] 3.2 Run strict OpenSpec validation, focused tests, `pnpm check`, and package smoke coverage; inspect the final diff for vendor or submodule changes.
