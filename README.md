# Mattpack

[中文文档](README.zh-CN.md)

Mattpack is an **unofficial** project-local installer for curated presets from [mattpocock/skills](https://github.com/mattpocock/skills). It is not affiliated with Matt Pocock.

It copies a fixed upstream snapshot bundled in the npm package into the native skill directories used by coding-agent harnesses. Normal commands do not contact GitHub, create global state, run a daemon, require an account or API key, or collect telemetry.

## Why project-local installation

`mattpocock/skills` is a practical set of AI-native development skills. Installing a large skill collection globally makes an agent spend part of its skill catalog budget on those skills for every task. Some harnesses, including Codex, can even run into prompt truncation. Installing skills at project scope and only when a project needs them keeps that catalog local to the work.

The upstream collection contains many separate skills with dependencies between them. Mattpack offers presets for common situations, so users can choose a scenario without working out the dependency graph by hand.

Existing project-skill managers such as [skills-manager](https://github.com/xingkongliang/skills-manager) are GUI applications. Mattpack provides a CLI that fits developer workflows and can be composed into worktree automation.

## Quick start

```sh
npx @leike0813/mattpack init --tools codex
```

Mattpack writes only below the selected project root. Pin the package version when reproducing an older installation:

```sh
npx @leike0813/mattpack@0.1.3 init --tools codex
```

## Presets

| Preset | Aliases | Purpose | Roots | Added dependencies | Resolved |
|---|---|---|---:|---|---:|
| `default` | `developing`<br>`dev` | Curated day-to-day software development | 12 | `codebase-design (requires)`<br>`domain-modeling (requires)`<br>`grilling (requires)` | 15 |
| `general` | — | Lightweight general planning and agent workflow support | 5 | `grilling (requires)` | 6 |
| `full` | — | All promoted stable skills | 27 | — | 27 |
| `beta-only` | `in-progress` | All beta roots plus required stable dependencies | 7 | `codebase-design (requires)`<br>`grilling (requires)` | 9 |
| `everything` | `beta`<br>`experimental` | All promoted, in-progress, and misc skills | 38 | — | 38 |

A preset selects roots. Add individual roots with `--skills <comma-separated ids>` or the interactive skill catalog. Mattpack recursively adds declared `requires` and `setupCompanion` skills, reports why each was added, deduplicates the result, and rejects missing nodes or cycles. `beta-only` has beta roots but may add stable dependencies. Use `--no-deps` only when you accept a potentially unusable installation.

## Supported harnesses

| Harness | Project-local skill root |
|---|---|
| `agents` | `.agents/skills` |
| `amp` | `.agents/skills` |
| `antigravity` | `.agents/skills` |
| `autohand` | `.autohand/skills` |
| `auggie` | `.augment/skills` |
| `bob` | `.bob/skills` |
| `claude` | `.claude/skills` |
| `cline` | `.cline/skills` |
| `codebuff` | `.agents/skills` |
| `codeartsagent` | `.codeartsdoer/skills` |
| `codebuddy` | `.codebuddy/skills` |
| `codex` | `.agents/skills` |
| `command-code` | `.commandcode/skills` |
| `continue` | `.continue/skills` |
| `costrict` | `.costrict/skills` |
| `crush` | `.crush/skills` |
| `cursor` | `.cursor/skills` |
| `deep-agents` | `.deepagents/skills` |
| `deepseek-harness` | `.dsh/skills` |
| `devin` | `.devin/skills` |
| `factory` | `.factory/skills` |
| `forgecode` | `.forge/skills` |
| `gemini` | `.gemini/skills` |
| `github-copilot` | `.github/skills` |
| `goose` | `.goose/skills` |
| `grok` | `.grok/skills` |
| `hermes` | `.hermes/skills` |
| `iflow` | `.iflow/skills` |
| `junie` | `.junie/skills` |
| `kilocode` | `.kilo/skills` |
| `kimi` | `.kimi-code/skills` |
| `kiro` | `.kiro/skills` |
| `lingma` | `.lingma/skills` |
| `minimax-code` | `.minimax/skills` |
| `openhands` | `.openhands/skills` |
| `oh-my-pi` | `.omp/skills` |
| `opencode` | `.opencode/skills` |
| `pi` | `.pi/skills` |
| `prime-agent` | `.prime/agent/skills` |
| `qoder` | `.qoder/skills` |
| `qwen` | `.qwen/skills` |
| `replit-agent` | `.agents/skills` |
| `roocode` | `.roo/skills` |
| `rovodev` | `.rovodev/skills` |
| `sourcecraft-code-assistant` | `.codeassistant/skills` |
| `trae` | `.trae/skills` |
| `vibe` | `.vibe/skills` |
| `warp` | `.agents/skills` |
| `zcode` | `.zcode/skills` |
| `zed` | `.agents/skills` |
| `zoo-code` | `.roo/skills` |

Harnesses that share a root (including `.agents/skills` and Roo/Zoo Code's `.roo/skills`) write one physical tree and record every logical consumer. Detection is advisory, while an explicit `--tools` selection wins. See [harness audit evidence](docs/harness-audit.md) for verified product surfaces.

CoStrict now targets `.costrict/skills` and Kilo Code targets `.kilo/skills`. Preview `update --dry-run`: unchanged owned files migrate through the normal planner; local edits and extra files at the old root remain preserved and reported. Resolve unowned conflicts at the new root before updating.

`amazon-q` is retired because the reviewed Q CLI has no native skills target; its IDE surface remains unverified. Stored selections return `UNKNOWN_TOOL` from update/doctor before writes. Reselect supported tools with `init --tools <ids> --yes`, or use ownership-safe `remove --yes` to uninstall from the old lock.

## Commands

```text
mattpack [init] [preset]
mattpack inspect [preset]
mattpack list
mattpack update
mattpack doctor
mattpack remove
```

Common options are `--dir <path>`, `--tools <comma-separated ids>`, `--tools all`, `--skills <comma-separated ids>`, `--yes`, `--dry-run`, `--json`, `--no-color`, `--force`, and `--no-deps`. `--skills` adds explicit roots to the persisted selection for `init` and to the plan for `inspect`; use the TUI to remove selections. Interactive `mattpack init` keeps Preset and Tools as two main steps and opens a paginated skill catalog from Preset with `S`. An explicit preset starts at Tools but can return to editable Preset and Skills pages. Supplying `--tools` skips the setup TUI, and an omitted preset then defaults to `default`. Detected harnesses are pre-selected on first setup. Non-interactive ambiguity is an error. `inspect` uses the installation planner without writing, `update` reconciles against the snapshot in the running package, and `doctor` reports drift without repairing it.

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

## Upgrading from the previous snapshot

Upgrade the Mattpack package, then preview `mattpack update --dry-run`. Upstream promoted `implement-spec` and `retro` to stable, added stable `pr` and beta `chief-of-staff`, and removed `resolving-merge-conflicts`. New skills follow dynamic presets; `default` only drops the removed skill and `general` is unchanged. To keep the promoted skills in `beta-only`, add them explicitly with `mattpack init beta-only --tools <your-tools> --skills implement-spec,retro --yes`.

If `.mattpack/config.json` lists `resolving-merge-conflicts` in `additionalSkills`, remove that entry before retrying `update` or interactive `init`. Both validate stored roots and return `UNKNOWN_SKILL` before writes; preserve the other selections and configuration.

The skills now use `GLOSSARY.md` and `GLOSSARY-MAP.md`. Rename existing `CONTEXT.md` and `CONTEXT-MAP.md` documents as appropriate, including per-context files and map links, and update navigation pointers in project instructions and domain configuration. Mattpack leaves these consumer documents untouched. Upstream has frozen `misc` maintenance; those skills remain available through `everything`. See [release notes](https://github.com/leike0813/mattpack/blob/main/CHANGELOG.md).

## Bundled provenance

This release bundles `mattpocock/skills` commit `b0618bc436ad893b3c5e84e55fba86586d34a404` under the MIT license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Complete upstream skill directories are copied byte-for-byte; Mattpack does not execute upstream scripts.

[OpenSpec](https://github.com/Fission-AI/OpenSpec) is pinned under `references/OpenSpec` as a development-only design reference. It is not a runtime dependency and is excluded from the npm package.

## Development

Node.js 20+ and pnpm are required.

```sh
pnpm install --frozen-lockfile
pnpm check
```

Regenerate both language versions with `pnpm run docs`; CI uses `pnpm docs:check` to reject catalog, harness-table, or README drift.

Maintainers can use the development-only [Matt skills automation](docs/automations.md) to review a fixed upstream SHA and open a draft PR. It is excluded from the npm package; consumer commands remain offline.
