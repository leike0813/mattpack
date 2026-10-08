# Proposal

## Why

Mattpack still bundles the August 24 upstream snapshot. The audited October 8 snapshot promotes two skills, adds two skills, removes a default root, and changes the domain-document convention; copying it without aligning the catalog would break validation and preset resolution.

## What Changes

- Pin and regenerate the complete upstream snapshot at `b0618bc436ad893b3c5e84e55fba86586d34a404`, preserving upstream bytes and attribution.
- Align catalog validation with the reviewed buckets and plugin manifest. Let dynamic presets include `pr`, `chief-of-staff`, and the promoted `implement-spec` and `retro` according to their buckets.
- **BREAKING**: Remove the deleted `resolving-merge-conflicts` root from `default`. Keep the remaining default roots and the general preset unchanged.
- Complete `implement-spec` dependencies with `tdd`, `code-review`, and the setup companion; preserve its explainable transitive closure.
- **BREAKING**: Document the upstream `GLOSSARY.md` / `GLOSSARY-MAP.md` convention, changes to beta roots, and recovery from a removed explicitly selected skill. Consumer documents and explicit selections remain under user control.
- Verify upgrades across bucket moves, resource renames, and removed skills with existing ownership and reconciliation rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-resolution`: Align the current snapshot's presets and explicit dependency contract, replacing the bootstrap-count reference with the current pinned catalog.
- `safe-reconciliation`: Specify the observable upgrade behavior for moved sources, renamed resources, and removed managed skills while retaining local bytes and rejecting invalid stored roots before mutation.

## Impact

Changes affect `upstream.lock.json`, generated vendor files, `src/catalog/`, focused catalog and lifecycle tests, `AGENTS.md`, README generation, third-party notices, and release notes. The existing offline resolver, harness adapters, planner, transactional apply path, and consumer schema remain the implementation boundaries. The OpenSpec reference pin, consumer installations, dependencies, and Git history are outside this change.
