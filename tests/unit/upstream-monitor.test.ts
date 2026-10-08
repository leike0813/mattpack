import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { MonitorError, runUpstreamMonitor, type MonitorCommandRunner } from "../../scripts/lib/upstream-monitor.js";

const roots: string[] = [];
const mattpackOrigin = "https://github.com/leike0813/mattpack.git";
const skillsOrigin = "https://github.com/mattpocock/skills.git";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("explicit recovery reclaims only an interrupted guard with a matching dead run owner", async () => {
  const f = await fixture();
  const execute = f.runner();
  const session = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute });
  const runId = String(session.runId);
  const lockDir = path.join(f.common, "mattpack-upstream-monitor");
  const lockPath = path.join(lockDir, "active.json");
  const active = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown>;
  active.ownerPid = 2_147_000_000;
  await writeFile(lockPath, JSON.stringify(active));
  const guard = path.join(lockDir, "guard");
  await mkdir(guard);
  const ownerFile = path.join(guard, "owner.json");
  await writeFile(ownerFile, JSON.stringify({ pid: process.pid }));
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute }), "LOCK_BUSY");
  await writeFile(ownerFile, "{");
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute }), "LOCK_CORRUPT");
  await writeFile(ownerFile, JSON.stringify({ pid: 2_147_000_000 }));
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId: randomUUID() }, { cwd: f.linked, execute }), "RUN_MISMATCH");
  const attempts = await Promise.allSettled([
    runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute }),
    runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute })
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await runUpstreamMonitor({ command: "status" }, { cwd: f.linked, execute })).active, null);
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(cwd: string, message: string): string {
  git(cwd, "add", "--all");
  git(cwd, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

interface Fixture {
  root: string;
  primary: string;
  projectSeed: string;
  linked: string;
  common: string;
  projectBare: string;
  upstreamBare: string;
  pinned: string;
  target: string;
  runner: (options?: { observed?: string; prs?: string; failGh?: boolean }) => MonitorCommandRunner;
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-monitor-test-"));
  roots.push(root);
  const upstreamSeed = path.join(root, "upstream-seed");
  const upstreamBare = path.join(root, "upstream.git");
  const projectSeed = path.join(root, "project");
  const projectBare = path.join(root, "project.git");
  const linked = path.join(root, "linked");
  for (const directory of [upstreamSeed, projectSeed]) {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(directory));
    git(root, "init", "--initial-branch=main", directory);
  }
  git(upstreamSeed, "config", "user.name", "Fixture");
  git(upstreamSeed, "config", "user.email", "fixture@example.test");
  await writeFile(path.join(upstreamSeed, "skill.md"), "pinned bytes\n");
  const pinned = commit(upstreamSeed, "pinned");
  await writeFile(path.join(upstreamSeed, "skill.md"), "target bytes\n");
  await writeFile(path.join(upstreamSeed, "new.md"), "new file\n");
  const target = commit(upstreamSeed, "target");
  git(root, "init", "--bare", upstreamBare);
  git(upstreamSeed, "remote", "add", "origin", upstreamBare);
  git(upstreamSeed, "push", "origin", "main");

  await writeFile(path.join(projectSeed, "upstream.lock.json"), JSON.stringify({
    schemaVersion: 1,
    upstreams: { "mattpocock/skills": { repository: skillsOrigin, commit: pinned, vendorPath: "vendor/mattpocock-skills", license: "MIT" } }
  }));
  await writeFile(path.join(projectSeed, ".gitignore"), "var/matt-skills-monitor/\n");
  commit(projectSeed, "project");
  git(root, "init", "--bare", projectBare);
  git(projectSeed, "remote", "add", "origin", projectBare);
  git(projectSeed, "push", "origin", "main");
  git(root, "--git-dir", projectBare, "worktree", "add", "-b", "monitor-fixture", linked, "main");
  const common = git(linked, "rev-parse", "--git-common-dir");
  const commonDir = path.resolve(linked, common);

  return {
    root, primary: projectSeed, projectSeed, linked, common: commonDir, projectBare, upstreamBare, pinned, target,
    runner: ({ observed = pinned, prs = "[]", failGh = false } = {}) => async (program, args, cwd) => {
      if (program === "gh") {
        if (failGh) throw new Error("mock GitHub query failed");
        return prs;
      }
      if (program === "git" && args[0] === "remote" && args[1] === "get-url") return mattpackOrigin;
      if (program === "git" && args[0] === "fetch" && args[1] === "origin"
          && args[2] === "refs/heads/main:refs/remotes/origin/main") {
        return execFileSync("git", ["fetch", projectBare, "refs/heads/main:refs/remotes/origin/main"], { cwd, encoding: "utf8" }).trim();
      }
      if (program === "git" && args[0] === "ls-remote") return `${observed}\trefs/heads/main`;
      if (program === "git" && args[0] === "fetch" && args[1] === "origin" && typeof args[2] === "string" && args[2].startsWith("refs/heads/")) {
        return execFileSync("git", ["fetch", projectBare, args[2]], { cwd, encoding: "utf8" }).trim();
      }
      if (program === "git" && args[0] === "--git-dir" && args[2] === "fetch") {
        const mapped = [...args];
        const remoteIndex = mapped.indexOf(skillsOrigin);
        if (remoteIndex !== -1) mapped[remoteIndex] = upstreamBare;
        return execFileSync("git", mapped, { cwd, encoding: "utf8" }).trim();
      }
      return execFileSync(program, [...args], { cwd, encoding: "utf8" }).trim();
    }
  };
}

async function publishDraftBranch(f: Fixture, branch: string, pin: string): Promise<void> {
  git(f.projectSeed, "switch", "-c", branch, "main");
  await writeFile(path.join(f.projectSeed, "upstream.lock.json"), JSON.stringify({
    schemaVersion: 1,
    upstreams: { "mattpocock/skills": { repository: skillsOrigin, commit: pin, vendorPath: "vendor/mattpocock-skills", license: "MIT" } }
  }));
  commit(f.projectSeed, "maintenance draft baseline");
  git(f.projectSeed, "push", "origin", `refs/heads/${branch}`);
  git(f.projectSeed, "switch", "main");
}

function openDraft(branch: string): string {
  return JSON.stringify([{
    state: "OPEN", isDraft: true, url: "https://github.com/leike0813/mattpack/pull/17",
    headRefName: branch, headRepositoryOwner: { login: "leike0813" }
  }]);
}

async function expectCode(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof MonitorError && error.code === code);
}

