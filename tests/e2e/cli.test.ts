import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
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

      const inspected = await run(["dev", "--dir", root, "--harness", "codex", "--dry-run", "--json"]);
      assert.equal(inspected.code, 0);
      assert.equal(json(inspected).command, "init");
      await assert.rejects(access(path.join(root, ".mattpack", "lock.json")));

      const initialized = await run(["init", "general", "--dir", root, "--harness", "codex", "--yes", "--json"]);
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
      const init = await run(["init", "general", "--dir", root, "--harness", "codex", "--yes", "--json"]);
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
