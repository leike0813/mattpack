# Design

## Context

See `proposal.md` for the audited scope. The source-of-truth boundaries are already adequate: the lock selects a commit, the sync script validates staging before replacing vendor, the catalog resolves presets, and the planner compares desired files against the prior lock and ownership sidecars.

The old count gate rejects the target before synchronization can finish. The default allowlist also names a deleted skill. Neither failure requires changing the consumer schema or reconciliation architecture.

## Goals / Non-Goals

**Goals:** Make the audited snapshot pass the existing catalog and offline package boundaries, and prove that upgrades preserve consumer-owned bytes.

**Non-Goals:** Add an upstream fetch path to normal commands, rewrite skills, broaden the curated presets, migrate consumer domain documents, update the OpenSpec reference, or change package dependencies.

## Decisions

### Keep the exact audited target and existing synchronization path

Use `b0618bc436ad893b3c5e84e55fba86586d34a404`, not a moving HEAD or plugin version. First align the count gate to stable 27, beta 7, misc 4, total 38, then update the lock and run `pnpm sync:upstream`. The script remains responsible for byte copying, file modes, path checks, staging, and replacement. Hand-copying the audited temporary checkout would bypass that maintenance boundary.

### Contract default without choosing replacement roots

Remove only `resolving-merge-conflicts`. This yields 12 default roots and 15 resolved skills. General remains five roots and six resolved skills. Dynamic presets remain bucket-driven: full 27, beta-only seven roots plus two dependencies, everything 38. Adding `pr` or the promoted skills to default would be a separate preset decision.

### Complete one explicit dependency entry

`implement-spec` directly requires `tdd` and `code-review`, and has `setup-matt-pocock-skills` as a setup companion. Its existing recursive resolution supplies `codebase-design`. Preserve `retro -> writing-for-agents`; `pr` has attribution rather than a `show-me` dependency, and `chief-of-staff` names no required skill. Runtime prose scanning would duplicate the reviewed dependency catalog.

### Reuse ownership reconciliation and test the migration boundaries

Bucket promotion changes the source identity, not the consumer skill name. Existing sidecar comparisons trigger replacement and refresh the source path. Existing removal logic handles the old domain-model resource and the retired preset skill. Exercise these paths with small synthetic prior consumer states and real desired snapshot files; do not retain an entire second upstream snapshot as a fixture. Extend existing catalog and lifecycle tests instead of writing text snapshots of skills.

### Publish migration guidance through maintained documentation

Update `AGENTS.md` to describe the current pin and catalog contract. Record this change in `CHANGELOG.md` and third-party notices, including `pr` attribution. Add a short bilingual README migration section through its generator, then regenerate both READMEs. Explain that users rename domain docs and update their configured navigation pointers themselves. A removed explicit root must be removed from `additionalSkills` in `.mattpack/config.json` before retrying update: interactive init validates existing roots before showing its catalog. Beta-only users can explicitly select skills that have graduated. Keep the package version unchanged until a separate release.

## Risks / Trade-offs

- Removed stored explicit roots block update -> preserve the existing `UNKNOWN_SKILL` contract, test that state is unchanged, and document recovery.
- Old domain resources contain local edits -> retain the normal conflict and force-backup behavior; do not migrate consumer documents.
- Promoted beta skills leave beta-only -> document explicit additions as the way to retain them.
- Cross-harness invocation may differ -> ship upstream content unchanged and keep installation distinct from execution.
- The target includes fixes after plugin 1.3.1 -> identify the exact commit in lock, provenance, and release notes.

## Migration Plan

Align catalog code, synchronize the locked target, and run focused tests. Generate documentation and run `pnpm validate:upstream` and `pnpm check`, including the offline npm smoke test. Inspect the final diff for unintended reference or consumer-state changes. Leave the implemented change active for review; committing, releasing, syncing main specs, and archiving are separate operations.
