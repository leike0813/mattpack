import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  loadCatalogFromVendor,
  loadUpstreamLock,
  UPSTREAM_ID
} from "../src/catalog/upstream.js";

const projectRoot = process.cwd();
const lock = await loadUpstreamLock(projectRoot);
const upstream = lock.upstreams[UPSTREAM_ID];
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mattpack-upstream-"));
const checkout = path.join(temporaryRoot, "checkout");
const vendorRoot = path.resolve(projectRoot, upstream.vendorPath);
const vendorParent = path.dirname(vendorRoot);
const staging = path.join(vendorParent, `.staging-${randomUUID()}`);
const previous = path.join(vendorParent, `.previous-${randomUUID()}`);

function git(...args: string[]): Buffer {
  return execFileSync("git", args, { cwd: projectRoot, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
}

try {
  await mkdir(checkout, { recursive: true });
  git("init", "--quiet", checkout);
  git("-C", checkout, "remote", "add", "origin", upstream.repository);
  git("-C", checkout, "fetch", "--quiet", "--depth=1", "origin", upstream.commit);
  git("-C", checkout, "checkout", "--quiet", "--detach", "FETCH_HEAD");
  const actualCommit = git("-C", checkout, "rev-parse", "HEAD").toString("utf8").trim();
  if (actualCommit !== upstream.commit) throw new Error(`Fetched ${actualCommit}, expected ${upstream.commit}`);

  const records = git("-C", checkout, "ls-tree", "-r", "-z", "HEAD").toString("utf8").split("\0");
  await mkdir(staging, { recursive: true });
  for (const record of records) {
    if (!record) continue;
    const match = /^(\d+) (\w+) ([0-9a-f]+)\t([\s\S]+)$/u.exec(record);
    if (!match) throw new Error(`Unparseable Git tree entry: ${record}`);
    const [, mode, type, , gitPath] = match;
    const selected = gitPath === "LICENSE"
      || gitPath === ".claude-plugin/plugin.json"
      || /^(?:skills\/(?:engineering|productivity|in-progress|misc))\//u.test(gitPath ?? "");
    if (!selected) continue;
    if (type !== "blob" || (mode !== "100644" && mode !== "100755")) {
      throw new Error(`Unsupported upstream entry: ${mode} ${type} ${gitPath}`);
    }
    if (!gitPath || gitPath.includes("\\") || path.posix.isAbsolute(gitPath) || gitPath.split("/").includes("..")) {
      throw new Error(`Unsafe upstream path: ${gitPath}`);
    }
    const destination = path.join(staging, ...gitPath.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(checkout, ...gitPath.split("/")), destination);
    await chmod(destination, mode === "100755" ? 0o755 : 0o644);
  }

  const catalog = await loadCatalogFromVendor(lock, staging, projectRoot);
  await mkdir(vendorParent, { recursive: true });
  let movedPrevious = false;
  try {
    await rename(vendorRoot, previous);
    movedPrevious = true;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  try {
    await rename(staging, vendorRoot);
  } catch (error) {
    if (movedPrevious) await rename(previous, vendorRoot);
    throw error;
  }
  if (movedPrevious) await rm(previous, { recursive: true, force: true });
  process.stdout.write(`${JSON.stringify({ commit: upstream.commit, skills: catalog.skills.size })}\n`);
} finally {
  await rm(staging, { recursive: true, force: true });
  await rm(temporaryRoot, { recursive: true, force: true });
}
