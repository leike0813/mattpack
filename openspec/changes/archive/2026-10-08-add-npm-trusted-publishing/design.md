# Design

## Context

See proposal.md. CI already validates three operating systems on Node 24 and runs compiled tests and offline package smoke on Node 20. npm currently serves 0.1.3. bumpp is already installed and defaults to commit, tag and push before the trailing README generation in the existing command.

## Goals / Non-Goals

Deliver a tokenless stable-tag release path and a safe manual rehearsal. No automatic version selection, main-merge publishing, npm release during implementation, dependency installation, or changes to Matt skills automation authority.

## Decisions

- Add workflow_call to CI so publish.yml waits for the exact existing matrix rather than maintaining another copy. Normal branch/PR CI remains enabled.
- publish.yml accepts stable version-tag pushes and workflow_dispatch. A small tested release validator rejects mismatched package/tag versions; a Git ancestor check requires tagged source in origin/main. Manual and relevant PR execution only perform npm publish --dry-run --force so rehearsal works for an already published version. Actual publication retains npm's version checks.
- Use Ubuntu GitHub-hosted Node 24 with a compatible bundled npm CLI, job-scoped id-token:write and read-only repository access. The npm trusted workflow is publish.yml, without a GitHub environment field, avoiding a second configuration prerequisite. Publish with public access and provenance.
- Keep bumpp, disable its commit/tag/push and lifecycle scripts, and execute an existing pnpm command to regenerate docs and run check after the version change. Maintainers review and commit the exact release files, merge as needed, then tag the accepted source.
- Record GitHub repository metadata in package.json. Release docs carry npm setup and recovery instructions; bilingual README links are generated from the existing source.

## Risks / Trade-offs

- npm trust requires owner interaction on npmjs.org; a dry-run does not prove OIDC authorization. The first genuine new-version release provides that proof.
- Already published versions cannot be replaced. Re-running a successful publication can fail; inspect npm before retrying or choosing a new version.
- Preparation failure can leave a bumped package and generated docs for inspection. No rollback, commit or remote action is hidden in preparation.
- Tags intentionally control releases; ordinary maintenance PRs still require a maintainer release decision.

## Migration Plan

Merge workflow and metadata; configure npm owner leike0813, repository mattpack and workflow publish.yml. Rehearse without publication, prepare an unpublished stable version, review/merge release changes, and push its matching tag. Disable trusted publishing or remove the workflow to stop future releases; published immutable versions remain available.
