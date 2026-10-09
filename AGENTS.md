# AGENTS.md

## Project Overview

Mattpack is an **unofficial**, lightweight, project-scoped `npx` CLI for installing curated presets from [`mattpocock/skills`](https://github.com/mattpocock/skills) into the native skill directories of coding-agent harnesses.

Mattpack is an installer and synchronizer, not an agent framework. Its core promise is:

- deterministic installation from a fixed upstream commit;
- curated preset selection with explicit dependency closure;
- project-local, multi-harness installation;
- safe updates that modify only Mattpack-owned files;
- direct execution through `npx` with no daemon, account, API key, or telemetry.

This file is the product and engineering authority for the repository. When it conflicts with a reference project or an inferred convention, this file wins.

## Product Principles

1. **Lightweight by default**
   - Use Node.js 20+ and strict TypeScript.
   - Prefer Node built-ins and keep the published package free of installed runtime dependencies; bundle the Inquirer prompt implementation into the compiled CLI.
   - Ship one npm package and one `mattpack` executable.
   - No GUI, background service, database, plugin host, or remote backend.

2. **Project scope only**
   - All generated files must remain beneath the selected project root.
   - Mattpack v1 must not implement global installation or write into a user's home directory.
   - `general` means general-purpose, not global.

3. **Pinned and reproducible**
   - Every Mattpack release bundles one exact snapshot of `mattpocock/skills`.
   - Normal `init`, `inspect`, `update`, `doctor`, and `remove` operations must not fetch GitHub.
   - The same Mattpack package version, preset, and harness selection must resolve to the same logical skill set.

4. **Harness-neutral core**
   - Preset resolution, dependency resolution, ownership, and reconciliation belong to shared core logic.
   - Harness-specific paths and detection belong to small adapters.
   - Do not encode one vendor's invocation syntax into copied skill content.

5. **Safe ownership**
   - Mattpack may replace or remove only files it can prove it owns.
   - Preserve unowned files and locally modified managed files by default.
   - Plan first, then write. `--dry-run` must use the real planner.

6. **Preserve upstream skills**
   - Copy complete upstream skill directories without renaming them.
   - Do not rewrite `SKILL.md`, frontmatter, scripts, templates, links, or `agents/openai.yaml` during normal installation.
   - Mattpack guarantees that dependencies are installed; it does not guarantee that every harness executes cross-skill calls identically.

## Non-Goals for v1

Do not expand Mattpack into:

- a general replacement for `skills.sh`;
- a marketplace or remote registry;
- an MCP, plugin, command, prompt, or subagent manager;
- a workflow runner that invokes installed skills;
- a live mirror of `mattpocock/skills@main`;
- a compatibility transpiler or opinionated fork of Matt's skill bodies;
- a system that edits the consumer project's root `AGENTS.md` or `CLAUDE.md` merely to install skills;
- a Web UI, cloud sync service, or team account system.

Prioritize Claude Code, Codex/shared `.agents`, OpenCode, Pi, and Oh My Pi in the first working release. Add other project-local harnesses through the same adapter contract, not through special cases.

## Technology and Package Contract

- Package manager for development: `pnpm`.
- Language: TypeScript with `strict: true`.
- Package format: ESM.
- Runtime target: Node.js `>=20`.
- Package and binary name: `mattpack`, unless npm availability requires a scoped package.
- `package.json` must expose:

```json
{
  "bin": {
    "mattpack": "dist/cli.js"
  }
}
```

- Prefer `node:util` `parseArgs`, `node:fs`, `node:path`, and `node:crypto` over runtime libraries.
- The published npm tarball must include compiled code, catalog data, licenses, and the pinned vendored skill snapshot.
- Bundle the Inquirer prompt implementation into `dist/cli.js` so package installation and normal operation remain offline-capable.
- The published package must exclude `references/OpenSpec`.

## Sources of Truth

| Concern | Source of truth |
|---|---|
| Product invariants | `AGENTS.md` |
| Upstream repository and commit | `upstream.lock.json` |
| Bundled upstream bytes | `vendor/mattpocock-skills/` |
| Preset roots and aliases | `src/catalog/presets.ts` |
| Cross-skill dependencies | `src/catalog/dependencies.ts` |
| Harness paths and detection | `src/harnesses/registry.ts` and adapters |
| Consumer intent | `<project>/.mattpack/config.json` |
| Resolved installation and hashes | `<project>/.mattpack/lock.json` |
| OpenSpec design reference | `references/OpenSpec/` submodule |

Do not duplicate exact preset membership or harness tables in several hand-maintained documents. Generate documentation from the catalog and registry where practical.

## Suggested Repository Layout

```text
mattpack/
├── AGENTS.md
├── README.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── upstream.lock.json
├── src/
│   ├── cli.ts
│   ├── commands/
│   ├── catalog/
│   │   ├── presets.ts
│   │   └── dependencies.ts
│   ├── core/
│   │   ├── plan.ts
│   │   ├── dependency-graph.ts
│   │   ├── install.ts
│   │   ├── ownership.ts
│   │   ├── state.ts
│   │   └── paths.ts
│   ├── harnesses/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   └── adapters/
│   └── output/
├── scripts/
│   ├── sync-upstream.ts
│   ├── validate-upstream.ts
│   └── verify-package.ts
├── vendor/
│   └── mattpocock-skills/
├── references/
│   └── OpenSpec/
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    └── fixtures/
```

Do not create empty abstraction files merely to match this tree. Add a module when it owns real behavior.

## Upstream Locking

The current `upstream.lock.json` snapshot is:

```json
{
  "schemaVersion": 1,
  "upstreams": {
    "mattpocock/skills": {
      "repository": "https://github.com/mattpocock/skills.git",
      "commit": "49dd158d1076134a641b33efb035946536778336",
      "vendorPath": "vendor/mattpocock-skills",
      "license": "MIT"
    }
  }
}
```

Rules:

- Use the full 40-character commit SHA as the snapshot identity.
- Never use a branch, tag, abbreviated SHA, date, or `latest` in the lock.
- Vendor the selected commit into the npm package; do not clone or fetch it at consumer runtime.
- Copy upstream files byte-for-byte and never execute upstream scripts.
- Do not hand-edit `vendor/mattpocock-skills/`.
- A consumer-side `mattpack update` reconciles against the snapshot bundled in the currently running Mattpack version, not GitHub HEAD.

An upstream bump must be an explicit pull request that:

1. selects one exact new commit;
2. reviews the upstream diff and changelog;
3. updates `upstream.lock.json` and regenerates the vendor snapshot together;
4. validates skill frontmatter, paths, source buckets, plugin manifest, presets, and dependencies;
5. runs the full tests and npm package smoke test;
6. records user-visible changes in release notes and third-party notices.

Reject path traversal, absolute paths, symlinks, device files, and duplicate skill identities while ingesting an upstream archive.

## OpenSpec Reference Submodule

Add [`Fission-AI/OpenSpec`](https://github.com/Fission-AI/OpenSpec) as a Git submodule at exactly:

```text
references/OpenSpec
```

Bootstrap reference commit:

```text
d0071d7326689a0269332a500c8f56b3f2218ba9
```

OpenSpec is a pinned, read-only design reference. It is not a runtime or build dependency.

Useful reference areas include:

```text
references/OpenSpec/src/core/config.ts
references/OpenSpec/src/core/available-tools.ts
references/OpenSpec/src/core/shared/skill-paths.ts
references/OpenSpec/src/core/shared/tool-detection.ts
references/OpenSpec/src/core/shared-skill-target.ts
references/OpenSpec/test/core/available-tools.test.ts
references/OpenSpec/test/core/shared-skill-target.test.ts
references/OpenSpec/docs/supported-tools.md
references/OpenSpec/docs/installation.md
```

Use it to study:

- harness registry and adapter organization;
- project-local skill-root conventions;
- shared `.agents/skills` arbitration;
- detection behavior;
- managed-file ownership and reconciliation tests.

Do not:

- import OpenSpec code into Mattpack;
- add OpenSpec as an npm dependency;
- modify files inside the submodule;
- run `git submodule update --remote` as routine maintenance;
- copy its command-generation or broader spec-workflow system;
- ship the submodule in the npm package.

Advance the submodule only in an explicit reference-bump change.

## Presets

A preset selects **root skills**. Mattpack then installs the transitive closure of `requires` and `setupCompanions` dependencies.

### `default`

Aliases: `developing`, `dev`.

Purpose: curated day-to-day software development.

Explicit roots:

```text
setup-matt-pocock-skills
grill-with-docs
to-spec
to-tickets
prototype
diagnosing-bugs
tdd
improve-codebase-architecture
code-review
handoff
wait-what
writing-for-agents
```

Expected added dependencies at the current pin:

```text
grilling
domain-modeling
codebase-design
```

Expected resolved count: **15**.

This is an explicit allowlist. New upstream stable skills must not enter `default` automatically.

### `general`

Purpose: lightweight general-purpose planning and agent workflow support.

Explicit roots:

```text
grill-me
handoff
to-questionnaire
wait-what
writing-for-agents
```

Expected added dependency:

```text
grilling
```

Expected resolved count: **6**.

Do not include `teach` by default because it creates a dedicated stateful teaching workspace.

### `full`

Purpose: all promoted stable skills in the pinned snapshot.

Discover from:

```text
skills/engineering/*/SKILL.md
skills/productivity/*/SKILL.md
```

Verify the result against `.claude-plugin/plugin.json`. A mismatch is a release-blocking upstream-catalog error.

Expected count at the current pin: **27**.

### `beta-only`

Alias: `in-progress`.

Purpose: all roots under `skills/in-progress/*/SKILL.md`, plus required stable dependencies and setup companions.

Expected beta root count at the current pin: **7**. With dependencies enabled, the resolved count is **9**.

`beta-only` means “only beta roots,” not “forbid stable dependencies.” Human and JSON output must distinguish the beta roots from stable additions.

### `everything`

Aliases: `beta`, `experimental`.

Purpose:

```text
promoted + in-progress + misc
```

Expected count at the current pin: **38**.

`everything` is canonical because `misc` is not semantically beta; `beta` remains the user-facing alias from the original design.

### Exclusions

Never include:

```text
skills/deprecated/**
.out-of-scope/**
node_modules/**
```

Do not add an ambiguous preset or flag named only `all`. Use `full`, `everything`, and `--tools all` for distinct meanings.

## Dependency Catalog

Use two dependency types:

```ts
type SkillDependency = {
  requires?: string[];
  setupCompanions?: string[];
};
```

- `requires`: another skill needed for a core branch of the selected skill.
- `setupCompanions`: a skill that must be installed and may need to be run manually to configure the project. Mattpack never invokes it.

Maintain these reviewed edges:

```text
grill-me                         -> requires: grilling
grill-with-docs                  -> requires: grilling, domain-modeling
triage                           -> requires: grilling, domain-modeling
                                  setup: setup-matt-pocock-skills
improve-codebase-architecture    -> requires: codebase-design, grilling, domain-modeling
tdd                              -> requires: codebase-design
wayfinder                        -> requires: grilling, domain-modeling, prototype, research
                                  setup: setup-matt-pocock-skills
implement                        -> requires: tdd, code-review
to-spec                          -> setup: setup-matt-pocock-skills
to-tickets                       -> setup: setup-matt-pocock-skills
code-review                      -> setup: setup-matt-pocock-skills
loop-me                          -> requires: grilling
writing-fragments                -> requires: grilling
setup-ts-deep-modules            -> requires: codebase-design
implement-spec                   -> requires: tdd, code-review
                                  setup: setup-matt-pocock-skills
retro                            -> requires: writing-for-agents
```

Dependency resolution must be recursive, deterministic, deduplicated, cycle-checked, and explainable. Preserve a reason chain for each added skill and fail before writing if any node is missing.

Do not infer dependencies at runtime by grepping prose. Review and update this catalog during every upstream bump.

## Harness Adapters

A harness adapter owns only detection, destination, aliases, and optional invocation guidance:

```ts
interface HarnessAdapter {
  id: string;
  displayName: string;
  aliases: readonly string[];
  detect(projectRoot: string): Promise<DetectionResult>;
  getSkillRoot(projectRoot: string): string;
  getInvocationHint?(skillName: string): string;
}
```

Keep preset resolution, dependency closure, ownership, copying, and conflict handling outside adapters.

The registry is the source of truth for project-local mappings. Generate the public tables with `pnpm run docs`. Read [docs/harness-audit.md](docs/harness-audit.md) when adding, correcting, or retiring a target; it records evidence and surface applicability.

Rules:

- Use the pinned OpenSpec reference as a baseline; reviewed official documentation or source may correct or retire a stale mapping and add verified targets. Global-only targets and compatibility aliases are unsupported.
- A v1 adapter must resolve beneath the project root. Global-only harness targets are unsupported.
- Detection is advisory; explicit user selection is authoritative.
- Never guess a target path by analogy. Verify it against official documentation or the pinned OpenSpec reference and add fixture tests.
- If several logical harnesses resolve to one physical root, write one tree and record all consumers. Shared roots include `.agents/skills` and `.roo/skills`.
- Preserve original skill names and directory structure:

```text
<skill-root>/<skill-name>/SKILL.md
```

- Do not create symlinks.

## Consumer State and Ownership

Mattpack owns:

```text
.mattpack/
├── config.json
└── lock.json
```

Example intent file:

```json
{
  "schemaVersion": 1,
  "preset": "default",
  "additionalSkills": [],
  "harnesses": ["codex", "opencode"]
}
```

`additionalSkills` records sorted, deduplicated roots explicitly selected on top of the preset. A schema version 1 config without the field means an empty selection.

The generated lock must record at least:

- Mattpack version;
- exact upstream commit;
- canonical preset and resolved root/dependency groups;
- logical harnesses and deduplicated physical roots;
- managed skill directories;
- relative file paths and content hashes.

Place a small `.mattpack-owner.json` sidecar in each managed skill directory. Do not modify upstream `SKILL.md` to add ownership markers.

Ownership rules:

- Existing unowned destination: report conflict; do not overwrite.
- Managed file changed since installation: report conflict; do not overwrite or delete.
- Extra file inside a managed directory: preserve it as user-owned and report divergence.
- `--force`: back up affected bytes under `.mattpack/backups/` before replacement.
- Removal and preset contraction: delete only files whose prior hashes still match the lock.
- Never infer ownership solely because current bytes happen to match upstream.

Repeated installation with unchanged inputs must be a true no-op.

## Install and Update Semantics

Resolve the project root in this order:

1. explicit `--dir`;
2. existing Mattpack project root;
3. Git top-level directory;
4. current working directory.

Before mutation:

1. validate the bundled upstream lock and snapshot;
2. resolve preset roots and aliases;
3. resolve dependency closure and reason chains;
4. resolve selected harnesses and deduplicate physical targets;
5. compare desired files with lock, sidecars, and current bytes;
6. classify additions, unchanged files, managed replacements, managed removals, and conflicts;
7. print or return the complete plan.

Apply through staging and write `.mattpack/lock.json` only after all intended writes succeed. Never leave state claiming ownership of incomplete output.

`mattpack update` reconciles an existing project against the snapshot bundled in the running Mattpack package. It must never mean “fetch current upstream main.”

## CLI Surface

Initial commands:

```text
mattpack [init] [preset]
mattpack inspect [preset]
mattpack list
mattpack update
mattpack doctor
mattpack remove
```

In an interactive terminal, `mattpack init` opens the two-step preset and tool setup TUI. The preset step opens a nested paginated skill catalog for adding explicit roots. An explicit preset starts at the tool step, which may return to an editable preset step. Supplying `--tools` skips the setup TUI, and an omitted preset then resolves to `default`.

Common options:

```text
--dir <path>
--tools <ids>         comma-separated harness ids
--tools all           all supported project-local harnesses
--skills <ids>        comma-separated skill ids added to the preset
--yes
--dry-run
--json
--force
--no-deps             expert-only; warn that the result may be unusable
--help
--version
```

Rules:

- No `--global` in v1.
- `--skills` is accepted by `init` and `inspect`; supplied ids are added to persisted selections, while interactive setup is the removal path.
- Interactive prompts require a TTY.
- In `--json` mode, stdout must remain valid JSON and diagnostics go to stderr.
- Non-interactive ambiguity is an error.
- `inspect` uses the real resolver but never mutates.
- `doctor` detects drift and corruption but does not make surprise repairs.
- `remove` deletes only proven Mattpack-owned bytes.

## Coding Standards

- Use a functional-core, imperative-shell design: input state in, deterministic plan out; filesystem effects at the boundary.
- Normalize and validate all paths before use. Every consumer destination must stay under the project root after realpath resolution.
- Parse untrusted JSON and frontmatter through validation; do not rely on type assertions.
- Use `unknown`, not `any`, at boundaries.
- Use typed domain errors with stable error codes.
- Do not call `process.exit()` below the CLI entry point.
- Do not log from core modules; return structured results to human and JSON renderers.
- Sort externally visible collections deterministically.
- Do not shell out when a reliable Node API exists. When Git is required, pass argument arrays and never interpolate user input into a shell command.
- Add no abstraction until it has at least two real consumers or protects a demonstrated safety boundary.
- Use conventional commits: `type(scope): imperative subject`.

## Testing and Release Gates

Every behavior change requires tests in the same change.

Unit tests must cover:

- preset aliases and dynamic source discovery;
- skill descriptions, preset relationships, and explicit additional roots;
- dependency closure, missing nodes, reason chains, and cycle errors;
- shared physical-target deduplication;
- path containment and traversal rejection;
- ownership classification;
- deterministic plan ordering;
- lock/config validation;
- human and JSON result contracts.

Each harness adapter must pass one shared contract suite covering detection, exact destination, empty install, idempotent reinstall, update, unowned conflict, local modification, safe removal, and coexistence with unrelated files.

Integration tests must cover all presets, aliases, multi-harness installs, shared `.agents/skills`, preset expansion and contraction, force backups, corrupted state, Windows/POSIX paths, and interrupted writes.

Required scripts:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:pack
pnpm check
```

`pnpm test:pack` must build an npm tarball and exercise `init`, `doctor`, idempotent reinstall, and `remove` in a clean temporary project without network access. Verify that the vendored Matt snapshot is included and `references/OpenSpec` is excluded.

An upstream bump or release is incomplete until this package-level smoke test passes.

## Documentation and Licensing

The README must clearly state:

- Mattpack is unofficial and not affiliated with Matt Pocock;
- installation is project-local;
- normal operation uses a bundled fixed upstream commit and does not fetch GitHub;
- preset meanings and dependency additions;
- supported harnesses and destination paths;
- ownership, conflict, backup, update, and removal behavior;
- how to reproduce an older result with `npx @leike0813/mattpack@<version>`.

Maintain `THIRD_PARTY_NOTICES.md` with the bundled `mattpocock/skills` commit and MIT attribution. Mention OpenSpec as a development reference, while making clear that it is not bundled or used at runtime.

## Agent Workflow

### Scheduled Matt skills maintenance

The project owner authorizes the `matt-skills-monitor` skill to audit the observed `mattpocock/skills@main` SHA, update the snapshot/catalog/provenance/tests, commit and push its maintenance branch normally, and create or update a draft PR. Reviewed upstream removals, renames and dependency changes are within this authority; `default` and `general` remain curated allowlists.

Run in a dedicated clean linked worktree under a whole-run repository lock. Orca launches `omp`; the coordinator model is `minimax-code-cn/MiniMax-M3.1-Flash-Preview` with high reasoning, configured in that worktree's `.omp/config.yml`. Bind the `task`, `smol`, and `slow` model roles to the same model for bounded native workers and independent reviewers; verify the selected agent's role and resolved model before delegation. Orca registration and model configuration are covered in [docs/automations.md](docs/automations.md). Initial registration stays disabled until manually enabled after acceptance.

Maintenance must preserve unrelated files and offline consumer operation. It cannot merge, publish npm, change package versions, install dependencies, advance the OpenSpec pin, force-push, reset user work or execute upstream scripts. Unresolved semantic or license changes produce a blocked report. Read [.agents/skills/matt-skills-monitor/SKILL.md](.agents/skills/matt-skills-monitor/SKILL.md) before starting or recovering a run.

### npm release authority

Follow [docs/releases.md](docs/releases.md) for every npm release. Release preparation and version changes require a maintainer; publish only by pushing a fresh stable `vX.Y.Z` tag from merged `main`, after verifying that the exact version is unpublished. The Matt skills maintenance automation never changes package versions, creates release tags, or publishes npm.

Before changing code:

1. Read this file.
2. Read the relevant source-of-truth catalog, lock, or adapter.
3. Inspect `references/OpenSpec` only for adapter, detection, or ownership design questions.
4. Inspect the vendored Matt snapshot only for upstream layout, preset, or dependency questions.
5. State assumptions that change user-visible behavior.

While changing code:

- keep the requested scope narrow;
- add tests with implementation;
- preserve offline operation and deterministic output;
- never broaden `default` or `general` automatically;
- never advance upstream or submodule pins as incidental cleanup;
- never edit vendored or consumer-facing skill bodies;
- never add a harness without contract fixtures.

Before declaring completion:

1. run focused tests while iterating;
2. run `pnpm check`;
3. run `pnpm test:pack` for changes to packaging, vendoring, CLI behavior, paths, adapters, ownership, or reconciliation;
4. inspect `git diff` for accidental vendor or submodule changes;
5. report any gate that could not be run.

Compilation alone is not completion.

## Definition of Done for v1

Mattpack v1 is ready when:

- `npx @leike0813/mattpack@<version> init` works in a clean project;
- all canonical presets resolve against the pinned snapshot as defined here;
- dependency additions are complete and visible;
- prioritized harnesses work through adapters, including shared `.agents/skills`;
- normal operation is offline and deterministic per package version;
- repeated installation is a no-op;
- unowned files and local edits are preserved by default;
- forced replacement creates a recoverable backup;
- update, preset contraction, and removal delete only proven Mattpack-owned bytes;
- `doctor` identifies drift without surprise repair;
- Linux, macOS, and Windows behavior is tested;
- the packed npm artifact passes the end-to-end smoke test;
- upstream and OpenSpec pins are explicit and licensing obligations are satisfied.

Prefer a smaller, deterministic, safe v1 over broad but weakly tested feature coverage.

## Related References

- Matt Pocock skills: <https://github.com/mattpocock/skills>
- OpenSpec: <https://github.com/Fission-AI/OpenSpec>
- Agent Skills specification and examples: <https://agentskills.io/>
- Skills installer ecosystem: <https://skills.sh/>

References are inputs to judgment, not authorities over Mattpack's product contract.
