import { createHash } from "node:crypto";
import path from "node:path";

import { SKILL_DEPENDENCIES } from "../catalog/dependencies.js";
import { CANONICAL_PRESETS, PRESETS, presetRoots, type CanonicalPreset } from "../catalog/presets.js";
import {
  hashFile,
  loadUpstreamCatalog,
  packageRootFrom,
  UPSTREAM_ID
} from "../catalog/upstream.js";
import { deduplicateTargets, HARNESS_ADAPTERS, selectHarnesses } from "../harnesses/registry.js";
import type { DetectionResult, HarnessTarget } from "../harnesses/types.js";
import { applyPlan, type ApplyResult } from "./apply.js";
import { resolveSkillSet, type ResolvedSkills } from "./dependency-graph.js";
import { MattpackError } from "./errors.js";
import { assertContained } from "./paths.js";
import {
  planInstall,
  planRemove,
  skillDirectory,
  skillKey,
  type DesiredSkill,
  type ReconciliationPlan
} from "./plan.js";
import {
  readConfig,
  readLock,
  readPackageVersion,
  scanSkill,
  type ConfigState,
  type ExistingSkill,
  type LockState,
  type ManagedFile
} from "./state.js";

export interface OperationResult {
  command: "init" | "inspect" | "update" | "doctor" | "remove";
  projectRoot: string;
  plan: ReconciliationPlan;
  resolution?: ResolvedSkills;
  targets?: readonly HarnessTarget[];
  applied?: ApplyResult;
  healthy?: boolean;
}

export interface ListResult {
  presets: readonly {
    name: CanonicalPreset;
    aliases: readonly string[];
    purpose: string;
    rootCount: number;
    resolvedCount: number;
  }[];
  harnesses: readonly { id: string; displayName: string; root: string }[];
}

interface Desired {
  config: ConfigState;
  lock: LockState;
  resolution: ResolvedSkills;
  targets: readonly HarnessTarget[];
  skills: readonly DesiredSkill[];
}

function installationId(projectRoot: string): string {
  return createHash("sha256").update(path.resolve(projectRoot)).digest("hex").slice(0, 32);
}

async function desiredInstallation(input: {
  projectRoot: string;
  packageRoot: string;
  preset: CanonicalPreset;
  harnessIds: readonly string[];
  includeDependencies: boolean;
  priorLock?: LockState;
}): Promise<Desired> {
  const catalog = await loadUpstreamCatalog(input.packageRoot);
  const adapters = selectHarnesses(input.harnessIds);
  if (adapters.length === 0) throw new MattpackError("NON_INTERACTIVE_INPUT_REQUIRED", "Select at least one harness");
  const targets = deduplicateTargets(input.projectRoot, adapters);
  for (const target of targets) await assertContained(input.projectRoot, target.absoluteRoot);
  const resolution = resolveSkillSet(
    presetRoots(input.preset, catalog),
    new Set(catalog.skills.keys()),
    SKILL_DEPENDENCIES,
    input.includeDependencies
  );
  const hashed = new Map<string, readonly ManagedFile[]>();
  for (const name of resolution.skills) {
    const skill = catalog.skills.get(name);
    if (!skill) throw new MattpackError("MISSING_SKILL", `Missing resolved skill: ${name}`);
    const sourceDirectory = path.join(catalog.vendorRoot, ...skill.sourcePath.split("/"));
    const files = await Promise.all(skill.files.map(async (filePath) => ({
      path: filePath,
      sha256: await hashFile(path.join(sourceDirectory, ...filePath.split("/")))
    })));
    hashed.set(name, files.sort((left, right) => left.path.localeCompare(right.path)));
  }

  const skills: DesiredSkill[] = [];
  for (const target of targets) {
    for (const name of resolution.skills) {
      const skill = catalog.skills.get(name);
      const files = hashed.get(name);
      if (!skill || !files) throw new MattpackError("MISSING_SKILL", `Missing resolved skill: ${name}`);
      skills.push({
        root: target.root,
        name,
        sourcePath: skill.sourcePath,
        sourceDirectory: path.join(catalog.vendorRoot, ...skill.sourcePath.split("/")),
        files
      });
    }
  }
  skills.sort((left, right) => left.root.localeCompare(right.root) || left.name.localeCompare(right.name));

  const harnesses = adapters.map((item) => item.id).sort();
  const config: ConfigState = {
    schemaVersion: 1,
    preset: input.preset,
    harnesses,
    includeDependencies: input.includeDependencies
  };
  const lock: LockState = {
    schemaVersion: 1,
    mattpackVersion: await readPackageVersion(input.packageRoot),
    installationId: input.priorLock?.installationId ?? installationId(input.projectRoot),
    upstreamCommit: catalog.lock.upstreams[UPSTREAM_ID].commit,
    preset: input.preset,
    includeDependencies: input.includeDependencies,
    roots: resolution.roots,
    dependencies: resolution.dependencies,
    harnesses,
    targets: targets.map((target) => ({ root: target.root, consumers: target.consumers })),
    managedSkills: skills.map(({ root, name, sourcePath, files }) => ({ root, name, sourcePath, files }))
  };
  return { config, lock, resolution, targets, skills };
}

