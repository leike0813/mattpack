# Tasks

## 1. Harness targeting

- [x] 1.1 Extend and correct the registry; verify exact destinations, 51 logical / 43 physical targets, detection, shared .agents/.roo consumers and every adapter's shared contract.
- [x] 1.2 Extend lifecycle coverage for corrected-root migration, user-byte preservation, new-root conflicts and retired Amazon Q recovery; add evidence and bilingual migration guidance and verify focused tests/docs generation.
- [x] 1.3 Extend offline packed smoke to codex/minimax-code/warp and exclude maintenance artifacts; verify pack checks.

## 2. Development maintenance

- [x] 2.1 Implement lifecycle module and CLI with clean linked-worktree checks, shared whole-run locking, fixed observation, branch/PR selection, structured status/reports and explicit recovery; verify fixture-driven no-op/update, contention, recovery and failure tests.
- [x] 2.2 Add coordinator skill, standing authorization, local configuration and operating documentation; verify workflow examples and independent review without static skill-text assertions.

## 3. Delivery acceptance

- [x] 3.1 Run focused checks, pnpm check, OpenSpec strict validation and independent review; verify pins, vendor bytes, dependency lock and original worktree are unchanged by this feature.
- [x] 3.2 Commit and push only the isolated feature scope and create a draft PR; verify the PR and report its already-completed local-main prerequisite.
- [x] 3.3 Register the dedicated disabled Orca task, reuse installed dependencies, complete a real first run using the feature commit, restore origin/main daily configuration and verify model/timezone/disabled state and structured noop report.

## Acceptance evidence

- Final `pnpm check`: 103 tests passed, including every harness contract, lint/typecheck/build, offline packed smoke and generated-doc checks.
- OpenSpec strict validation and independent read-only review passed. Pins/vendor/dependency lock are unchanged relative to the feature baseline `f81a32c`; the original workspace's existing ignore-file edit remains untouched.
- Draft PR: https://github.com/leike0813/mattpack/pull/1. It includes the already completed local-main prerequisite `f81a32c`, disclosed in the PR.
- Real fresh-session acceptance against feature commit `2b997fa072603a63b454bc9ad9d5db4728630f6e`: actual MiniMax-M3.1-Flash-Preview/high, monitor run `18080dad-497f-4087-8f11-519571cf74fc`, single observation, outcome `noop`, pinned/target `b0618bc436ad893b3c5e84e55fba86586d34a404`, lock released and clean worktree.
- Final Orca settings: default `origin/main`, daily 02:00 Asia/Shanghai, fresh sessions, disabled. Machine-local IDs and reports remain ignored.

## Workflow follow-up

- Merge the feature PR before enabling the daily task. Merge future maintenance drafts manually.
- Archive this completed change only when explicitly requested.
