import path from "node:path";

import type { ConfigState, ExistingSkill, LockState, ManagedFile, ManagedSkill } from "./state.js";
import { stateJson } from "./state.js";

export interface DesiredSkill extends ManagedSkill {
  sourceDirectory: string;
}

export type PlanActionKind = "add" | "replace" | "remove";

export interface PlanAction {
  kind: PlanActionKind;
  key: string;
  root: string;
  name: string;
  expected: ExistingSkill;
  preserveFiles: readonly string[];
  desired?: DesiredSkill;
}

export interface PlanIssue {
  code: "UNOWNED_DESTINATION" | "LOCAL_MODIFICATION" | "EXTRA_FILE" | "MISSING_MANAGED_SKILL" | "INVALID_OWNERSHIP";
  key: string;
  paths: readonly string[];
}

export interface ReconciliationPlan {
  command: "init" | "inspect" | "update" | "remove";
  config?: ConfigState;
  lock?: LockState;
  actions: readonly PlanAction[];
  unchanged: readonly string[];
  conflicts: readonly PlanIssue[];
  divergences: readonly PlanIssue[];
  stateNeedsWrite: boolean;
}

export function skillKey(root: string, name: string): string {
  return `${root}/${name}`;
}

function fileMap(files: readonly ManagedFile[]): Map<string, string> {
  return new Map(files.map((file) => [file.path, file.sha256]));
}

function matchingOwnership(existing: ExistingSkill, prior: ManagedSkill, installationId: string): boolean {
  return existing.owner?.installationId === installationId && existing.owner.sourcePath === prior.sourcePath;
}

function modifiedFiles(existing: ExistingSkill, prior: ManagedSkill): string[] {
  const current = fileMap(existing.files);
  return prior.files.filter((file) => current.get(file.path) !== file.sha256).map((file) => file.path).sort();
}

function extraFiles(existing: ExistingSkill, prior: ManagedSkill): string[] {
  const managed = new Set(prior.files.map((file) => file.path));
  return existing.files.filter((file) => !managed.has(file.path)).map((file) => file.path).sort();
}

function removalPreservation(existing: ExistingSkill, prior: ManagedSkill): { changed: string[]; preserved: string[] } {
  const changed = [...new Set([...modifiedFiles(existing, prior), ...extraFiles(existing, prior)])].sort();
  const currentPaths = new Set(existing.files.map((file) => file.path));
  return { changed, preserved: changed.filter((file) => currentPaths.has(file)) };
}

function desiredMatches(existing: ExistingSkill, desired: DesiredSkill): boolean {
  const current = fileMap(existing.files);
  return desired.files.every((file) => current.get(file.path) === file.sha256);
}

function sortActions(actions: PlanAction[]): PlanAction[] {
  return actions.sort((left, right) => left.key.localeCompare(right.key) || left.kind.localeCompare(right.kind));
}

function sortIssues(issues: PlanIssue[]): PlanIssue[] {
  return issues.sort((left, right) => left.key.localeCompare(right.key) || left.code.localeCompare(right.code));
}

