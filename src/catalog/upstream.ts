import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MattpackError } from "../core/errors.js";

export const UPSTREAM_ID = "mattpocock/skills";
export const SOURCE_BUCKETS = ["engineering", "productivity", "in-progress", "misc"] as const;
export type SourceBucket = (typeof SOURCE_BUCKETS)[number];

export interface UpstreamLock {
  schemaVersion: 1;
  upstreams: Record<typeof UPSTREAM_ID, {
    repository: string;
    commit: string;
    vendorPath: string;
    license: "MIT";
  }>;
}

export interface SkillRecord {
  name: string;
  description: string;
  bucket: SourceBucket;
  sourcePath: string;
  files: readonly string[];
}

export interface UpstreamCatalog {
  lock: UpstreamLock;
  packageRoot: string;
  vendorRoot: string;
  skills: ReadonlyMap<string, SkillRecord>;
  byBucket: Readonly<Record<SourceBucket, readonly string[]>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string, details?: unknown): never {
  throw new MattpackError("INVALID_UPSTREAM", message, details);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) invalid(`Invalid upstream field: ${key}`);
  return value;
}

export function packageRootFrom(importMetaUrl = import.meta.url): string {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "../..");
}

export async function loadUpstreamLock(packageRoot = packageRootFrom()): Promise<UpstreamLock> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.join(packageRoot, "upstream.lock.json"), "utf8"));
  } catch (error) {
    invalid("Unable to read upstream.lock.json", error);
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !isRecord(parsed.upstreams)) {
    invalid("Unsupported upstream lock schema");
  }
  const entry = parsed.upstreams[UPSTREAM_ID];
  if (!isRecord(entry)) invalid(`Missing upstream: ${UPSTREAM_ID}`);
  const repository = stringField(entry, "repository");
  const commit = stringField(entry, "commit");
  const vendorPath = stringField(entry, "vendorPath");
  const license = stringField(entry, "license");
  if (!/^[0-9a-f]{40}$/.test(commit)) invalid("Upstream commit must be a full lowercase SHA");
  if (license !== "MIT") invalid("Unexpected upstream license");
  if (path.isAbsolute(vendorPath) || vendorPath.split(/[\\/]/u).includes("..")) {
    invalid("Upstream vendorPath must stay inside the package");
  }
  return {
    schemaVersion: 1,
    upstreams: {
      [UPSTREAM_ID]: { repository, commit, vendorPath, license }
    }
  };
}

function frontmatter(content: string, source: string): { name: string; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  if (!match?.[1]) invalid(`Missing YAML frontmatter: ${source}`);
  const lines = match[1].split(/\r?\n/u);
  const scalar = (key: "name" | "description"): string => {
    const values = lines
      .filter((line) => new RegExp(`^${key}\\s*:`).test(line))
      .map((line) => line.replace(new RegExp(`^${key}\\s*:\\s*`), "").trim().replace(/^(['"])(.*)\1$/u, "$2"));
    if (values.length !== 1 || !values[0] || values[0] === ">" || values[0] === "|") {
      invalid(`Invalid skill ${key} in ${source}`);
    }
    return values[0];
  };
  const name = scalar("name");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) {
    invalid(`Invalid skill name in ${source}`);
  }
  return { name, description: scalar("description") };
}

async function listSkillFiles(skillRoot: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
        invalid(`Unsupported upstream entry: ${absolute}`);
      }
      if (entry.isDirectory()) await visit(absolute);
      else {
        const relative = path.relative(skillRoot, absolute);
        if (path.isAbsolute(relative) || relative.split(path.sep).includes("..")) {
          invalid(`Unsafe upstream path: ${relative}`);
        }
        files.push(relative.split(path.sep).join("/"));
      }
    }
  }
  await visit(skillRoot);
  return files;
}

async function skillDirectories(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    invalid(`Missing upstream source bucket: ${root}`, error);
  }
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    invalid(`Invalid string array: ${field}`);
  }
  return [...value].sort();
}

export async function loadCatalogFromVendor(
  lock: UpstreamLock,
  vendorRoot: string,
  packageRoot = path.dirname(path.dirname(vendorRoot))
): Promise<UpstreamCatalog> {
  const skills = new Map<string, SkillRecord>();
  const byBucket: Record<SourceBucket, string[]> = {
    engineering: [],
    productivity: [],
    "in-progress": [],
    misc: []
  };

  for (const bucket of SOURCE_BUCKETS) {
    const bucketRoot = path.join(vendorRoot, "skills", bucket);
    for (const directoryName of await skillDirectories(bucketRoot)) {
      const skillRoot = path.join(bucketRoot, directoryName);
      const sourcePath = `skills/${bucket}/${directoryName}`;
      let skillMd: string;
      try {
        skillMd = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
      } catch (error) {
        invalid(`Missing SKILL.md: ${sourcePath}`, error);
      }
      const { name, description } = frontmatter(skillMd, `${sourcePath}/SKILL.md`);
      if (name !== directoryName) invalid(`Skill directory and frontmatter disagree: ${sourcePath}`);
      if (skills.has(name)) invalid(`Duplicate skill identity: ${name}`);
      const record = { name, description, bucket, sourcePath, files: await listSkillFiles(skillRoot) };
      skills.set(name, record);
      byBucket[bucket].push(name);
    }
  }

  const counts = {
    stable: byBucket.engineering.length + byBucket.productivity.length,
    beta: byBucket["in-progress"].length,
    misc: byBucket.misc.length
  };
  if (counts.stable !== 27 || counts.beta !== 7 || counts.misc !== 4 || skills.size !== 38) {
    invalid("Unexpected upstream skill counts", counts);
  }

  let plugin: unknown;
  try {
    plugin = JSON.parse(await readFile(path.join(vendorRoot, ".claude-plugin", "plugin.json"), "utf8"));
  } catch (error) {
    invalid("Unable to read upstream plugin manifest", error);
  }
  if (!isRecord(plugin)) invalid("Invalid upstream plugin manifest");
  const manifestSkills = stringArray(plugin.skills, "plugin.skills")
    .map((entry) => entry.replace(/^\.\/skills\//u, ""));
  const stablePaths = [...skills.values()]
    .filter((skill) => skill.bucket === "engineering" || skill.bucket === "productivity")
    .map((skill) => skill.sourcePath.replace(/^skills\//u, ""))
    .sort();
  if (JSON.stringify(manifestSkills) !== JSON.stringify(stablePaths)) {
    invalid("Promoted skill directories do not match the plugin manifest");
  }

  return { lock, packageRoot, vendorRoot, skills, byBucket };
}

export async function loadUpstreamCatalog(packageRoot = packageRootFrom()): Promise<UpstreamCatalog> {
  const lock = await loadUpstreamLock(packageRoot);
  const entry = lock.upstreams[UPSTREAM_ID];
  const vendorRoot = path.resolve(packageRoot, entry.vendorPath);
  const relative = path.relative(packageRoot, vendorRoot);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    invalid("Resolved vendor path escapes the package");
  }
  return loadCatalogFromVendor(lock, vendorRoot, packageRoot);
}

export async function hashFile(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
