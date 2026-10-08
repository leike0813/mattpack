# Changelog

## Unreleased

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