test("requires a clean linked non-main worktree and a Mattpack origin", async () => {
  const f = await fixture();
  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.primary, execute: f.runner() }), "WORKTREE_REQUIRED");
  await writeFile(path.join(f.linked, "untracked"), "user data");
  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute: f.runner() }), "WORKTREE_DIRTY");
  await rm(path.join(f.linked, "untracked"));
  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, {
    cwd: f.linked,
    execute: async (program, args, cwd) => program === "git" && args[0] === "remote"
      ? "https://example.test/not-mattpack.git" : f.runner()(program, args, cwd)
  }), "ORIGIN_MISMATCH");
});

test("observes a no-op once without fetching upstream source and completes a matching report", async () => {
  const f = await fixture();
  const calls: string[][] = [];
  const baseRunner = f.runner();
  const execute = async (program: string, args: readonly string[], cwd: string) => {
    if (program === "git") calls.push([...args]);
    return baseRunner(program, args, cwd);
  };
  const result = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute });
  assert.equal(result.changed, false);
  assert.equal(calls.filter((args) => args[0] === "ls-remote").length, 1);
  assert.equal(calls.some((args) => args[0] === "--git-dir" && args[2] === "fetch"), false);
  const started = result as { runId: string; auditPath: string; branch: string };
  assert.match(started.branch, /^automation\/matt-skills-monitor\//u);
  assert.equal(JSON.parse(await readFile(started.auditPath, "utf8")).targetCommit, f.pinned);
  const resultFile = path.join(f.root, "result.json");
  await writeFile(resultFile, JSON.stringify({ runId: started.runId, outcome: "noop", summary: "Upstream matches the pin." }));
  const finished = await runUpstreamMonitor({ command: "finish", runId: started.runId, resultFile }, { cwd: f.linked, execute });
  assert.equal(JSON.parse(await readFile((finished as { reportPath: string }).reportPath, "utf8")).outcome, "noop");
  assert.equal((await runUpstreamMonitor({ command: "status" }, { cwd: f.linked, execute }) as { active: unknown }).active, null);
});

