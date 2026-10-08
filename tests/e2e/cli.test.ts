import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const cli = path.join(packageRoot, "dist", "cli.js");

function run(args: readonly string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function json(result: Awaited<ReturnType<typeof run>>): Record<string, unknown> {
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe("CLI", () => {
  it("runs list, direct preset inspect, init, doctor, update, and remove", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-cli-"));
    try {
      const listed = await run(["list", "--json"]);
      assert.equal(listed.code, 0);
      assert.equal(json(listed).ok, true);

      const inspected = await run(["dev", "--dir", root, "--tools", "codex", "--dry-run", "--json"]);
      assert.equal(inspected.code, 0);
      assert.equal(json(inspected).command, "init");
      await assert.rejects(access(path.join(root, ".mattpack", "lock.json")));

      const initialized = await run(["init", "general", "--dir", root, "--tools", "codex", "--yes", "--json"]);
      assert.equal(initialized.code, 0);
      assert.equal(json(initialized).ok, true);

      const doctor = await run(["doctor", "--dir", root, "--json"]);
      assert.equal(doctor.code, 0);
      assert.match(doctor.stdout, /"healthy": true/u);

      const updated = await run(["update", "--dir", root, "--json"]);
      assert.equal(updated.code, 0);
      assert.match(updated.stdout, /"changed": false/u);

      const refusedRemove = await run(["remove", "--dir", root, "--json"]);
      assert.equal(refusedRemove.code, 1);
      assert.match(refusedRemove.stdout, /NON_INTERACTIVE_INPUT_REQUIRED/u);

      const removed = await run(["remove", "--dir", root, "--yes", "--json"]);
      assert.equal(removed.code, 0);
      assert.equal(json(removed).ok, true);
      await assert.rejects(access(path.join(root, ".mattpack")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses OpenSpec-style tool selection and defaults an omitted preset", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-cli-tools-"));
    try {
      const planned = await run(["init", "--dir", root, "--tools", "codex,claude", "--dry-run"]);
      assert.equal(planned.code, 0);
      assert.match(planned.stdout, /Mattpack init plan/u);
      assert.equal(planned.stderr, "");

      const powershell = await run([
        "init", "--dir", root,
        "--tools", "codex claude codebuddy opencode kilocode qwen kimi oh-my-pi pi",
        "--skills", "wayfinder", "--dry-run", "--json"
      ]);
      assert.equal(powershell.code, 0);
      const powershellResult = json(powershell).result as {
        resolution: { roots: string[] };
        targets: unknown[];
      };
      assert.equal(powershellResult.targets.length, 9);
      assert.ok(powershellResult.resolution.roots.includes("wayfinder"));

      const initialized = await run(["init", "--dir", root, "--tools", "codex,claude", "--yes", "--json"]);
      assert.equal(initialized.code, 0);
      const config = JSON.parse(await readFile(path.join(root, ".mattpack", "config.json"), "utf8")) as {
        preset?: unknown;
        additionalSkills?: unknown;
        harnesses?: unknown;
      };
      assert.equal(config.preset, "default");
      assert.deepEqual(config.additionalSkills, []);
      assert.deepEqual(config.harnesses, ["claude", "codex"]);

      const codebuddy = await run(["init", "general", "--dir", root, "--tools", "codebuddy", "--dry-run", "--json"]);
      assert.equal(codebuddy.code, 0);
      assert.match(codebuddy.stdout, /\.codebuddy\/skills/u);

      const oldFlag = await run(["init", "default", "--dir", root, "--harness", "codex", "--dry-run", "--json"]);
      assert.equal(oldFlag.code, 2);
      assert.match(oldFlag.stdout, /INVALID_ARGUMENT/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("adds explicit skills and preserves them as config intent", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-cli-skills-"));
    try {
      const initialized = await run([
        "init", "general", "--dir", root, "--tools", "codex", "--skills", "teach", "--yes", "--json"
      ]);
      assert.equal(initialized.code, 0);
      await access(path.join(root, ".agents", "skills", "teach", "SKILL.md"));

      const appended = await run(["init", "--dir", root, "--skills", "research", "--yes", "--json"]);
      assert.equal(appended.code, 0);
      const configFile = path.join(root, ".mattpack", "config.json");
      const config = JSON.parse(await readFile(configFile, "utf8")) as { additionalSkills?: unknown };
      assert.deepEqual(config.additionalSkills, ["research", "teach"]);

      const inspected = await run(["inspect", "--dir", root, "--skills", "wizard", "--json"]);
      assert.equal(inspected.code, 0);
      assert.deepEqual(
        (JSON.parse(await readFile(configFile, "utf8")) as { additionalSkills?: unknown }).additionalSkills,
        ["research", "teach"]
      );

      const unsupported = await run(["update", "--dir", root, "--skills", "wizard", "--json"]);
      assert.equal(unsupported.code, 2);
      assert.match(unsupported.stdout, /INVALID_ARGUMENT/u);

      const unknown = await run([
        "init", "--dir", root, "--tools", "codex", "--skills", "does-not-exist", "--dry-run", "--json"
      ]);
      assert.equal(unknown.code, 1);
      assert.match(unknown.stdout, /UNKNOWN_SKILL/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns structured non-interactive and argument errors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-cli-errors-"));
    try {
      const ambiguous = await run(["init", "general", "--dir", root, "--json"]);
      assert.equal(ambiguous.code, 1);
      assert.match(ambiguous.stdout, /NON_INTERACTIVE_INPUT_REQUIRED/u);
      json(ambiguous);

      const invalid = await run(["list", "--force", "--json"]);
      assert.equal(invalid.code, 2);
      assert.match(invalid.stdout, /INVALID_ARGUMENT/u);
      json(invalid);

      const unknownTool = await run(["init", "default", "--dir", root, "--tools", "unknown", "--dry-run", "--json"]);
      assert.equal(unknownTool.code, 1);
      assert.match(unknownTool.stdout, /UNKNOWN_TOOL/u);
      json(unknownTool);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a retired stored harness without mutation and recovers through explicit init selection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-cli-retired-tool-"));
    try {
      const initialized = await run(["init", "general", "--dir", root, "--tools", "codex", "--yes", "--json"]);
      assert.equal(initialized.code, 0);
      const configPath = path.join(root, ".mattpack", "config.json");
      const config = JSON.parse(await readFile(configPath, "utf8")) as { harnesses: string[] };
      config.harnesses = ["amazon-q"];
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
      const lockBefore = await readFile(path.join(root, ".mattpack", "lock.json"));

      for (const command of ["update", "doctor"]) {
        const result = await run([command, "--dir", root, "--json"]);
        assert.equal(result.code, 1);
        assert.match(result.stdout, /UNKNOWN_TOOL/u);
        assert.deepEqual(await readFile(path.join(root, ".mattpack", "lock.json")), lockBefore);
      }

      const recovered = await run(["init", "--dir", root, "--tools", "codex", "--yes", "--json"]);
      assert.equal(recovered.code, 0);
      assert.deepEqual(
        (JSON.parse(await readFile(configPath, "utf8")) as { harnesses: string[] }).harnesses,
        ["codex"]
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps human output semantic and concise", async () => {
    const result = await run(["list"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Presets/u);
    assert.match(result.stdout, /Harnesses/u);
    assert.equal(result.stderr, "");
  });

  it("plans mutations before requiring non-interactive approval", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-cli-confirm-"));
    try {
      const init = await run(["init", "general", "--dir", root, "--tools", "codex", "--yes", "--json"]);
      assert.equal(init.code, 0);

      const update = await run(["update", "--dir", root, "--json"]);
      assert.equal(update.code, 0);
      assert.match(update.stdout, /"changed": false/u);

      const missingSkill = path.join(root, ".agents", "skills", "handoff");
      await rm(missingSkill, { recursive: true });
      const refusedUpdate = await run(["update", "--dir", root, "--json"]);
      assert.equal(refusedUpdate.code, 1);
      assert.match(refusedUpdate.stdout, /NON_INTERACTIVE_INPUT_REQUIRED/u);
      await assert.rejects(access(missingSkill));

      const approvedUpdate = await run(["update", "--dir", root, "--yes", "--json"]);
      assert.equal(approvedUpdate.code, 0);
      await access(missingSkill);

      const removePlan = await run(["remove", "--dir", root, "--dry-run"]);
      assert.equal(removePlan.code, 0);
      assert.match(removePlan.stdout, /Mattpack remove plan/u);
      assert.match(removePlan.stdout, /Remove \.agents\/skills/u);
      await access(path.join(root, ".mattpack", "lock.json"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
