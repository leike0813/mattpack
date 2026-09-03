## Context

The repository contains only the product authority and OpenSpec configuration. The implementation must satisfy the new capability specs while keeping normal consumer operations offline, project-local, deterministic, and safe around unowned data.

## Goals / Non-Goals

**Goals:**

- Keep resolution and planning deterministic and independently testable.
- Centralize all harness metadata and all ownership decisions.
- Make every mutation recoverable or provably limited to Mattpack-owned bytes.
- Ship a small Node-native CLI with no runtime packages.

**Non-Goals:**

- Expose a supported JavaScript library API.
- Add global installs, remote registries, skill rewriting, workflow execution, or compatibility translation.
- Build one source file per adapter when declarative registry entries provide the behavior.

## Decisions

### Use a functional planner and a filesystem shell

Catalog resolution, target deduplication, ownership classification, and action ordering are pure functions over validated snapshots. A small service layer gathers filesystem state, and one apply module performs staged swaps. This keeps `inspect`, dry-run, and mutation on the same path. Direct command-specific mutation was rejected because it would duplicate safety rules.

### Tie ownership to lock plus sidecar

The lock stores prior file hashes and a persistent installation ID; each managed skill has a small sidecar with that ID and source identity. Neither matching upstream bytes nor a sidecar alone proves ownership. This avoids falsely claiming pre-existing skills without adding content markers to upstream files.

### Abort overwrite conflicts as one plan

Init and update do not perform partial safe writes when overwrite conflicts exist; they report the complete plan and require `--force`. Extra consumer files are divergence rather than overwrite conflicts and are copied through staged directory replacement. This reduces mixed-version state while preserving unrelated files.

### Stage complete affected directories and commit state last

Changed skill directories are rebuilt in `.mattpack/staging`, including preserved extra files, then exchanged with validated destinations. Prior directories remain in transaction storage until every swap and config write succeeds; lock replacement is last. A failed operation reverses completed swaps. Per-file in-place writes were rejected because rollback would be harder and extra files easier to lose.

### Keep catalogs and adapters declarative

Preset roots and aliases live in `src/catalog/presets.ts`, dependency edges in `dependencies.ts`, and all harness metadata in one registry. `full`, `beta-only`, and `everything` scan allowed vendor buckets at runtime. README tables are generated from those values, avoiding a second hand-maintained catalog.

### Use only Node and development-time TypeScript tooling

Runtime parsing, hashing, argument handling, prompts, filesystem operations, processes, and tests use Node built-ins. TypeScript and ESLint packages remain development dependencies. This avoids a runtime dependency tree without hand-building substitutes for compiler or lint behavior.

### Vendor the pinned install snapshot and keep OpenSpec separate

The sync script obtains the exact Git commit into a temporary checkout, then copies only the four supported skill buckets, `.claude-plugin/plugin.json`, and `LICENSE`. Every selected entry is validated before copying and every complete skill directory is preserved byte-for-byte. Unrelated repository files—including the pinned commit's root `AGENTS.md` symlink—are not part of the install snapshot. The OpenSpec repository remains a pinned Git submodule and npm's files allowlist excludes it. Consumer commands never invoke either repository's scripts.

## Risks / Trade-offs

- [Directory swaps cannot be atomic across all targets] → retain old directories until completion, revalidate before swaps, roll back on caught failures, and write lock last.
- [TTY behavior is difficult to snapshot reliably] → test semantic prompts and spawned non-interactive behavior without asserting full prose.
- [A future upstream changes frontmatter shape] → reject it during explicit sync/validation and require a reviewed parser change rather than silently accepting it.
- [macOS and Windows cannot be exercised locally here] → include a three-platform Node 20 CI matrix and keep path behavior covered by focused tests.