test("accepts a full feature SHA as base-ref", async () => {
  const f = await fixture();
  const featureCommit = git(f.linked, "rev-parse", "HEAD");
  const result = await runUpstreamMonitor({ command: "start", ownerPid: process.pid, baseRef: featureCommit }, {
    cwd: f.linked, execute: f.runner()
  });
  assert.equal(result.baseRef, featureCommit);
  assert.equal(result.changed, false);
});

test("reuses the exact open draft branch and reads its pin after checkout", async () => {
  const f = await fixture();
  const branch = `automation/matt-skills-monitor/${randomUUID()}`;
  await publishDraftBranch(f, branch, f.target);
  const result = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, {
    cwd: f.linked, execute: f.runner({ prs: openDraft(branch), observed: f.target })
  }) as { branch: string; pinnedCommit: string; changed: boolean };
  assert.equal(result.branch, branch);
  assert.equal(result.pinnedCommit, f.target);
  assert.equal(result.changed, false);
});

test("starts a fresh base-ref branch when a maintenance PR is closed or merged", async () => {
  for (const state of ["CLOSED", "MERGED"]) {
    const f = await fixture();
    const closed = JSON.stringify([{
      state, isDraft: true, url: "https://github.com/leike0813/mattpack/pull/9",
      headRefName: `automation/matt-skills-monitor/${randomUUID()}`, headRepositoryOwner: { login: "leike0813" }
    }]);
    const result = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, {
      cwd: f.linked, execute: f.runner({ prs: closed })
    }) as { branch: string; pinnedCommit: string };
    assert.match(result.branch, /^automation\/matt-skills-monitor\//u);
    assert.equal(result.pinnedCommit, f.pinned);
  }
});

test("rejects open non-draft maintenance PRs", async () => {
  const f = await fixture();
  const nonDraft = JSON.stringify([{
    state: "OPEN", isDraft: false, url: "https://github.com/leike0813/mattpack/pull/17",
    headRefName: `automation/matt-skills-monitor/${randomUUID()}`, headRepositoryOwner: { login: "leike0813" }
  }]);
  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, {
    cwd: f.linked, execute: f.runner({ prs: nonDraft })
  }), "PR_QUERY_FAILED");
});

test("fetches both exact SHAs and records the complete upstream evidence", async () => {
  const f = await fixture();
  const fetched: string[] = [];
  const baseRunner = f.runner({ observed: f.target });
  const execute = async (program: string, args: readonly string[], cwd: string) => {
    if (program === "git" && args[0] === "--git-dir" && args[2] === "fetch") fetched.push(args.at(-1) ?? "");
    return baseRunner(program, args, cwd);
  };
  const result = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute }) as {
    runId: string; pinnedCommit: string; targetCommit: string; diffPath: string; auditPath: string;
  };
  assert.deepEqual(fetched, [f.pinned, f.target]);
  assert.equal(result.pinnedCommit, f.pinned);
  assert.equal(result.targetCommit, f.target);
  assert.match(await readFile(result.diffPath, "utf8"), /target bytes/u);
  const audit = JSON.parse(await readFile(result.auditPath, "utf8")) as { nameStatus: string; log: string };
  assert.match(audit.nameStatus, /A\s+new\.md/u);
  assert.match(audit.log, /target/u);
});

