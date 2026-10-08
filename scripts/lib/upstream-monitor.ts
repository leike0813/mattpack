import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { loadUpstreamLock, UPSTREAM_ID } from "../../src/catalog/upstream.js";

const execFileAsync = promisify(execFile);
const MATT_REPOSITORY = "https://github.com/mattpocock/skills.git";
const BRANCH_PREFIX = "automation/matt-skills-monitor/";
const FULL_SHA = /^[0-9a-f]{40}$/u;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type MonitorCommandRunner = (command: string, args: readonly string[], cwd: string) => Promise<string>;
export type MonitorCommand =
  | { command: "start"; ownerPid: number; baseRef?: string }
  | { command: "status" }
  | { command: "finish"; runId: string; resultFile: string }
  | { command: "recover"; runId: string };

interface Lock {
  schemaVersion: 1;
  runId: string;
  projectRoot: string;
  ownerPid: number;
  baseRef: string;
  branch: string;
  pinnedCommit: string;
  targetCommit: string;
  changed: boolean;
  auditPath: string;
  diffPath?: string;
  tempPath?: string;
  startedAt: string;
}

export class MonitorError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MonitorError";
  }
}

function fail(code: string, message: string): never {
  throw new MonitorError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownerAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return isRecord(error) && error.code === "EPERM"; }
}

