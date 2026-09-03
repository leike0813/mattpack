## 1. Package and pinned inputs

- [x] 1.1 Add the ESM TypeScript package, lint/typecheck/build/test scripts, MIT licensing, ignore rules, and CI configuration; verify `pnpm install` produces a frozen lockfile.
- [x] 1.2 Add the exact `upstream.lock.json`, upstream sync/validation scripts, and vendored snapshot; verify the validator reports the expected 25 stable, 8 beta, 4 misc, and 37 total skills.
- [x] 1.3 Add the OpenSpec reference as a submodule at the required commit and correct stale reference paths in `AGENTS.md`; verify `git submodule status` shows the exact pin.

## 2. Catalog and harness resolution

- [x] 2.1 Implement preset definitions, aliases, dynamic bucket discovery, and upstream validation; verify all canonical and aliased preset tests pass.
- [x] 2.2 Implement deterministic recursive `requires` and `setupCompanions` closure with reason chains and graph errors; verify dependency unit tests cover success, missing nodes, cycles, and `--no-deps`.
- [x] 2.3 Implement the declarative registry for all 13 harnesses, advisory detection, and physical-root deduplication; verify the shared adapter contract and exact destination tests pass.

## 3. State, ownership, and reconciliation

- [x] 3.1 Implement typed errors, project-root resolution, containment checks, hashing, and strict config/lock/sidecar parsing; verify invalid JSON, traversal, linked roots, and state defaults are tested.
- [x] 3.2 Implement the deterministic planner for additions, replacements, removals, unchanged files, overwrite conflicts, and extra-file divergence; verify ownership and ordering tests pass.
- [x] 3.3 Implement staged directory swaps, precondition revalidation, rollback, force backups, and lock-last state commits; verify integration tests cover failure rollback and backup recovery.
- [x] 3.4 Implement init, inspect, update, doctor, and safe remove services over the shared planner; verify expansion, contraction, drift, preservation, and idempotency tests pass.

## 4. CLI and documentation

- [x] 4.1 Implement argument parsing, direct preset syntax, TTY prompts, non-interactive errors, and command-specific option validation; verify spawned CLI tests cover every command and ambiguity path.
- [x] 4.2 Implement deterministic human and JSON rendering with clean stdout/stderr separation; verify tests assert structured fields and semantic human output without locking full prose.
- [x] 4.3 Add README generation from catalog and registry plus required usage, safety, offline, preset, harness, and provenance documentation; verify the documentation check detects drift.

## 5. Package and release verification

- [x] 5.1 Add unit, shared harness contract, integration, and end-to-end coverage for all specification scenarios; verify `pnpm test` passes.
- [x] 5.2 Add the offline npm tarball smoke test for init, doctor, idempotent reinstall, remove, included vendor bytes, and excluded OpenSpec reference; verify `pnpm test:pack` passes.
- [x] 5.3 Run `openspec validate build-mattpack-v1`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:pack`, and `pnpm check`; inspect the final diff and record any platform gate that requires hosted CI.