test("fails closed on contention, PR query errors, corrupt locks, and mismatched recovery", async () => {
  const f = await fixture();
  const execute = f.runner();
  const active = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute }) as { runId: string };
  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute }), "RUN_ACTIVE");
  const second = path.join(f.root, "second-worktree");
  git(f.root, "--git-dir", f.projectBare, "worktree", "add", "-b", "second-fixture", second, "main");
  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: second, execute }), "RUN_ACTIVE");
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId: randomUUID() }, { cwd: f.linked, execute }), "RUN_MISMATCH");
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId: active.runId }, { cwd: f.linked, execute }), "OWNER_ALIVE");

  const lockPath = path.join(f.common, "mattpack-upstream-monitor", "active.json");
  await writeFile(lockPath, JSON.stringify({
    schemaVersion: 1, runId: active.runId, projectRoot: f.linked, ownerPid: process.pid,
    baseRef: "origin/main", branch: "automation/matt-skills-monitor/not-a-run-id",
    pinnedCommit: f.pinned, targetCommit: f.pinned, changed: false,
    auditPath: path.join(f.root, "outside.json"), startedAt: new Date().toISOString()
  }));
  await expectCode(() => runUpstreamMonitor({ command: "status" }, { cwd: f.linked, execute }), "LOCK_CORRUPT");
  await rm(lockPath);

  await expectCode(() => runUpstreamMonitor({ command: "start", ownerPid: process.pid }, {
    cwd: f.linked, execute: f.runner({ failGh: true })
  }), "PR_QUERY_FAILED");
  assert.equal((await runUpstreamMonitor({ command: "status" }, { cwd: f.linked, execute })).active, null);
});

test("recovers only an explicitly matching dead owner", async () => {
  const f = await fixture();
  const runId = randomUUID();
  const lockDir = path.join(f.common, "mattpack-upstream-monitor");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(lockDir));
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(path.join(f.linked, "var/matt-skills-monitor", runId, "audit.json")), { recursive: true }));
  await writeFile(path.join(lockDir, "active.json"), JSON.stringify({
    schemaVersion: 1, runId, projectRoot: f.linked, ownerPid: 2_147_000_000,
    baseRef: "origin/main", branch: `automation/matt-skills-monitor/${runId}`, pinnedCommit: f.pinned,
    targetCommit: f.pinned, changed: false,
    auditPath: path.join(f.linked, "var/matt-skills-monitor", runId, "audit.json"), startedAt: new Date().toISOString()
  }));
  const result = await runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute: f.runner() });
  assert.deepEqual(result, { runId, recovered: true, reportPreserved: true });
  assert.equal((await runUpstreamMonitor({ command: "status" }, { cwd: f.linked, execute: f.runner() })).active, null);
});

test("recovery releases a dead-owner lock after its owned temp path was already removed", async () => {
  const f = await fixture();
  const runId = randomUUID();
  const tempPath = path.join(os.tmpdir(), `mattpack-upstream-${runId}`);
  const lockDir = path.join(f.common, "mattpack-upstream-monitor");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(lockDir));
  await import("node:fs/promises").then(({ mkdir }) => mkdir(tempPath));
  await writeFile(path.join(tempPath, ".mattpack-monitor-run"), `${runId}\n`);
  await writeFile(path.join(lockDir, "active.json"), JSON.stringify({
    schemaVersion: 1, runId, projectRoot: f.linked, ownerPid: 2_147_000_000,
    baseRef: "origin/main", branch: `automation/matt-skills-monitor/${runId}`,
    pinnedCommit: f.pinned, targetCommit: f.target, changed: true,
    auditPath: path.join(f.linked, "var/matt-skills-monitor", runId, "audit.json"),
    diffPath: path.join(f.linked, "var/matt-skills-monitor", runId, "upstream.diff"),
    tempPath, startedAt: new Date().toISOString()
  }));
  await rm(tempPath, { recursive: true });
  await runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute: f.runner() });
  assert.equal((await runUpstreamMonitor({ command: "status" }, { cwd: f.linked, execute: f.runner() })).active, null);
});

