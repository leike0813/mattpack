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
    "upstream.lock.json",
    "vendor/mattpocock-skills/LICENSE",
    "vendor/mattpocock-skills/skills/engineering/tdd/SKILL.md"
  ]) {
    if (!files.has(required)) throw new Error("Packed artifact is missing " + required);
  }
  for (const file of files) {
    if (file.startsWith("references/OpenSpec") || file.startsWith("tests/") || file.startsWith("scripts/")) {
      throw new Error("Packed artifact contains development-only path " + file);
    }
  }

  const installRoot = path.join(temporary, "install");
  const projectRoot = path.join(temporary, "project");
  await mkdir(installRoot);
  await mkdir(projectRoot);
  const tarball = path.join(temporary, report.filename);
  await run(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], installRoot);
  const cli = path.join(installRoot, "node_modules", "mattpack", "dist", "cli.js");
  const common = ["--dir", projectRoot, "--json"];

  const first = parseResult(await run(process.execPath, [cli, "init", "general", "--harness", "codex", "--yes", ...common], installRoot));
  const firstResult = isRecord(first.result) ? first.result : undefined;
  const firstApplied = firstResult && isRecord(firstResult.applied) ? firstResult.applied : undefined;
  if (firstApplied?.changed !== true) throw new Error("Packed CLI did not install skills");

  const doctor = parseResult(await run(process.execPath, [cli, "doctor", ...common], installRoot));
  const doctorResult = isRecord(doctor.result) ? doctor.result : undefined;
  if (doctorResult?.healthy !== true) throw new Error("Packed CLI doctor did not report a healthy install");

  const second = parseResult(await run(process.execPath, [cli, "init", "general", "--harness", "codex", "--yes", ...common], installRoot));
  const secondResult = isRecord(second.result) ? second.result : undefined;
  const secondApplied = secondResult && isRecord(secondResult.applied) ? secondResult.applied : undefined;
  if (secondApplied?.changed !== false) throw new Error("Packed CLI reinstall was not idempotent");

  parseResult(await run(process.execPath, [cli, "remove", "--yes", ...common], installRoot));
  if (!(await doesNotExist(path.join(projectRoot, ".agents", "skills", "grill-me")))) throw new Error("Packed CLI remove left a managed skill");
  if (!(await doesNotExist(path.join(projectRoot, ".mattpack", "lock.json")))) throw new Error("Packed CLI remove left ownership state");

  const installedLock = JSON.parse(await readFile(path.join(installRoot, "node_modules", "mattpack", "upstream.lock.json"), "utf8")) as unknown;
  if (!isRecord(installedLock) || installedLock.schemaVersion !== 1) throw new Error("Installed upstream lock is invalid");
  process.stdout.write("Packed artifact passed offline init, doctor, idempotency, and remove smoke tests.\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