const systemCommand: MonitorCommandRunner = async (name, args, cwd) => {
  try {
    const { stdout } = await execFileAsync(name, [...args], {
      cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024
    });
    return stdout.trimEnd();
  } catch (error) {
    fail("COMMAND_FAILED", `${name} ${args[0] ?? ""} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

function lockFile(commonDir: string): string {
  return path.join(commonDir, "mattpack-upstream-monitor", "active.json");
}

async function readLock(file: string): Promise<Lock | undefined> {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) fail("LOCK_CORRUPT", "Monitor lock is not a regular file");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
  let value: unknown;
  try { value = JSON.parse(await readFile(file, "utf8")); }
  catch { fail("LOCK_CORRUPT", "Monitor lock is not valid JSON"); }
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.runId !== "string" || !RUN_ID.test(value.runId)
      || typeof value.projectRoot !== "string" || !path.isAbsolute(value.projectRoot) || path.resolve(value.projectRoot) !== value.projectRoot
      || !Number.isSafeInteger(value.ownerPid) || (value.ownerPid as number) < 1
      || typeof value.baseRef !== "string" || !(FULL_SHA.test(value.baseRef) || /^origin\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(value.baseRef))
      || value.baseRef.includes("..") || typeof value.branch !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(value.branch) || value.branch.includes("..")
      || typeof value.pinnedCommit !== "string" || !FULL_SHA.test(value.pinnedCommit)
      || typeof value.targetCommit !== "string" || !FULL_SHA.test(value.targetCommit)
      || typeof value.changed !== "boolean" || value.changed !== (value.pinnedCommit !== value.targetCommit)
      || typeof value.auditPath !== "string"
      || value.auditPath !== path.join(value.projectRoot, "var", "matt-skills-monitor", value.runId, "audit.json")
      || (value.diffPath !== undefined && value.diffPath !== path.join(path.dirname(value.auditPath), "upstream.diff"))
      || (value.changed && (typeof value.diffPath !== "string" || typeof value.tempPath !== "string"))
      || (!value.changed && (value.diffPath !== undefined || value.tempPath !== undefined))
      || typeof value.startedAt !== "string" || !Number.isFinite(Date.parse(value.startedAt))
      || (value.tempPath !== undefined && (typeof value.tempPath !== "string" || !path.isAbsolute(value.tempPath)
        || path.resolve(value.tempPath) !== value.tempPath || path.dirname(value.tempPath) !== path.resolve(os.tmpdir())
        || path.basename(value.tempPath) !== `mattpack-upstream-${value.runId}`))) {
    fail("LOCK_CORRUPT", "Monitor lock metadata is incomplete or invalid");
  }
  return value as unknown as Lock;
}

async function withGuard<T>(commonDir: string, action: () => Promise<T>, recoveryRunId?: string): Promise<T> {
  const directory = path.join(commonDir, "mattpack-upstream-monitor");
  try { await mkdir(directory); }
  catch (error) { if (!(isRecord(error) && error.code === "EEXIST")) throw error; }
  const info = await lstat(directory);
  const actual = await realpath(directory);
  const relative = path.relative(commonDir, actual);
  if (!info.isDirectory() || info.isSymbolicLink() || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("LOCK_CORRUPT", "Monitor lock directory escapes the common Git directory");
  }
  const guard = path.join(directory, "guard");
  try { await mkdir(guard); }
  catch (error) {
    if (!(isRecord(error) && error.code === "EEXIST")) throw error;
    if (!recoveryRunId) fail("LOCK_BUSY", "Another monitor lifecycle mutation is in progress");
    const recoveryGuard = path.join(directory, "recovery-guard");
    try { await mkdir(recoveryGuard); }
    catch { fail("LOCK_BUSY", "Another guard recovery is in progress or needs diagnosis"); }
    try {
      const guardInfo = await lstat(guard);
      const ownerFile = path.join(guard, "owner.json");
      const ownerInfo = await lstat(ownerFile);
      if (!guardInfo.isDirectory() || guardInfo.isSymbolicLink() || !ownerInfo.isFile() || ownerInfo.isSymbolicLink()) {
        fail("LOCK_CORRUPT", "Lifecycle guard ownership is invalid");
      }
      let owner: unknown;
      try { owner = JSON.parse(await readFile(ownerFile, "utf8")); }
      catch { fail("LOCK_CORRUPT", "Lifecycle guard ownership is incomplete"); }
      if (!isRecord(owner) || !Number.isSafeInteger(owner.pid) || (owner.pid as number) < 1) {
        fail("LOCK_CORRUPT", "Lifecycle guard owner PID is invalid");
      }
      if (ownerAlive(owner.pid as number)) fail("LOCK_BUSY", "Lifecycle guard owner is still alive");
      const active = await readLock(lockFile(commonDir));
      if (!active || active.runId !== recoveryRunId) fail("RUN_MISMATCH", "Recovery run does not match the interrupted lifecycle");
      if (ownerAlive(active.ownerPid)) fail("OWNER_ALIVE", "Run owner is still alive");
      await rm(ownerFile);
      await rmdir(guard);
      await mkdir(guard);
    } finally { await rmdir(recoveryGuard); }
  }
  const ownerFile = path.join(guard, "owner.json");
  await writeFile(ownerFile, JSON.stringify({ pid: process.pid }), { flag: "wx" });
  try { return await action(); }
  finally { await rm(ownerFile); await rmdir(guard); }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, file);
}

async function reportDirectory(root: string, runId?: string): Promise<string> {
  let current = root;
  for (const part of ["var", "matt-skills-monitor", ...(runId ? [runId] : [])]) {
    current = path.join(current, part);
    try { await mkdir(current); }
    catch (error) { if (!(isRecord(error) && error.code === "EEXIST")) throw error; }
    const info = await lstat(current);
    const actual = await realpath(current);
    const relative = path.relative(root, actual);
    if (!info.isDirectory() || info.isSymbolicLink() || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      fail("REPORT_PATH_INVALID", "Monitor report directory escapes the project root");
    }
  }
  return current;
}

async function repository(cwd: string, run: MonitorCommandRunner, starting = false): Promise<{ root: string; common: string; branch: string }> {
  const root = await realpath(path.resolve(await run("git", ["rev-parse", "--show-toplevel"], cwd)));
  const common = await realpath(path.resolve(root, await run("git", ["rev-parse", "--git-common-dir"], root)));
  const branch = await run("git", ["branch", "--show-current"], root);
  if (starting) {
    if (!branch || /^(?:main|master)$/u.test(branch)) fail("WORKTREE_REQUIRED", "Run from a linked non-main worktree");
    const list = await run("git", ["worktree", "list", "--porcelain"], root);
    const primary = /^worktree (.+)$/mu.exec(list)?.[1];
    if (primary && path.resolve(primary) === root) fail("WORKTREE_REQUIRED", "Run from a linked non-main worktree");
    if (await run("git", ["status", "--porcelain", "--untracked-files=all"], root)) {
      fail("WORKTREE_DIRTY", "Monitor worktree must be clean, including untracked files");
    }
  }
  return { root, common, branch };
}

function validOrigin(url: string): boolean {
  return /^(?:https:\/\/github\.com\/leike0813\/mattpack(?:\.git)?|git@github\.com:leike0813\/mattpack(?:\.git)?)$/u.test(url);
}

async function claim(common: string, lock: Lock): Promise<void> {
  await withGuard(common, async () => {
    const file = lockFile(common);
    const active = await readLock(file);
    if (active) fail("RUN_ACTIVE", `Monitor run ${active.runId} is still active`);
    await writeJson(file, lock);
  });
}

async function mutateLock(common: string, runId: string, change: (lock: Lock) => Lock | Promise<Lock>): Promise<Lock> {
  return withGuard(common, async () => {
    const file = lockFile(common);
    const active = await readLock(file);
    if (!active || active.runId !== runId) fail("RUN_MISMATCH", "Monitor lock changed during the run");
    const updated = await change(active);
    await writeJson(file, updated);
    return updated;
  });
}

async function removeLock(common: string, runId: string): Promise<void> {
  await withGuard(common, async () => {
    const file = lockFile(common);
    const active = await readLock(file);
    if (!active) fail("NO_ACTIVE_RUN", "There is no active monitor run");
    if (active.runId !== runId) fail("RUN_MISMATCH", "Run ID does not match the active monitor session");
    await rm(file);
  });
}

async function cleanTemp(lock: Lock): Promise<void> {
  if (!lock.tempPath) return;
  const tempRoot = await realpath(os.tmpdir());
  const original = await lstat(lock.tempPath).catch((error: unknown) => {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!original) return;
  if (!original.isDirectory() || original.isSymbolicLink()) fail("LOCK_CORRUPT", "Recorded temporary path is not an owned directory");
  const actual = await realpath(lock.tempPath).catch((error: unknown) => {
    if (isRecord(error) && error.code === "ENOENT") return "";
    throw error;
  });
  if (!actual) return;
  const relative = path.relative(tempRoot, actual);
  if (path.dirname(actual) !== tempRoot || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)
      || path.basename(actual) !== `mattpack-upstream-${lock.runId}`) fail("LOCK_CORRUPT", "Recorded temporary path escapes its owned location");
  const quarantine = path.join(tempRoot, `.mattpack-cleanup-${randomUUID()}`);
  await rename(lock.tempPath, quarantine);
  try {
    const info = await lstat(quarantine);
    const marker = path.join(quarantine, ".mattpack-monitor-run");
    const markerInfo = await lstat(marker);
    if (!info.isDirectory() || info.isSymbolicLink() || !markerInfo.isFile() || markerInfo.isSymbolicLink()
        || await readFile(marker, "utf8") !== `${lock.runId}\n`) {
      fail("LOCK_CORRUPT", "Temporary directory ownership marker is invalid");
    }
  } catch (error) {
    await rename(quarantine, lock.tempPath);
    throw error;
  }
  await rm(quarantine, { recursive: true });
}

interface PullRequest {
  state: string;
  isDraft: boolean;
  url: string;
  headRefName: string;
  headRepositoryOwner: { login: string };
}

function parsePullRequests(source: string): PullRequest[] {
  let value: unknown;
  try { value = JSON.parse(source); } catch { fail("PR_QUERY_FAILED", "gh returned invalid pull request JSON"); }
  if (!Array.isArray(value) || value.some((pr) => !isRecord(pr) || typeof pr.state !== "string"
      || typeof pr.isDraft !== "boolean" || typeof pr.url !== "string" || typeof pr.headRefName !== "string"
      || !isRecord(pr.headRepositoryOwner) || typeof pr.headRepositoryOwner.login !== "string")) {
    fail("PR_QUERY_FAILED", "gh returned incomplete pull request data");
  }
  return value as PullRequest[];
}

async function branchExists(branch: string, root: string, run: MonitorCommandRunner): Promise<boolean> {
  try { await run("git", ["show-ref", "--verify", `refs/heads/${branch}`], root); return true; }
  catch { return false; }
}

async function checkoutDraft(branch: string, root: string, common: string, run: MonitorCommandRunner): Promise<void> {
  const listing = await run("git", ["worktree", "list", "--porcelain"], root);
  const occupied = listing.split(/\n\n/u).some((entry) => {
    const worktree = /^worktree (.+)$/mu.exec(entry)?.[1];
    const current = /^branch refs\/heads\/(.+)$/mu.exec(entry)?.[1];
    return Boolean(worktree && current === branch && path.resolve(worktree) !== root);
  });
  if (occupied) fail("BRANCH_IN_USE", `Maintenance branch ${branch} is checked out in another worktree`);
  const remote = `refs/remotes/origin/${branch}`;
  await run("git", ["fetch", "origin", `refs/heads/${branch}:${remote}`], root);
  if (await branchExists(branch, root, run)) {
    if (await run("git", ["branch", "--show-current"], root) !== branch) await run("git", ["switch", branch], root);
    const remoteIsAncestor = await run("git", ["merge-base", "--is-ancestor", remote, branch], root).then(() => true, () => false);
    if (!remoteIsAncestor) {
      const localIsAncestor = await run("git", ["merge-base", "--is-ancestor", branch, remote], root).then(() => true, () => false);
      if (!localIsAncestor) fail("BRANCH_DIVERGED", `Local maintenance branch ${branch} diverges from origin`);
      await run("git", ["merge", "--ff-only", remote], root);
    }
  } else await run("git", ["switch", "-c", branch, remote], root);
  const checkedCommon = await realpath(path.resolve(root, await run("git", ["rev-parse", "--git-common-dir"], root)));
  if (checkedCommon !== common) fail("WORKTREE_CHANGED", "Git common directory changed while selecting a branch");
}

async function start(cwd: string, ownerPid: number, baseRef: string, run: MonitorCommandRunner): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(ownerPid) || ownerPid < 1) fail("INVALID_ARGUMENT", "owner-pid must be a positive PID");
  if (!ownerAlive(ownerPid)) fail("OWNER_UNKNOWN", "owner-pid must identify a live process");
  const repo = await repository(cwd, run, true);
  if (!FULL_SHA.test(baseRef)) {
    if (!baseRef.startsWith("origin/")) fail("INVALID_ARGUMENT", "base-ref must be a full SHA or branch beneath origin/");
    await run("git", ["check-ref-format", baseRef], repo.root).catch(() => fail("INVALID_ARGUMENT", "base-ref is not a valid Git ref"));
  }
  if (!validOrigin(await run("git", ["remote", "get-url", "origin"], repo.root))) fail("ORIGIN_MISMATCH", "origin must point to leike0813/mattpack");

  const runId = randomUUID();
  const auditPath = path.join(await reportDirectory(repo.root, runId), "audit.json");
  const beforeCheckout = await loadUpstreamLock(repo.root);
  const initialPin = beforeCheckout.upstreams[UPSTREAM_ID].commit;
  if (beforeCheckout.upstreams[UPSTREAM_ID].repository !== MATT_REPOSITORY || beforeCheckout.upstreams[UPSTREAM_ID].license !== "MIT") {
    fail("UPSTREAM_LOCK_INVALID", "upstream.lock.json must identify the trusted MIT Matt skills source");
  }
  const initial: Lock = {
    schemaVersion: 1, runId, projectRoot: repo.root, ownerPid, baseRef,
    branch: `${BRANCH_PREFIX}${runId}`, pinnedCommit: initialPin, targetCommit: initialPin, changed: false,
    auditPath, startedAt: new Date().toISOString()
  };
  await claim(repo.common, initial);
  let tempPath: string | undefined;
  try {
    let baseCommit: string;
    if (FULL_SHA.test(baseRef)) {
      baseCommit = await run("git", ["rev-parse", "--verify", "--end-of-options", `${baseRef}^{commit}`], repo.root);
    } else {
      const branch = baseRef.slice("origin/".length);
      await run("git", ["fetch", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`], repo.root);
      baseCommit = await run("git", ["rev-parse", "--verify", "--end-of-options", `refs/remotes/origin/${branch}^{commit}`], repo.root);
    }
    if (!FULL_SHA.test(baseCommit)) fail("BASE_REF_INVALID", "base-ref did not resolve to a full commit SHA");

    let prs: PullRequest[];
    try {
      prs = parsePullRequests(await run("gh", ["pr", "list", "--repo", "leike0813/mattpack", "--state", "open", "--limit", "1000", "--json", "state,isDraft,url,headRefName,headRepositoryOwner"], repo.root));
    } catch (error) {
      if (error instanceof MonitorError && error.code === "PR_QUERY_FAILED") throw error;
      fail("PR_QUERY_FAILED", error instanceof Error ? error.message : "Unable to query pull requests");
    }
    const maintenance = prs.filter((pr) => pr.headRepositoryOwner.login === "leike0813" && pr.headRefName.startsWith(BRANCH_PREFIX));
    if (prs.length === 1000) fail("PR_QUERY_FAILED", "Open pull request query reached its limit; refusing incomplete branch selection");
    const open = maintenance.filter((pr) => pr.state === "OPEN");
    if (open.some((pr) => !pr.isDraft)) fail("PR_QUERY_FAILED", "An open maintenance pull request is not a draft");
    if (open.length > 1) fail("PR_QUERY_FAILED", "Multiple open maintenance drafts make branch selection ambiguous");

    let branch = `${BRANCH_PREFIX}${runId}`;
    if (open[0]) {
      const draft = open[0];
      if (!/^https:\/\/github\.com\/leike0813\/mattpack\/pull\/\d+$/u.test(draft.url)) fail("PR_QUERY_FAILED", "Open maintenance draft has an invalid URL");
      branch = draft.headRefName;
      await checkoutDraft(branch, repo.root, repo.common, run);
    } else {
      if (await branchExists(branch, repo.root, run)) fail("BRANCH_EXISTS", `Generated maintenance branch already exists: ${branch}`);
      await run("git", ["switch", "-c", branch, baseCommit], repo.root);
    }
    await mutateLock(repo.common, runId, (lock) => ({ ...lock, branch }));

    const selected = await loadUpstreamLock(repo.root);
    const source = selected.upstreams[UPSTREAM_ID];
    if (source.repository !== MATT_REPOSITORY || source.license !== "MIT") fail("UPSTREAM_LOCK_INVALID", "Selected branch has an untrusted upstream source");
    const pinnedCommit = source.commit;
    const observed = await run("git", ["ls-remote", source.repository, "refs/heads/main"], repo.root);
    const targetCommit = observed.split(/\s+/u)[0] ?? "";
    if (!FULL_SHA.test(targetCommit)) fail("OBSERVATION_FAILED", "Upstream main did not resolve to a full SHA");
    const changed = targetCommit !== pinnedCommit;
    let lock: Lock = { ...initial, branch, pinnedCommit, targetCommit, changed };
    if (changed) {
      tempPath = path.join(os.tmpdir(), `mattpack-upstream-${runId}`);
      lock = { ...lock, tempPath, diffPath: path.join(path.dirname(auditPath), "upstream.diff") };
      await mutateLock(repo.common, runId, () => lock);
      await mkdir(tempPath);
      await writeFile(path.join(tempPath, ".mattpack-monitor-run"), `${runId}\n`, { flag: "wx" });
      const objectStore = path.join(tempPath, "objects.git");
      await run("git", ["init", "--bare", objectStore], repo.root);
      for (const sha of [pinnedCommit, targetCommit]) {
        await run("git", ["--git-dir", objectStore, "fetch", "--no-tags", source.repository, sha], repo.root);
        const fetched = await run("git", ["--git-dir", objectStore, "rev-parse", "FETCH_HEAD^{commit}"], repo.root);
        if (fetched !== sha) fail("FETCH_MISMATCH", `Fetched ${fetched}; expected ${sha}`);
      }
      const prefix = ["--git-dir", objectStore];
      const diff = await run("git", [...prefix, "diff", "--binary", "--no-ext-diff", "--no-renames", "--no-color", pinnedCommit, targetCommit], repo.root);
      const nameStatus = await run("git", [...prefix, "diff", "--name-status", "--no-renames", pinnedCommit, targetCommit], repo.root);
      const stat = await run("git", [...prefix, "diff", "--stat", pinnedCommit, targetCommit], repo.root);
      const log = await run("git", [...prefix, "log", "--oneline", "--no-decorate", `${pinnedCommit}..${targetCommit}`], repo.root);
      await reportDirectory(repo.root, runId);
      await writeFile(lock.diffPath!, diff, { flag: "wx" });
      await writeJson(auditPath, { runId, projectRoot: repo.root, ownerPid, baseRef, branch, pinnedCommit, targetCommit, changed, auditPath, diffPath: lock.diffPath, nameStatus, stat, log, observedAt: new Date().toISOString() });
    } else {
      await writeJson(auditPath, { runId, projectRoot: repo.root, ownerPid, baseRef, branch, pinnedCommit, targetCommit, changed, auditPath, observedAt: new Date().toISOString() });
    }
    await mutateLock(repo.common, runId, () => lock);
    return { runId, projectRoot: repo.root, ownerPid, baseRef, branch, pinnedCommit, targetCommit, changed, auditPath,
      ...(lock.diffPath ? { diffPath: lock.diffPath } : {}) };
  } catch (error) {
    try {
      const active = await readLock(lockFile(repo.common));
      if (active?.runId === runId) {
        await cleanTemp(active);
        await removeLock(repo.common, runId);
      }
    } catch { /* Preserve corrupt or incomplete ownership state for explicit recovery. */ }
    throw error;
  }
}

