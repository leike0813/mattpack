# Tasks

## 1. Align the locked catalog

- [x] 1.1 Update the reviewed count gate, default roots, and implement-spec dependencies; verify catalog counts, dynamic membership, curated exclusions, and dependency reason chains in focused tests.
- [x] 1.2 Pin `b0618bc436ad893b3c5e84e55fba86586d34a404` and regenerate vendor with `pnpm sync:upstream`; verify the command's commit/count output and `pnpm validate:upstream`.
- [x] 1.3 Align AGENTS.md, third-party provenance, and release notes with the target; verify the pin and preserved pr credits against the upstream audit.

## 2. Verify consumer upgrades

- [x] 2.1 Extend lifecycle tests for promoted source paths, resource renames and local conflicts, and deleted managed skills preserving modified/extra bytes; verify refreshed ownership, a healthy doctor result after clean upgrade, and idempotent update.
- [x] 2.2 Test a removed stored additional root failing with UNKNOWN_SKILL before mutation and verify consumer domain documents remain untouched.
- [x] 2.3 Add bilingual migration guidance through the README generator, covering domain docs, beta promotions, and removed explicit roots; regenerate with `pnpm run docs` and verify `pnpm docs:check`.

## 3. Integration acceptance

- [x] 3.1 Run `pnpm check`, including offline `pnpm test:pack`, and strict OpenSpec change validation; require successful command results.
- [x] 3.2 Inspect the final diff and generated vendor bytes/modes against the exact upstream target; verify that the OpenSpec reference, consumer state, dependency files, and pre-existing .gitignore changes remain outside this implementation.
