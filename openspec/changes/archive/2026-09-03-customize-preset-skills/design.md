## Context

See `proposal.md` for motivation. Preset roots currently flow directly into one deterministic dependency resolver, while the setup prompt owns a two-step raw-keypress state machine. Consumer intent is stored in `config.json`; the lock stores derived roots and file hashes. The package must remain offline and free of installed runtime dependencies.

## Goals / Non-Goals

**Goals:**

- Add one explicit-root input without creating a second resolution path.
- Keep Preset and Tools as the two main prompt steps while making the complete pinned skill catalog inspectable and editable.
- Preserve explicit selections across preset changes and later reconciliation.
- Keep matrix, output, and persisted collections deterministic.

**Non-Goals:**

- Remove individual preset roots or dependencies.
- Add a marketplace, remote lookup, YAML dependency, or runtime catalog mutation.
- Add CLI syntax for removing persisted additional roots; interactive setup owns removal.
- Change `list` output or vendored skill bodies.

## Decisions

1. **Union roots before the existing resolver.** `additionalSkills` is normalized and combined with `presetRoots`; the existing resolver remains responsible for validation, dependencies, cycles, reason chains, and deduplication. This avoids a parallel custom-install path.

2. **Keep explicit intent only in config.** `config.json` gains `additionalSkills`; `lock.json.roots` remains the derived combined root set. Schema version 1 accepts a missing field as `[]`, matching the existing optional-field pattern without duplicating intent across state files.

3. **Treat `--skills` as additive.** On `init` and `inspect`, supplied IDs are unioned with persisted selections. `inspect` never writes. CLI removal syntax is omitted; an interactive `init` pre-selects the stored set and allows toggling it. Unknown user roots receive `UNKNOWN_SKILL`, distinct from a missing dependency in the curated graph.

4. **Derive one prompt DTO from the core catalog.** The upstream record gains its validated frontmatter description. A deterministic service helper computes each skill's five preset relations using `presetRoots` and `resolveSkillSet`, so the prompt neither reads files nor duplicates dependency logic. `list` retains its current public contract.

5. **Add a nested prompt state, not a third setup step.** The state machine has `preset`, `skills`, and `tools` views, but the header remains Preset → Tools. `S` enters Skills from Preset; Skills returns to Preset; Tools returns to an editable Preset even when a positional preset supplied the initial value.

6. **Use responsive, height-bounded rendering.** Wide rows display selection, name, description, and the five-column `R`/`D`/`·` matrix. Narrow rows keep names compact and show the active skill's full detail below. Page size is derived from terminal height; selection index determines the page, and PageUp/PageDown move by one page. The existing ANSI and `NO_COLOR` gates remain authoritative.

7. **Test stable state rather than screen prose.** Pure prompt choice, relation, pagination, and transition helpers cover navigation and persistence. Integration and CLI tests cover installed results and errors without snapshotting complete ANSI frames.

## Risks / Trade-offs

- **Long descriptions can wrap differently across terminals** → truncate aligned wide rows and render the active description in a width-bounded detail area while tracking the actual prompt line count.
- **A sticky root may currently be redundant with its preset** → preserve it in config intentionally and deduplicate only the resolved output, so later preset contraction does not silently drop explicit intent.
- **The catalog is loaded once for interactive metadata and again for planning** → accept the small offline read of 37 bundled skills rather than adding cache state or widening installation APIs.
- **CLI-only users cannot remove one persisted root** → document rerunning interactive `init`; add removal syntax only if a demonstrated automation need appears.

## Migration Plan

Read old schema version 1 configs with `additionalSkills: []`; new writes include the normalized field. Older Mattpack versions can parse the config but do not preserve this intent during reconciliation, so projects using additional skills should keep using this or a later version. No state rewrite is needed before the first new installation plan.
