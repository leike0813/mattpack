# Changelog

## Unreleased

- Advance the bundled `mattpocock/skills` snapshot from
  `5beb35b040e3de97e54fa9e386d7e42d15c295c2` to
  `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`. Mattpack still resolves the exact
  bundled commit offline. [Upstream diff](https://github.com/mattpocock/skills/compare/5beb35b040e3de97e54fa9e386d7e42d15c295c2...4ae2317ddb22b046e26455e4f9c9b3aaaf62212d).
- Upstream adds the beta `software-factory` skill, a glossary for designing a
  software factory: the tasks it runs, the services they plug into, and product
  surveys for each slot. It enters the dynamic `beta-only` and `everything`
  presets only. The stable skill count stays at 27, so `full` and the curated
  `default` and `general` allowlists are unchanged.
- Upstream gives `chief-of-staff` a procedures section that reads `retro`,
  `to-spec`, `to-tickets`, and `implement-spec` from sibling skill
  directories. The reviewed dependency catalog gains one edge,
  `chief-of-staff -> requires: implement-spec, retro, to-spec, to-tickets`, so
  `beta-only` resolves those skills and their own dependencies instead of
  pointing at files that are not installed.
- Upstream tells the skills that dispatch subagents (`implement-spec`,
  `code-review`, `codebase-design`, `improve-codebase-architecture`, `wayfinder`,
  `research`, `grilling`, `chief-of-staff`) to start each one with a fresh
  context window instead of forking the current conversation. This is prose
  guidance inside the vendored skills and changes no Mattpack behavior.
- Upstream refreshes the `setup-matt-pocock-skills` tracker templates: a
  reachable repository is required before a GitHub or GitLab tracker is
  written, legacy `CONTEXT.md` and `CONTEXT-MAP.md` files are offered a rename
  to the `GLOSSARY` names, issues are filed only into the user's own
  repository, and GitHub blocking dependencies use the native issue
  dependency API.

### Consumer migration

`mattpack update` installs the beta `software-factory` skill for `beta-only`
and `everything` consumers and replaces the vendored bytes of the skills that
changed, including `skills/in-progress/chief-of-staff/SKILL.md`. `beta-only`
now resolves 18 skills instead of 9, because `chief-of-staff` pulls in the
procedures it reads from sibling directories; `everything` resolves 39 skills
instead of 38. The `default`, `general`, and `full` presets are unchanged.

No skill was removed, renamed, or moved, and no ownership, path, or offline
behavior changed.

## 0.1.7

- Advance the bundled `mattpocock/skills` snapshot from
  `49dd158d1076134a641b33efb035946536778336` to
  `5beb35b040e3de97e54fa9e386d7e42d15c295c2`. Preset roots, dependency edges,
  expected counts, and licensing are unchanged; the only vendored difference is
  prose inside the beta `chief-of-staff` skill. Mattpack still resolves the exact
  bundled commit offline. [Upstream diff](https://github.com/mattpocock/skills/compare/49dd158d1076134a641b33efb035946536778336...5beb35b040e3de97e54fa9e386d7e42d15c295c2).
- Upstream teaches `chief-of-staff` to keep its memory in a wiki of interlinked
  pages and to write dated, commit-cited history instead of present-tense claims.
  The reviewed dependency catalog is unchanged: the new prose mentions `retro`
  and `writing-for-agents` only inside an example commit citation, and the
  existing `retro` requires `writing-for-agents` edge already covers that relation.

### Consumer migration

No skill was added, removed, renamed, or moved, and no preset, dependency,
ownership, or path behavior changed. `mattpack update` replaces
`skills/in-progress/chief-of-staff/SKILL.md` with the newly pinned bytes.

## 0.1.6

- Advance the bundled `mattpocock/skills` snapshot from
  `b0618bc436ad893b3c5e84e55fba86586d34a404` to
  `49dd158d1076134a641b33efb035946536778336`. Preset roots, dependency edges,
  expected counts, and licensing are unchanged; the only vendored difference is
  `wizard`'s `template.sh`. Mattpack still resolves the exact bundled commit
  offline. [Upstream diff](https://github.com/mattpocock/skills/compare/b0618bc436ad893b3c5e84e55fba86586d34a404...49dd158d1076134a641b33efb035946536778336).
- Upstream fixes `wizard` template handling: Enter-keeps-current no longer
  stores quotes from a double-quoted `.env` value, stages run inside
  `run_wizard` so editing the template mid-run cannot break a running wizard,
  screen clearing falls back to ANSI when `tput clear` fails, `write_env` also
  sets the shell variable, and an unused color variable is dropped.
- Mattpack applies the authorized `wizard-empty-input.patch` to the pinned
  template. `ask` and `ask_secret` reject empty input when an existing
  double-quoted `.env` value contains a backslash, `$`, or an embedded double
  quote and cannot be decoded safely. The wizard stops before `write_env`
  can replace that value, including in CRLF `.env` files. Patch sources retain
  LF line endings on Windows. Normal Enter-keeps-current, non-empty replacement,
  and EOF behavior are preserved.
- Upstream documents that `retro` always loads `writing-for-agents`, including
  when it only reads and reports. The reviewed `retro` dependency edge stands.

### Consumer migration

No skill was added, removed, renamed, or moved, and no preset,
dependency, ownership, or path behavior changed. `mattpack update` replaces
`wizard`'s `template.sh` with the pinned template after the authorized
Mattpack patch is applied.

Existing generated wizard scripts and `.env` files are not rewritten by Mattpack.
Regenerate an existing wizard script to receive the empty-input fix. `.env`
files remain unchanged by the update itself.

## 0.1.4

- Add npm Trusted Publishing with provenance after the platform and Node.js
  compatibility gates pass. Version preparation updates the README and runs
  checks before maintainers create a release commit or tag.

- Expand harness support with verified project targets, including MiniMax Code,
  Warp, Amp and Replit Agent. Correct CoStrict and Kilo Code roots, distinguish
  Roo Code from Zoo Code, and retire the unverified Amazon Q CLI target.
  Preview root migrations with `update --dry-run`; local modifications remain
  preserved. See [audit evidence](docs/harness-audit.md) and README recovery steps.
- Add development-only Matt skills auditing with fixed-SHA observations,
  repository-wide run locking and draft-PR maintenance. The Orca schedule is
  registered disabled; consumer commands and npm contents stay offline.

The bundled `mattpocock/skills` snapshot advances from
`6654f6b60cd9d5be8b54c6fafe44346dabeb3b76` to
`b0618bc436ad893b3c5e84e55fba86586d34a404`. The target includes upstream plugin
1.3.1 and subsequent fixes; Mattpack still resolves the exact bundled commit
offline. [Upstream diff](https://github.com/mattpocock/skills/compare/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76...b0618bc436ad893b3c5e84e55fba86586d34a404).

- `implement-spec` and `retro` are now stable. `full` also gains the new `pr`
  skill; `beta-only` gains `chief-of-staff`. `everything` includes all four.
- Upstream removed `resolving-merge-conflicts` without a replacement. It leaves
  `default`, whose other roots are unchanged. New skills do not automatically
  enter `default` or `general`.
- Selecting `implement-spec` now includes its TDD and review dependencies and
  setup companion, with recursive `codebase-design` installation.
- Upstream fixes cover review standards discovery, proving a forced failing
  repro, tracker commands and labels, ticket relationships, handoff quoting,
  wizard input and environment-file handling, and teaching workspace paths.
- Upstream has frozen maintenance of `misc` skills. They remain available in
  `everything` under Mattpack's existing preset policy.

### Consumer migration

Upgrade the Mattpack package before running `mattpack update`; that command
uses the snapshot in the running package. Preview its real plan with
`mattpack update --dry-run`.

Skills now read and write `GLOSSARY.md` and `GLOSSARY-MAP.md`. Rename existing
`CONTEXT.md` / `CONTEXT-MAP.md` documents as appropriate, including per-context
files and links inside the map, and update navigation pointers in your project
instructions and generated domain configuration. Mattpack manages skill trees
and its own state, so it leaves those documents untouched.

If `additionalSkills` in `.mattpack/config.json` contains
`resolving-merge-conflicts`, remove that entry before retrying `update` or
interactive `init`; both validate stored roots. An invalid stored root returns
`UNKNOWN_SKILL` before writes. Preserve all other selections and configuration.

To keep the promoted skills in a beta-only installation, run
`mattpack init beta-only --tools <your-tools> --skills implement-spec,retro --yes`.
Their names and consumer directories are unchanged by promotion. Normal update
preserves locally modified and unrelated files; use the reported conflict and
backup behavior when reviewing changes.
