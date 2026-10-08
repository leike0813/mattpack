# npm releases

Mattpack publishes from stable `vX.Y.Z` tags through `.github/workflows/publish.yml`. The package name and version in `package.json` must match the tag (`v` plus the exact package version), and the tagged commit must be an ancestor of `origin/main`. The workflow validates that identity before publishing.

## Configure npm Trusted Publishing once

After the publishing workflow has been merged, configure the npm package at **@leike0813/mattpack → Settings → Trusted publishing**:

- Provider: GitHub Actions
- Owner: `leike0813`
- Repository: `mattpack`
- Workflow filename: `publish.yml`
- Environment: leave blank

The current [npm Trusted Publishers documentation](https://docs.npmjs.com/trusted-publishers) says new connections default to staged publishing. If npm offers the option, explicitly allow `npm publish` so the workflow can publish. The publisher job uses GitHub-hosted Ubuntu, Node.js 24, npm 11.5.1 or newer, and `id-token: write`; it uses no `NPM_TOKEN`. It runs `npm publish --access public --provenance --ignore-scripts`.

## Prepare a release

Start from a clean release branch. Run the version bump with an explicit version increment:

```sh
pnpm release:bump --release patch --yes
```

Use `minor` or `major` when appropriate. The command runs `bumpp` with Git checks and without committing, tagging, pushing, or running lifecycle scripts. Its release preparation command regenerates both READMEs and runs `pnpm check`. Preparation failures can leave generated or version edits in the worktree; inspect and resolve them explicitly, with no automatic rollback.

Review `package.json`, `README.md`, and `README.zh-CN.md`. Commit exactly those files (do not stage the entire worktree), then open a PR and merge it. The reusable CI checks run on Linux, macOS, and Windows using Node.js 24, with compiled tests and the offline package smoke test also run on Node.js 20. Manual `workflow_dispatch` and relevant pull requests also run `npm publish --dry-run --force`; `--force` lets this publish-free rehearsal use an already published version. This checks package preparation but does not prove that npm authentication or Trusted Publishing is configured. Actual publication omits `--force` and retains npm's version checks.

To rehearse the merged workflow without publication:

```sh
gh workflow run publish.yml --ref main
```

## Publish

After the PR is merged, start from a fresh checkout of `main`. Confirm that `package.json` contains the intended version and check `npm view @leike0813/mattpack versions --json`: npm versions are immutable and cannot be republished. Choose a version absent from that list.

Create and push only the matching stable tag:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

Replace `X.Y.Z` with the exact `package.json` version. The workflow checks that the tag points to a commit in `origin/main`, builds and verifies the release identity, then publishes with provenance. If a run fails, inspect the npm package's published versions and the workflow logs before retrying the run; never retry a version that npm already lists or move an existing tag to another commit.

The scheduled Matt skills maintenance process may update the upstream snapshot and create a draft PR, but it never bumps package versions, creates release tags, or publishes npm.
