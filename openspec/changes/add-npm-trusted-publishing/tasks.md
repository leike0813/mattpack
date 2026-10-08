# Tasks

## 1. Release boundary

- [x] 1.1 Add matching stable-tag validation and package repository metadata; verify matching tags, mismatches, malformed metadata and prerelease rejection with focused behavior tests.
- [x] 1.2 Make release:bump prepare version/docs/check without commit, tag, push or dependency installation; exercise preparation in a disposable fixture and document review/tag commands.

## 2. Publishing integration

- [x] 2.1 Add reusable platform CI and publish.yml with a main-ancestor gate, tokenless OIDC/provenance publishing, and publish-free PR/manual rehearsals; validate workflow syntax and packed dry-run.
- [x] 2.2 Document exact npm Trusted Publisher setup and rehearsal limitations; regenerate bilingual README, verify docs and preserve maintenance automation boundaries.

## 3. Delivery validation

- [ ] 3.1 Run pnpm check, OpenSpec strict validation, independent review and GitHub PR checks; verify source pins, vendor, dependency lock, package version and original worktree edits remain unchanged.

## Workflow follow-up

- Owner configures npm Trusted Publisher after publish.yml is merged; enable the allowed npm publish action when offered by npm.
- Prepare/review an unpublished stable version and push its matching tag to verify actual OIDC authentication and publication; dry-run does not establish that proof.
- Archive only when explicitly requested.
