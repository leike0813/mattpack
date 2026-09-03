import { randomUUID } from "node:crypto";
import { chmod, copyFile, cp, lstat, mkdir, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertContained, relativePath } from "./paths.js";
import { skillDirectory, type PlanAction, type ReconciliationPlan } from "./plan.js";
import { OWNER_FILE, scanSkill, stateJson, type OwnerState } from "./state.js";
import { MattpackError, asMattpackError } from "./errors.js";

export interface ApplyResult {
  changed: boolean;
  backupPath?: string;
}

interface Swap {
  destination: string;
  previous?: string;
  installed: boolean;
}

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function copyOne(source: string, destination: string): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  await chmod(destination, (await stat(source)).mode & 0o777);
}

async function prepareAction(projectRoot: string, stageRoot: string, action: PlanAction, installationId?: string): Promise<string | undefined> {
  if (action.kind === "remove" && action.preserveFiles.length === 0) return undefined;
  const staged = path.join(stageRoot, ...action.root.split("/"), action.name);
  await mkdir(staged, { recursive: true });
  const current = skillDirectory(projectRoot, action.root, action.name);
  for (const file of action.preserveFiles) {
    await copyOne(path.join(current, ...file.split("/")), path.join(staged, ...file.split("/")));
  }
  if (action.desired) {
    for (const file of action.desired.files) {
      await copyOne(
        path.join(action.desired.sourceDirectory, ...file.path.split("/")),
        path.join(staged, ...file.path.split("/"))
      );
    }
    if (!installationId) throw new MattpackError("APPLY_FAILED", "Missing installation ID");
    const owner: OwnerState = {
      schemaVersion: 1,
      manager: "mattpack",
      installationId,
      sourcePath: action.desired.sourcePath
    };
    await writeFile(path.join(staged, OWNER_FILE), stateJson(owner), { encoding: "utf8", mode: 0o644 });
  }
  return staged;
}

async function exchange(destination: string, staged: string | undefined, oldRoot: string): Promise<Swap> {
  await mkdir(path.dirname(destination), { recursive: true });
  const previous = path.join(oldRoot, path.basename(destination));
  let movedPrevious = false;
  if (await exists(destination)) {
    await mkdir(path.dirname(previous), { recursive: true });
    await rename(destination, previous);
    movedPrevious = true;
  }
  try {
    if (staged) await rename(staged, destination);
  } catch (error) {
    if (movedPrevious) await rename(previous, destination);
    throw error;
  }
  const swap: Swap = { destination, installed: Boolean(staged) };
  if (movedPrevious) swap.previous = previous;
  return swap;
}

async function rollback(swaps: readonly Swap[]): Promise<void> {
  for (const swap of [...swaps].reverse()) {
    if (swap.installed) await rm(swap.destination, { recursive: true, force: true });
    if (swap.previous) {
      await mkdir(path.dirname(swap.destination), { recursive: true });
      await rename(swap.previous, swap.destination);
    }
  }
}

async function removeIfEmpty(directory: string): Promise<void> {
  try {
    await rmdir(directory);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && ["ENOENT", "ENOTEMPTY"].includes(String(error.code)))) throw error;
  }
}

async function backupConflicts(projectRoot: string, plan: ReconciliationPlan): Promise<string | undefined> {
  if (plan.conflicts.length === 0) return undefined;
  const backupRoot = path.join(projectRoot, ".mattpack", "backups", `${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomUUID()}`);
  for (const key of [...new Set(plan.conflicts.map((conflict) => conflict.key))].sort()) {
    const source = path.join(projectRoot, ...key.split("/"));
    const destination = path.join(backupRoot, ...key.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  }
  return relativePath(projectRoot, backupRoot);
}

export async function applyPlan(projectRoot: string, plan: ReconciliationPlan, force = false): Promise<ApplyResult> {
  if (plan.conflicts.length > 0 && !force) {
    throw new MattpackError("CONFLICT", "Plan contains conflicts", { conflicts: plan.conflicts });
  }
  if (plan.actions.length === 0 && !plan.stateNeedsWrite) return { changed: false };

  const stateRoot = await assertContained(projectRoot, path.join(projectRoot, ".mattpack"));
  const transaction = path.join(stateRoot, "staging", randomUUID());
  const newRoot = path.join(transaction, "new");
  const oldRoot = path.join(transaction, "old");
  const swaps: Swap[] = [];
  let backupPath: string | undefined;

  try {
    await mkdir(newRoot, { recursive: true });
    const staged = new Map<string, string | undefined>();
    for (const action of plan.actions) {
      staged.set(action.key, await prepareAction(projectRoot, newRoot, action, plan.lock?.installationId));
    }
    if (force) backupPath = await backupConflicts(projectRoot, plan);

    for (const action of plan.actions) {
      const destination = await assertContained(projectRoot, skillDirectory(projectRoot, action.root, action.name));
      const current = await scanSkill(destination);
      if (stateJson(current) !== stateJson(action.expected)) {
        throw new MattpackError("CONFLICT", `Target changed after planning: ${action.key}`);
      }
      const actionOldRoot = path.join(oldRoot, ...action.root.split("/"));
      swaps.push(await exchange(destination, staged.get(action.key), actionOldRoot));
    }

    const configPath = path.join(stateRoot, "config.json");
    const lockPath = path.join(stateRoot, "lock.json");
    const stagedConfig = plan.config ? path.join(transaction, "config.json") : undefined;
    const stagedLock = plan.lock ? path.join(transaction, "lock.json") : undefined;
    if (stagedConfig && plan.config) await writeFile(stagedConfig, stateJson(plan.config), "utf8");
    if (stagedLock && plan.lock) await writeFile(stagedLock, stateJson(plan.lock), "utf8");
    swaps.push(await exchange(configPath, stagedConfig, path.join(oldRoot, "state")));
    swaps.push(await exchange(lockPath, stagedLock, path.join(oldRoot, "state")));

    await rm(transaction, { recursive: true, force: true });
    await removeIfEmpty(path.join(stateRoot, "staging"));
    await removeIfEmpty(stateRoot);
    const result: ApplyResult = { changed: true };
    if (backupPath) result.backupPath = backupPath;
    return result;
  } catch (error) {
    try {
      await rollback(swaps);
    } catch (rollbackError) {
      throw new MattpackError("APPLY_FAILED", "Apply and rollback failed", {
        apply: asMattpackError(error).message,
        rollback: asMattpackError(rollbackError).message,
        transaction: relativePath(projectRoot, transaction)
      });
    }
    await rm(transaction, { recursive: true, force: true });
    throw asMattpackError(error);
  }
}
