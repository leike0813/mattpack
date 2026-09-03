# Mattpack

Mattpack is an **unofficial** project-local installer for curated presets from [mattpocock/skills](https://github.com/mattpocock/skills). It is not affiliated with Matt Pocock.

It copies a fixed upstream snapshot bundled in the npm package into the native skill directories used by coding-agent harnesses. Normal commands do not contact GitHub, create global state, run a daemon, require an account or API key, or collect telemetry.

## Quick start

```sh
npx mattpack init default --harness codex
```

Mattpack writes only below the selected project root. Pin the package version when reproducing an older installation:

```sh
npx mattpack@0.1.0 init default --harness codex
```

## Presets

| Preset | Aliases | Purpose | Roots | Added dependencies | Resolved |
|---|---|---|---:|---|---:|
| `default` | `developing`<br>`dev` | Curated day-to-day software development | 13 | `codebase-design (requires)`<br>`domain-modeling (requires)`<br>`grilling (requires)` | 16 |
| `general` | — | Lightweight general planning and agent workflow support | 5 | `grilling (requires)` | 6 |
| `full` | — | All promoted stable skills | 25 | — | 25 |
| `beta-only` | `in-progress` | All beta roots plus required stable dependencies | 8 | `code-review (requires)`<br>`codebase-design (requires)`<br>`grilling (requires)`<br>`setup-matt-pocock-skills (setupCompanion)`<br>`writing-for-agents (requires)` | 13 |
| `everything` | `beta`<br>`experimental` | All promoted, in-progress, and misc skills | 37 | — | 37 |

A preset selects roots. Mattpack recursively adds declared `requires` and `setupCompanion` skills, reports why each was added, deduplicates the result, and rejects missing nodes or cycles. `beta-only` has beta roots but may add stable dependencies. Use `--no-deps` only when you accept a potentially unusable installation.

## Supported harnesses

| Harness | Project-local skill root |
|---|---|
| `agents` | `.agents/skills` |
| `codex` | `.agents/skills` |
| `zed` | `.agents/skills` |
| `claude` | `.claude/skills` |
| `opencode` | `.opencode/skills` |
| `pi` | `.pi/skills` |
| `oh-my-pi` | `.omp/skills` |
| `gemini` | `.gemini/skills` |
| `cursor` | `.cursor/skills` |
| `github-copilot` | `.github/skills` |
| `kimi` | `.kimi-code/skills` |
| `qwen` | `.qwen/skills` |
| `kilocode` | `.kilocode/skills` |

`agents`, `codex`, and `zed` share `.agents/skills`; selecting them together writes one physical tree and records every logical consumer. Detection is advisory, while an explicit `--harness` selection wins.

## Commands

```text
mattpack [init] [preset]
mattpack inspect [preset]
mattpack list
mattpack update
mattpack doctor
mattpack remove
```

Common options are `--dir <path>`, repeatable `--harness <id>`, `--harness all`, `--yes`, `--dry-run`, `--json`, `--no-color`, `--force`, and `--no-deps`. Running `mattpack` without enough input in a terminal opens preset and harness selectors; detected harnesses are pre-selected on first setup. Non-interactive ambiguity is an error. `inspect` uses the installation planner without writing, `update` reconciles against the snapshot in the running package, and `doctor` reports drift without repairing it.

`init`, `update`, and `remove` show the real plan before interactive writes. Scripts, agents, and JSON mutations must pass `--yes`; dry runs and no-op updates do not require approval. Declining a prompt leaves the project unchanged, while Ctrl+C exits with status 130.

In JSON mode stdout is one structured JSON value. Human diagnostics and the `--no-deps` warning use stderr. Use `--no-color` or `NO_COLOR` for plain human output.

## Ownership and safety

Mattpack stores intent in `.mattpack/config.json`, resolved hashes in `.mattpack/lock.json`, and a small `.mattpack-owner.json` beside each managed skill. It never edits copied `SKILL.md` files.

- An existing unowned destination is a conflict and is preserved.
- A locally modified managed file is preserved unless `--force` is supplied.
- Extra files inside managed directories are preserved and reported as divergence.
- `--force` copies affected directories to `.mattpack/backups/` before replacement.
- Preset contraction and `remove` delete only bytes still matching the previous lock.
- An unchanged reinstall is a true no-op.

Writes are staged, checked again immediately before replacement, rolled back on failure, and committed to `lock.json` last.

## Bundled provenance

This release bundles `mattpocock/skills` commit `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76` under the MIT license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Complete upstream skill directories are copied byte-for-byte; Mattpack does not execute upstream scripts.

[OpenSpec](https://github.com/Fission-AI/OpenSpec) is pinned under `references/OpenSpec` as a development-only design reference. It is not a runtime dependency and is excluded from the npm package.

## Development

Node.js 20+ and pnpm are required.

```sh
pnpm install --frozen-lockfile
pnpm check
```

Regenerate this README with `pnpm run docs`; CI uses `pnpm docs:check` to reject catalog or harness-table drift.