test("refuses an escaped recorded temp path without deleting the target", async () => {
  const f = await fixture();
  const runId = randomUUID();
  const outside = await mkdtemp(path.join(os.tmpdir(), "mattpack-monitor-user-data-"));
  await writeFile(path.join(outside, "keep.txt"), "user data");
  const lockDir = path.join(f.common, "mattpack-upstream-monitor");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(lockDir));
  await writeFile(path.join(lockDir, "active.json"), JSON.stringify({
    schemaVersion: 1, runId, projectRoot: f.linked, ownerPid: 2_147_000_000,
    baseRef: "origin/main", branch: `automation/matt-skills-monitor/${runId}`,
    pinnedCommit: f.pinned, targetCommit: f.target, changed: true,
    auditPath: path.join(f.linked, "var/matt-skills-monitor", runId, "audit.json"),
    diffPath: path.join(f.linked, "var/matt-skills-monitor", runId, "upstream.diff"),
    tempPath: outside, startedAt: new Date().toISOString()
  }));
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute: f.runner() }), "LOCK_CORRUPT");
  assert.equal(await readFile(path.join(outside, "keep.txt"), "utf8"), "user data");
});

test("refuses a symlink ownership marker during recovery", async () => {
  const f = await fixture();
  const runId = randomUUID();
  const tempPath = path.join(os.tmpdir(), `mattpack-upstream-${runId}`);
  roots.push(tempPath);
  const markerTarget = path.join(f.root, "user-marker");
  await writeFile(markerTarget, `${runId}\n`);
  const lockDir = path.join(f.common, "mattpack-upstream-monitor");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(lockDir));
  await import("node:fs/promises").then(({ mkdir }) => mkdir(tempPath));
  await import("node:fs/promises").then(({ symlink }) => symlink(markerTarget, path.join(tempPath, ".mattpack-monitor-run")));
  await writeFile(path.join(lockDir, "active.json"), JSON.stringify({
    schemaVersion: 1, runId, projectRoot: f.linked, ownerPid: 2_147_000_000,
    baseRef: "origin/main", branch: `automation/matt-skills-monitor/${runId}`,
    pinnedCommit: f.pinned, targetCommit: f.target, changed: true,
    auditPath: path.join(f.linked, "var/matt-skills-monitor", runId, "audit.json"),
    diffPath: path.join(f.linked, "var/matt-skills-monitor", runId, "upstream.diff"),
    tempPath, startedAt: new Date().toISOString()
  }));
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId }, { cwd: f.linked, execute: f.runner() }), "LOCK_CORRUPT");
  assert.equal(await readFile(markerTarget, "utf8"), `${runId}\n`);
});

test("recovery preserves the target of a replaced temporary-directory symlink", async () => {
  const f = await fixture();
  const execute = f.runner({ observed: f.target });
  const session = await runUpstreamMonitor({ command: "start", ownerPid: process.pid }, { cwd: f.linked, execute });
  const lockPath = path.join(f.common, "mattpack-upstream-monitor", "active.json");
  const active = JSON.parse(await readFile(lockPath, "utf8")) as { ownerPid: number; tempPath: string };
  const userDirectory = path.join(f.root, path.basename(active.tempPath));
  await mkdir(userDirectory);
  await writeFile(path.join(userDirectory, "keep.txt"), "user bytes");
  await rm(active.tempPath, { recursive: true });
  await import("node:fs/promises").then(({ symlink }) => symlink(userDirectory, active.tempPath, "dir"));
  roots.push(active.tempPath);
  active.ownerPid = 2_147_000_000;
  await writeFile(lockPath, JSON.stringify(active));
  await expectCode(() => runUpstreamMonitor({ command: "recover", runId: String(session.runId) }, { cwd: f.linked, execute }), "LOCK_CORRUPT");
  assert.equal(await readFile(path.join(userDirectory, "keep.txt"), "utf8"), "user bytes");
});