async function status(cwd: string, run: MonitorCommandRunner): Promise<Record<string, unknown>> {
  const repo = await repository(cwd, run);
  return { active: (await readLock(lockFile(repo.common))) ?? null };
}

async function finish(cwd: string, runId: string, resultFile: string, run: MonitorCommandRunner): Promise<Record<string, unknown>> {
  if (!RUN_ID.test(runId)) fail("INVALID_ARGUMENT", "runId is invalid");
  const repo = await repository(cwd, run);
  return withGuard(repo.common, async () => {
    const active = await readLock(lockFile(repo.common));
    if (!active) fail("NO_ACTIVE_RUN", "There is no active monitor run");
    if (active.runId !== runId || active.projectRoot !== repo.root) fail("RUN_MISMATCH", "Run ID or project root does not match the active session");
    let input: unknown;
    try { input = JSON.parse(await readFile(path.resolve(cwd, resultFile), "utf8")); }
    catch { fail("RESULT_INVALID", "Unable to read a valid result file"); }
    if (!isRecord(input) || input.runId !== runId || !["noop", "draft_pr", "blocked", "failed"].includes(String(input.outcome))
        || typeof input.summary !== "string" || !input.summary.trim()) fail("RESULT_INVALID", "Result requires matching runId, outcome, and non-empty summary");
    if (input.outcome === "draft_pr" && (typeof input.prUrl !== "string" || !/^https:\/\/github\.com\/leike0813\/mattpack\/pull\/\d+$/u.test(input.prUrl))) {
      fail("RESULT_INVALID", "draft_pr requires prUrl for a Mattpack pull request");
    }
    if (input.outcome !== "draft_pr" && input.prUrl !== undefined) fail("RESULT_INVALID", "Only draft_pr accepts prUrl");
    if ((input.outcome === "noop" && active.changed) || (input.outcome === "draft_pr" && !active.changed)) {
      fail("RESULT_INVALID", "Outcome does not match the observed upstream change");
    }
    const report = { runId, outcome: input.outcome, summary: input.summary.trim(), ...(input.prUrl ? { prUrl: input.prUrl } : {}),
      projectRoot: repo.root, ownerPid: active.ownerPid, baseRef: active.baseRef, branch: active.branch,
      pinnedCommit: active.pinnedCommit, targetCommit: active.targetCommit, changed: active.changed,
      auditPath: active.auditPath, ...(active.diffPath ? { diffPath: active.diffPath } : {}), finishedAt: new Date().toISOString() };
    const reportPath = path.join(await reportDirectory(repo.root, runId), "report.json");
    await writeJson(reportPath, report);
    await writeJson(path.join(await reportDirectory(repo.root), "latest.json"), report);
    await cleanTemp(active);
    await rm(lockFile(repo.common));
    return { reportPath, report };
  });
}

