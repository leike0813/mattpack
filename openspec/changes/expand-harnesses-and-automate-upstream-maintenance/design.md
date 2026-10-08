# Design

## Context

See proposal.md for motivation. The registry already centralizes target definitions, the planner handles root contraction, and the sync/validate/docs/check scripts own snapshot and package integrity. The wiki is evidence for development decisions, never a consumer dependency.

## Goals / Non-Goals

**Goals:** Extend the registry and preserve ownership during target changes; provide an isolated daily upstream audit with deterministic observation, locking and reports, semantic review, and draft-PR delivery.

**Non-Goals:** A general scheduler, database, compatibility transpiler, dependency updater, consumer networking, auto-merge, npm publication, or changing either pin during this feature.

## Decisions

### Keep harness behavior in the existing registry and planner

Add amp/codebuff/warp/replit-agent at .agents/skills; autohand at .autohand/skills; deep-agents at .deepagents/skills; deepseek-harness at .dsh/skills; goose at .goose/skills; grok at .grok/skills; minimax-code at .minimax/skills; openhands at .openhands/skills; prime-agent at .prime/agent/skills; sourcecraft-code-assistant at .codeassistant/skills; zoo-code at .roo/skills. Keep roocode canonical and label it Roo Code. Correct CoStrict and Kilo roots and remove amazon-q. Keep the four reference-backed targets not covered by the wiki. Detection uses established root/parent paths; Warp additionally uses WARP.md. No adapter or consumer schema changes are needed.

Root moves become normal additions and managed removals. Do not introduce a migration engine or silently drop retired stored selections. Existing remove remains usable for retired IDs.

### Use one development lifecycle module and CLI

Expose upstream:monitor start/status/finish/recover. start takes owner PID and optional base ref (origin/main by default), validates a clean linked worktree, obtains a repository-wide exclusive lock, observes upstream main exactly once, and creates/reuses a maintenance branch. Fetch exact commits into an owned temporary Git checkout for diff/changelog evidence. Return a JSON handoff with run ID, branch, pinned/target SHAs and audit path. Never modify the upstream lock during observation.

The lock lives under the repository's common Git directory so linked worktrees share it. Filesystem directory claims are exclusive. Recovery is explicit, checks dead owner and matching run ID, serializes recovery and claim/release, and never reclaims incomplete metadata automatically. Reports live in ignored var/matt-skills-monitor; temporary checkout cleanup is constrained to the run's recorded owned path.

finish accepts a validated result file with outcome noop/draft_pr/blocked/failed, writes an atomic report and releases only its matching session. Live owners, malformed state, dirty worktrees, failed PR queries and unexpected remote identity fail closed. No-op runs never create commits or PRs. Preserve failed work for diagnosis rather than resetting it.

### Put semantic maintenance in one coordinator skill

Use a script-assisted skill with complete I/O, authorization, recovery and completion rules inline. It reads the handoff, reviews all upstream differences, and invokes the existing upstream-bump instructions with the exact observed SHA. Reviewed removals/renames and dependency changes can be drafted; new stable skills never automatically expand default/general. License or unresolved semantic changes block publication.

Native workers have bounded ownership, and a separate reviewer inspects completed changes. Only after workers stop and validate:upstream, check, and diff checks pass may the coordinator commit, push normally, and create/update its draft PR. Never force-push, alter package version, merge, release, touch unrelated state, or execute upstream scripts.

### Keep Orca configuration local and disabled

Use one fixed dedicated monitor worktree and an existing-workspace daily task, 02:00 Asia/Shanghai, fresh sessions, Codex provider, MiniMax-M3.1-Flash-Preview/high coordinator. Reuse existing role models and already installed dependencies. Keep model configuration and registration IDs in ignored local files. First acceptance uses the feature commit as an explicit base; restore origin/main afterward and keep the schedule disabled until the feature is merged and the owner enables it.

## Risks / Trade-offs

- Retired Amazon Q configs block update/doctor: document explicit re-selection or ownership-safe remove; do not claim uninvestigated IDE support.
- Root migration leaves local bytes at the old root: preserve and report them using existing ownership rules.
- Fixed-source knowledge is not binary compatibility proof: record source/surface applicability and retain unchanged upstream skill content.
- Interrupted runs leave locks or dirty branches: expose status and explicit dead-owner recovery, retaining evidence and refusing destructive cleanup.
- Local main is ahead of origin/main: carry the already completed local commit into the feature branch and report that prerequisite in the PR.

## Migration Plan

Complete planning artifacts, implement in the isolated feature worktree, extend focused tests, regenerate documentation, and run all gates. Commit and push a draft PR. Create the dedicated monitor worktree, reuse installed dependencies, exercise a real no-op Orca run against the feature commit, restore daily origin/main configuration and verify disabled state. Leave the change active and checked; archiving is a separate operation.
