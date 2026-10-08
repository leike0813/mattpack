# Spec Delta

## MODIFIED Requirements

### Requirement: Package contents
The npm artifact SHALL include compiled runtime code, package metadata, documentation, licenses, upstream.lock.json, and the pinned vendored snapshot, and SHALL exclude references/OpenSpec, maintenance scripts, coordinator skills, local automation configuration, reports, and other development-only artifacts.

#### Scenario: Packed file list is inspected
- **WHEN** pnpm test:pack reads npm's packed-file manifest
- **THEN** required vendor files are present and development maintenance artifacts and the OpenSpec reference are absent

## ADDED Requirements

### Requirement: Offline expanded harness smoke test
The packed CLI SHALL install new independent and shared-root harnesses with no network access and preserve healthy diagnosis, idempotent reinstall, and ownership-safe removal.

#### Scenario: New and shared targets are selected
- **WHEN** the packed CLI installs general for codex, minimax-code, and warp in a clean offline project
- **THEN** it creates two physical skill roots, records all three consumers, diagnoses healthy, reinstalls without changes, and removes proven owned bytes