export function planInstall(input: {
  command: "init" | "inspect" | "update";
  config: ConfigState;
  lock: LockState;
  priorConfig?: ConfigState;
  priorLock?: LockState;
  desiredSkills: readonly DesiredSkill[];
  existing: ReadonlyMap<string, ExistingSkill>;
}): ReconciliationPlan {
  const actions: PlanAction[] = [];
  const conflicts: PlanIssue[] = [];
  const divergences: PlanIssue[] = [];
  const unchanged: string[] = [];
  const priorByKey = new Map((input.priorLock?.managedSkills ?? []).map((skill) => [skillKey(skill.root, skill.name), skill]));
  const desiredKeys = new Set(input.desiredSkills.map((skill) => skillKey(skill.root, skill.name)));

  for (const desired of input.desiredSkills) {
    const key = skillKey(desired.root, desired.name);
    const existing = input.existing.get(key) ?? { exists: false, files: [] };
    const prior = priorByKey.get(key);
    if (!existing.exists) {
      if (prior) divergences.push({ code: "MISSING_MANAGED_SKILL", key, paths: [key] });
      actions.push({ kind: "add", key, root: desired.root, name: desired.name, expected: existing, preserveFiles: [], desired });
      continue;
    }
    if (!prior || !input.priorLock || !matchingOwnership(existing, prior, input.priorLock.installationId)) {
      conflicts.push({ code: prior ? "INVALID_OWNERSHIP" : "UNOWNED_DESTINATION", key, paths: [key] });
      actions.push({ kind: "replace", key, root: desired.root, name: desired.name, expected: existing, preserveFiles: [], desired });
      continue;
    }

    const modified = modifiedFiles(existing, prior);
    const extras = extraFiles(existing, prior);
    const desiredPaths = new Set(desired.files.map((file) => file.path));
    const extraCollisions = extras.filter((file) => desiredPaths.has(file));
    if (modified.length > 0) conflicts.push({ code: "LOCAL_MODIFICATION", key, paths: modified });
    if (extraCollisions.length > 0) conflicts.push({ code: "UNOWNED_DESTINATION", key, paths: extraCollisions });
    if (extras.length > 0) divergences.push({ code: "EXTRA_FILE", key, paths: extras });
    const ownerMatchesDesired = existing.owner?.sourcePath === desired.sourcePath;
    if (modified.length === 0 && extraCollisions.length === 0 && ownerMatchesDesired && desiredMatches(existing, desired)) unchanged.push(key);
    else actions.push({
      kind: "replace",
      key,
      root: desired.root,
      name: desired.name,
      expected: existing,
      preserveFiles: extras.filter((file) => !desiredPaths.has(file)),
      desired
    });
  }

  for (const prior of input.priorLock?.managedSkills ?? []) {
    const key = skillKey(prior.root, prior.name);
    if (desiredKeys.has(key)) continue;
    const existing = input.existing.get(key) ?? { exists: false, files: [] };
    if (!existing.exists) {
      divergences.push({ code: "MISSING_MANAGED_SKILL", key, paths: [key] });
      continue;
    }
    if (!input.priorLock || !matchingOwnership(existing, prior, input.priorLock.installationId)) {
      divergences.push({ code: "INVALID_OWNERSHIP", key, paths: [key] });
      continue;
    }
    const { changed, preserved } = removalPreservation(existing, prior);
    if (changed.length > 0) divergences.push({ code: "LOCAL_MODIFICATION", key, paths: changed });
    actions.push({ kind: "remove", key, root: prior.root, name: prior.name, expected: existing, preserveFiles: preserved });
  }

  const stateNeedsWrite = stateJson(input.priorConfig) !== stateJson(input.config)
    || stateJson(input.priorLock) !== stateJson(input.lock);
  return {
    command: input.command,
    config: input.config,
    lock: input.lock,
    actions: sortActions(actions),
    unchanged: unchanged.sort(),
    conflicts: sortIssues(conflicts),
    divergences: sortIssues(divergences),
    stateNeedsWrite
  };
}

export function planRemove(input: {
  priorLock: LockState;
  existing: ReadonlyMap<string, ExistingSkill>;
}): ReconciliationPlan {
  const actions: PlanAction[] = [];
  const divergences: PlanIssue[] = [];
  for (const prior of input.priorLock.managedSkills) {
    const key = skillKey(prior.root, prior.name);
    const existing = input.existing.get(key) ?? { exists: false, files: [] };
    if (!existing.exists) {
      divergences.push({ code: "MISSING_MANAGED_SKILL", key, paths: [key] });
      continue;
    }
    if (!matchingOwnership(existing, prior, input.priorLock.installationId)) {
      divergences.push({ code: "INVALID_OWNERSHIP", key, paths: [key] });
      continue;
    }
    const { changed, preserved } = removalPreservation(existing, prior);
    if (changed.length > 0) divergences.push({ code: "LOCAL_MODIFICATION", key, paths: changed });
    actions.push({ kind: "remove", key, root: prior.root, name: prior.name, expected: existing, preserveFiles: preserved });
  }
  return {
    command: "remove",
    actions: sortActions(actions),
    unchanged: [],
    conflicts: [],
    divergences: sortIssues(divergences),
    stateNeedsWrite: true
  };
}

export function skillDirectory(projectRoot: string, root: string, name: string): string {
  return path.join(projectRoot, ...root.split("/"), name);
}