async function scanPlanSkills(
  projectRoot: string,
  desired: readonly DesiredSkill[],
  priorLock?: LockState
): Promise<Map<string, ExistingSkill>> {
  const keys = new Map<string, { root: string; name: string }>();
  for (const skill of desired) keys.set(skillKey(skill.root, skill.name), skill);
  for (const skill of priorLock?.managedSkills ?? []) keys.set(skillKey(skill.root, skill.name), skill);
  const existing = new Map<string, ExistingSkill>();
  for (const [key, skill] of [...keys].sort(([left], [right]) => left.localeCompare(right))) {
    const directory = await assertContained(projectRoot, skillDirectory(projectRoot, skill.root, skill.name));
    existing.set(key, await scanSkill(directory));
  }
  return existing;
}

async function priorState(projectRoot: string): Promise<{ config?: ConfigState; lock?: LockState }> {
  const config = await readConfig(projectRoot, true);
  const lock = await readLock(projectRoot, true);
  if (Boolean(config) !== Boolean(lock)) throw new MattpackError("INVALID_STATE", "config.json and lock.json must exist together");
  const result: { config?: ConfigState; lock?: LockState } = {};
  if (config) result.config = config;
  if (lock) result.lock = lock;
  return result;
}

export async function installProject(input: {
  command?: "init" | "inspect";
  projectRoot: string;
  packageRoot?: string;
  preset: CanonicalPreset;
  harnesses: readonly string[];
  includeDependencies?: boolean;
  dryRun?: boolean;
  force?: boolean;
}): Promise<OperationResult> {
  const command = input.command ?? "init";
  const packageRoot = input.packageRoot ?? packageRootFrom();
  const prior = await priorState(input.projectRoot);
  const desired = await desiredInstallation({
    projectRoot: input.projectRoot,
    packageRoot,
    preset: input.preset,
    harnessIds: input.harnesses,
    includeDependencies: input.includeDependencies ?? true,
    ...(prior.lock ? { priorLock: prior.lock } : {})
  });
  const existing = await scanPlanSkills(input.projectRoot, desired.skills, prior.lock);
  const plan = planInstall({
    command,
    config: desired.config,
    lock: desired.lock,
    desiredSkills: desired.skills,
    existing,
    ...(prior.config ? { priorConfig: prior.config } : {}),
    ...(prior.lock ? { priorLock: prior.lock } : {})
  });
  const result: OperationResult = {
    command,
    projectRoot: input.projectRoot,
    plan,
    resolution: desired.resolution,
    targets: desired.targets
  };
  if (command === "init" && !input.dryRun) result.applied = await applyPlan(input.projectRoot, plan, input.force);
  return result;
}