async function recover(cwd: string, runId: string, run: MonitorCommandRunner): Promise<Record<string, unknown>> {
  if (!RUN_ID.test(runId)) fail("INVALID_ARGUMENT", "runId is invalid");
  const repo = await repository(cwd, run);
  return withGuard(repo.common, async () => {
    const active = await readLock(lockFile(repo.common));
    if (!active) fail("NO_ACTIVE_RUN", "There is no active monitor run");
    if (active.runId !== runId) fail("RUN_MISMATCH", "Run ID does not match the active monitor session");
    if (ownerAlive(active.ownerPid)) fail("OWNER_ALIVE", `Owner process ${active.ownerPid} is still alive`);
    await cleanTemp(active);
    await rm(lockFile(repo.common));
    return { runId, recovered: true, reportPreserved: true };
  }, runId);
}

export async function runUpstreamMonitor(args: MonitorCommand, options: { cwd?: string; execute?: MonitorCommandRunner } = {}): Promise<Record<string, unknown>> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const run = options.execute ?? systemCommand;
  switch (args.command) {
    case "start": return start(cwd, args.ownerPid, args.baseRef ?? "origin/main", run);
    case "status": return status(cwd, run);
    case "finish": return finish(cwd, args.runId, args.resultFile, run);
    case "recover": return recover(cwd, args.runId, run);
  }
}
