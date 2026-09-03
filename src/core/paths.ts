import { execFile } from "node:child_process";
import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { MattpackError } from "./errors.js";

const execFileAsync = promisify(execFile);

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export async function assertContained(projectRoot: string, target: string): Promise<string> {
  const root = await realpath(projectRoot);
  const resolved = path.resolve(target);
  if (!inside(root, resolved)) {
    throw new MattpackError("PATH_OUTSIDE_PROJECT", `Path escapes project: ${target}`);
  }

  const relative = path.relative(root, resolved);
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new MattpackError("PATH_OUTSIDE_PROJECT", `Linked path component is not writable: ${current}`);
      }
    } catch (error) {
      if (error instanceof MattpackError) throw error;
      if (error instanceof Error && "code" in error && error.code === "ENOENT") break;
      throw error;
    }
  }
  return resolved;
}

async function directory(candidate: string): Promise<string> {
  const resolved = await realpath(candidate);
  if (!(await stat(resolved)).isDirectory()) {
    throw new MattpackError("INVALID_ARGUMENT", `Not a directory: ${candidate}`);
  }
  return resolved;
}

async function findStateRoot(start: string): Promise<string | undefined> {
  let current = await directory(start);
  while (true) {
    try {
      if ((await stat(path.join(current, ".mattpack", "config.json"))).isFile()) return current;
    } catch {
      // Keep walking.
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export async function resolveProjectRoot(options: { dir?: string; cwd?: string } = {}): Promise<string> {
  const cwd = await directory(options.cwd ?? process.cwd());
  if (options.dir) return directory(path.resolve(cwd, options.dir));
  const stateRoot = await findStateRoot(cwd);
  if (stateRoot) return stateRoot;
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
    return directory(stdout.trim());
  } catch {
    return cwd;
  }
}

export function relativePath(projectRoot: string, target: string): string {
  return path.relative(projectRoot, target).split(path.sep).join("/");
}
