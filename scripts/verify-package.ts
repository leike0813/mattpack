import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const packageRoot = process.cwd();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const packageManifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as unknown;
if (!isRecord(packageManifest) || typeof packageManifest.name !== "string") {
  throw new Error("package.json does not contain a valid package name");
}
const packageName = packageManifest.name;

async function run(command: string, args: readonly string[], cwd: string): Promise<string> {
  const result = await runFile(command, [...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false" }
  });
  return String(result.stdout);
}

function parseResult(output: string): Record<string, unknown> {
  const value: unknown = JSON.parse(output);
  if (!isRecord(value) || value.ok !== true) throw new Error("CLI did not return a successful JSON result");
  return value;
}

async function doesNotExist(file: string): Promise<boolean> {
  try {
    await access(file);
    return false;
  } catch {
    return true;
  }
}

const temporary = await mkdtemp(path.join(os.tmpdir(), "mattpack-pack-"));
try {
  const packedOutput = await run(npm, ["pack", "--json", "--pack-destination", temporary], packageRoot);
  const packed: unknown = JSON.parse(packedOutput);
  const report = Array.isArray(packed) ? packed[0] : undefined;
  if (!isRecord(report) || typeof report.filename !== "string" || !Array.isArray(report.files)) {
    throw new Error("npm pack returned an invalid report");
  }
  const files = new Set(report.files.flatMap((entry) =>
    isRecord(entry) && typeof entry.path === "string" ? [entry.path] : []
  ));
  for (const required of [
    "dist/cli.js",
    "README.md",
    "README.zh-CN.md",
    "upstream.lock.json",
    "vendor/mattpocock-skills/LICENSE",
    "vendor/mattpocock-skills/skills/engineering/tdd/SKILL.md"
  ]) {
    if (!files.has(required)) throw new Error("Packed artifact is missing " + required);
  }
  for (const file of files) {
    if (["references/OpenSpec", "tests/", "scripts/", "src/", "skills/", ".agents/", ".codex/", "var/", ".scripts-dist/"]
      .some((developmentPath) => file.startsWith(developmentPath))) {
      throw new Error("Packed artifact contains development-only path " + file);
    }
  }

  const installRoot = path.join(temporary, "install");
  const projectRoot = path.join(temporary, "project");
  await mkdir(installRoot);
  await mkdir(projectRoot);
  const tarball = path.join(temporary, report.filename);
  await run(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], installRoot);
  const installedPackageRoot = path.join(installRoot, "node_modules", ...packageName.split("/"));
  const cli = path.join(installedPackageRoot, "dist", "cli.js");
  const common = ["--dir", projectRoot, "--json"];

  const first = parseResult(await run(process.execPath, [cli, "init", "general", "--tools", "codex,minimax-code,warp", "--yes", ...common], installRoot));
  const firstResult = isRecord(first.result) ? first.result : undefined;
  const firstApplied = firstResult && isRecord(firstResult.applied) ? firstResult.applied : undefined;
  if (firstApplied?.changed !== true) throw new Error("Packed CLI did not install skills");
  const lock = JSON.parse(await readFile(path.join(projectRoot, ".mattpack", "lock.json"), "utf8")) as unknown;
  if (!isRecord(lock) || !Array.isArray(lock.targets) || lock.targets.length !== 2 || !Array.isArray(lock.harnesses)
    || lock.harnesses.length !== 3) {
    throw new Error("Packed CLI did not deduplicate three consumers into two physical roots");
  }
  const sharedTarget = lock.targets.find((target) => isRecord(target) && target.root === ".agents/skills");
  if (!isRecord(sharedTarget) || !Array.isArray(sharedTarget.consumers)
    || sharedTarget.consumers.join(",") !== "codex,warp") {
    throw new Error("Packed CLI did not record both shared-root consumers");
  }
  const minimaxTarget = lock.targets.find((target) => isRecord(target) && target.root === ".minimax/skills");
  if (!isRecord(minimaxTarget) || !Array.isArray(minimaxTarget.consumers)
    || minimaxTarget.consumers.join(",") !== "minimax-code") {
    throw new Error("Packed CLI did not install MiniMax Code at its independent root");
  }

  const doctor = parseResult(await run(process.execPath, [cli, "doctor", ...common], installRoot));
  const doctorResult = isRecord(doctor.result) ? doctor.result : undefined;
  if (doctorResult?.healthy !== true) throw new Error("Packed CLI doctor did not report a healthy install");

  const second = parseResult(await run(process.execPath, [cli, "init", "general", "--tools", "codex,minimax-code,warp", "--yes", ...common], installRoot));
  const secondResult = isRecord(second.result) ? second.result : undefined;
  const secondApplied = secondResult && isRecord(secondResult.applied) ? secondResult.applied : undefined;
  if (secondApplied?.changed !== false) throw new Error("Packed CLI reinstall was not idempotent");

  parseResult(await run(process.execPath, [cli, "remove", "--yes", ...common], installRoot));
  if (!(await doesNotExist(path.join(projectRoot, ".agents", "skills", "grill-me")))
    || !(await doesNotExist(path.join(projectRoot, ".minimax", "skills", "grill-me")))) {
    throw new Error("Packed CLI remove left a managed skill");
  }
  if (!(await doesNotExist(path.join(projectRoot, ".mattpack", "lock.json")))) throw new Error("Packed CLI remove left ownership state");

  const installedLock = JSON.parse(await readFile(path.join(installedPackageRoot, "upstream.lock.json"), "utf8")) as unknown;
  if (!isRecord(installedLock) || installedLock.schemaVersion !== 1) throw new Error("Installed upstream lock is invalid");
  process.stdout.write("Packed artifact passed offline init, doctor, idempotency, and remove smoke tests.\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
