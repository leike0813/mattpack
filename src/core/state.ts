import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { canonicalPreset, type CanonicalPreset } from "../catalog/presets.js";
import type { DependencyAddition } from "./dependency-graph.js";
import { MattpackError } from "./errors.js";

export const OWNER_FILE = ".mattpack-owner.json";

export interface ConfigState {
  schemaVersion: 1;
  preset: CanonicalPreset;
  additionalSkills: readonly string[];
  harnesses: readonly string[];
  includeDependencies: boolean;
}

export interface ManagedFile {
  path: string;
  sha256: string;
}

export interface ManagedSkill {
  root: string;
  name: string;
  sourcePath: string;
  files: readonly ManagedFile[];
}

export interface LockedTarget {
  root: string;
  consumers: readonly string[];
}

export interface LockState {
  schemaVersion: 1;
  mattpackVersion: string;
  installationId: string;
  upstreamCommit: string;
  preset: CanonicalPreset;
  includeDependencies: boolean;
  roots: readonly string[];
  dependencies: readonly DependencyAddition[];
  harnesses: readonly string[];
  targets: readonly LockedTarget[];
  managedSkills: readonly ManagedSkill[];
}

export interface OwnerState {
  schemaVersion: 1;
  manager: "mattpack";
  installationId: string;
  sourcePath: string;
}

export interface ExistingSkill {
  exists: boolean;
  owner?: OwnerState;
  files: readonly ManagedFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string, details?: unknown): never {
  throw new MattpackError("INVALID_STATE", message, details);
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) invalid(`Invalid state field: ${key}`);
  return value;
}

function bool(record: Record<string, unknown>, key: string, fallback?: boolean): boolean {
  const value = record[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") invalid(`Invalid state field: ${key}`);
  return value;
}

function stringList(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) invalid(`Invalid state list: ${key}`);
  return [...new Set(value)].sort();
}

function stringSequence(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) invalid(`Invalid state list: ${key}`);
  return [...value];
}

function parseManagedFile(value: unknown): ManagedFile {
  if (!isRecord(value)) invalid("Invalid managed file");
  const filePath = text(value, "path");
  const sha256 = text(value, "sha256");
  if (path.posix.isAbsolute(filePath) || filePath.split("/").includes("..") || !/^[0-9a-f]{64}$/u.test(sha256)) {
    invalid(`Invalid managed file: ${filePath}`);
  }
  return { path: filePath, sha256 };
}

function parseManagedSkill(value: unknown): ManagedSkill {
  if (!isRecord(value) || !Array.isArray(value.files)) invalid("Invalid managed skill");
  return {
    root: text(value, "root"),
    name: text(value, "name"),
    sourcePath: text(value, "sourcePath"),
    files: value.files.map(parseManagedFile).sort((left, right) => left.path.localeCompare(right.path))
  };
}

function parseDependency(value: unknown): DependencyAddition {
  if (!isRecord(value)) invalid("Invalid dependency entry");
  const kind = text(value, "kind");
  if (kind !== "requires" && kind !== "setupCompanion") invalid(`Invalid dependency kind: ${kind}`);
  return { name: text(value, "name"), kind, chain: stringSequence(value.chain, "dependency.chain") };
}

function parseTarget(value: unknown): LockedTarget {
  if (!isRecord(value)) invalid("Invalid target entry");
  return { root: text(value, "root"), consumers: stringList(value.consumers, "target.consumers") };
}

async function json(file: string, optional: boolean): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (optional && error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    invalid(`Unable to read JSON state: ${file}`, error);
  }
}

export async function readConfig(projectRoot: string, optional = false): Promise<ConfigState | undefined> {
  const value = await json(path.join(projectRoot, ".mattpack", "config.json"), optional);
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.schemaVersion !== 1) invalid("Unsupported config schema");
  const preset = canonicalPreset(text(value, "preset"));
  return {
    schemaVersion: 1,
    preset,
    additionalSkills: value.additionalSkills === undefined
      ? []
      : stringList(value.additionalSkills, "config.additionalSkills"),
    harnesses: stringList(value.harnesses, "config.harnesses"),
    includeDependencies: bool(value, "includeDependencies", true)
  };
}

export async function readLock(projectRoot: string, optional = false): Promise<LockState | undefined> {
  const value = await json(path.join(projectRoot, ".mattpack", "lock.json"), optional);
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.schemaVersion !== 1) invalid("Unsupported lock schema");
  if (!Array.isArray(value.dependencies) || !Array.isArray(value.targets) || !Array.isArray(value.managedSkills)) {
    invalid("Invalid lock collections");
  }
  return {
    schemaVersion: 1,
    mattpackVersion: text(value, "mattpackVersion"),
    installationId: text(value, "installationId"),
    upstreamCommit: text(value, "upstreamCommit"),
    preset: canonicalPreset(text(value, "preset")),
    includeDependencies: bool(value, "includeDependencies"),
    roots: stringList(value.roots, "lock.roots"),
    dependencies: value.dependencies.map(parseDependency).sort((left, right) => left.name.localeCompare(right.name)),
    harnesses: stringList(value.harnesses, "lock.harnesses"),
    targets: value.targets.map(parseTarget).sort((left, right) => left.root.localeCompare(right.root)),
    managedSkills: value.managedSkills.map(parseManagedSkill).sort((left, right) =>
      left.root.localeCompare(right.root) || left.name.localeCompare(right.name))
  };
}

export function parseOwner(value: unknown): OwnerState {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.manager !== "mattpack") invalid("Invalid owner sidecar");
  return {
    schemaVersion: 1,
    manager: "mattpack",
    installationId: text(value, "installationId"),
    sourcePath: text(value, "sourcePath")
  };
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

export async function scanSkill(skillRoot: string): Promise<ExistingSkill> {
  try {
    const metadata = await lstat(skillRoot);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) invalid(`Skill target is not a real directory: ${skillRoot}`);
  } catch (error) {
    if (error instanceof MattpackError) throw error;
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { exists: false, files: [] };
    throw error;
  }

  let owner: OwnerState | undefined;
  const files: ManagedFile[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
        invalid(`Unsupported target entry: ${absolute}`);
      }
      if (entry.isDirectory()) await visit(absolute);
      else {
        const relative = path.relative(skillRoot, absolute).split(path.sep).join("/");
        if (relative === OWNER_FILE) {
          try {
            owner = parseOwner(JSON.parse(await readFile(absolute, "utf8")));
          } catch (error) {
            if (error instanceof MattpackError) throw error;
            invalid(`Unable to read owner sidecar: ${absolute}`, error);
          }
        } else files.push({ path: relative, sha256: await sha256(absolute) });
      }
    }
  }
  await visit(skillRoot);
  return owner ? { exists: true, owner, files } : { exists: true, files };
}

export function stateJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readPackageVersion(packageRoot: string): Promise<string> {
  const value = await json(path.join(packageRoot, "package.json"), false);
  if (!isRecord(value)) invalid("Invalid package.json");
  return text(value, "version");
}