async function requireState(projectRoot: string): Promise<{ config: ConfigState; lock: LockState }> {
  const config = await readConfig(projectRoot, true);
  const lock = await readLock(projectRoot, true);
  if (!config || !lock) throw new MattpackError("NOT_INITIALIZED", `No Mattpack installation at ${projectRoot}`);
  return { config, lock };
}

async function updatePlan(projectRoot: string, packageRoot: string): Promise<{
  plan: ReconciliationPlan;
  resolution: ResolvedSkills;
  targets: readonly HarnessTarget[];
}> {
  const prior = await requireState(projectRoot);
  const desired = await desiredInstallation({
    projectRoot,
    packageRoot,
    preset: prior.config.preset,
    harnessIds: prior.config.harnesses,
    includeDependencies: prior.config.includeDependencies,
    priorLock: prior.lock
  });
  const existing = await scanPlanSkills(projectRoot, desired.skills, prior.lock);
  return {
    plan: planInstall({
      command: "update",
      config: desired.config,
      lock: desired.lock,
      priorConfig: prior.config,
      priorLock: prior.lock,
      desiredSkills: desired.skills,
      existing
    }),
    resolution: desired.resolution,
    targets: desired.targets
  };
}

export async function updateProject(input: {
  projectRoot: string;
  packageRoot?: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<OperationResult> {
  const planned = await updatePlan(input.projectRoot, input.packageRoot ?? packageRootFrom());
  const result: OperationResult = {
    command: "update",
    projectRoot: input.projectRoot,
    plan: planned.plan,
    resolution: planned.resolution,
    targets: planned.targets
  };
  if (!input.dryRun) result.applied = await applyPlan(input.projectRoot, planned.plan, input.force);
  return result;
}

export async function doctorProject(projectRoot: string, packageRoot = packageRootFrom()): Promise<OperationResult> {
  const planned = await updatePlan(projectRoot, packageRoot);
  const healthy = planned.plan.actions.length === 0
    && planned.plan.conflicts.length === 0
    && planned.plan.divergences.length === 0
    && !planned.plan.stateNeedsWrite;
  return {
    command: "doctor",
    projectRoot,
    plan: planned.plan,
    resolution: planned.resolution,
    targets: planned.targets,
    healthy
  };
}

export async function removeProject(input: { projectRoot: string; dryRun?: boolean }): Promise<OperationResult> {
  const prior = await requireState(input.projectRoot);
  const existing = await scanPlanSkills(input.projectRoot, [], prior.lock);
  const plan = planRemove({ priorLock: prior.lock, existing });
  const result: OperationResult = { command: "remove", projectRoot: input.projectRoot, plan };
  if (!input.dryRun) result.applied = await applyPlan(input.projectRoot, plan);
  return result;
}

export async function listCatalog(packageRoot = packageRootFrom()): Promise<ListResult> {
  const catalog = await loadUpstreamCatalog(packageRoot);
  const available = new Set(catalog.skills.keys());
  return {
    presets: CANONICAL_PRESETS.map((name) => {
      const roots = presetRoots(name, catalog);
      return {
        name,
        aliases: PRESETS[name].aliases,
        purpose: PRESETS[name].purpose,
        rootCount: roots.length,
        resolvedCount: resolveSkillSet(roots, available, SKILL_DEPENDENCIES).skills.length
      };
    }),
    harnesses: HARNESS_ADAPTERS.map((adapter) => ({
      id: adapter.id,
      displayName: adapter.displayName,
      root: path.relative("/project", adapter.getSkillRoot("/project")).split(path.sep).join("/")
    }))
  };
}

export async function detectHarnesses(projectRoot: string): Promise<readonly {
  id: string;
  displayName: string;
  result: DetectionResult;
}[]> {
  const detected = await Promise.all(HARNESS_ADAPTERS.map(async (adapter) => ({
    id: adapter.id,
    displayName: adapter.displayName,
    result: await adapter.detect(projectRoot)
  })));
  return detected.filter((entry) => entry.result.detected);
}
