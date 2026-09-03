import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { applyPlan } from "../../src/core/apply.js";
import { installProject, updateProject } from "../../src/core/service.js";
import type { ReconciliationPlan } from "../../src/core/plan.js";
import { readConfig, type ConfigState, type LockState } from "../../src/core/state.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function missing(file: string): Promise<boolean> {
  try {
    await access(file);
    return false;
  } catch {
    return true;
  }
}

describe("service scenarios", () => {
  it("expands and contracts a preset without touching unrelated files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-presets-"));
    try {
      await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      await writeFile(path.join(root, ".agents", "skills", "mine.txt"), "unrelated\n");
      const expanded = await installProject({ projectRoot: root, packageRoot, preset: "default", harnesses: ["codex"] });
      assert.equal(expanded.resolution?.skills.length, 16);
      assert.equal(await missing(path.join(root, ".agents", "skills", "tdd", "SKILL.md")), false);

      const contracted = await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      assert.equal(contracted.resolution?.skills.length, 6);
      assert.equal(await missing(path.join(root, ".agents", "skills", "tdd")), true);
      assert.equal(await readFile(path.join(root, ".agents", "skills", "mine.txt"), "utf8"), "unrelated\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls back swapped skills when a later destination becomes invalid", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-rollback-"));
    try {
      const sources = path.join(root, "sources");
      await mkdir(path.join(sources, "a"), { recursive: true });
      await mkdir(path.join(sources, "b"), { recursive: true });
      await writeFile(path.join(sources, "a", "SKILL.md"), "a\n");
      await writeFile(path.join(sources, "b", "SKILL.md"), "b\n");
      await writeFile(path.join(root, "blocked"), "file, not directory\n");
      const config: ConfigState = {
        schemaVersion: 1,
        preset: "general",
        additionalSkills: [],
        harnesses: ["codex"],
        includeDependencies: true
      };
      const lock: LockState = {
        schemaVersion: 1,
        mattpackVersion: "0.1.0",
        installationId: "rollback-test",
        upstreamCommit: "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76",
        preset: "general",
        includeDependencies: true,
        roots: [],
        dependencies: [],
        harnesses: ["codex"],
        targets: [],
        managedSkills: []
      };
      const plan: ReconciliationPlan = {
        command: "init",
        config,
        lock,
        actions: [
          {
            kind: "add",
            key: ".agents/skills/a",
            root: ".agents/skills",
            name: "a",
            expected: { exists: false, files: [] },
            preserveFiles: [],
            desired: {
              root: ".agents/skills",
              name: "a",
              sourcePath: "a",
              sourceDirectory: path.join(sources, "a"),
              files: []
            }
          },
          {
            kind: "add",
            key: "blocked/skills/b",
            root: "blocked/skills",
            name: "b",
            expected: { exists: false, files: [] },
            preserveFiles: [],
            desired: {
              root: "blocked/skills",
              name: "b",
              sourcePath: "b",
              sourceDirectory: path.join(sources, "b"),
              files: []
            }
          }
        ],
        unchanged: [],
        conflicts: [],
        divergences: [],
        stateNeedsWrite: true
      };
      await assert.rejects(applyPlan(root, plan));
      assert.equal(await missing(path.join(root, ".agents", "skills", "a")), true);
      assert.equal(await missing(path.join(root, ".mattpack", "lock.json")), true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves explicit skill roots across preset changes and update", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-additional-"));
    try {
      const installed = await installProject({
        projectRoot: root,
        packageRoot,
        preset: "general",
        additionalSkills: ["teach", "grilling", "teach"],
        harnesses: ["codex"]
      });
      assert.equal(installed.resolution?.skills.includes("teach"), true);
      assert.equal(installed.resolution?.roots.includes("grilling"), true);
      assert.deepEqual((await readConfig(root))?.additionalSkills, ["grilling", "teach"]);

      await installProject({ projectRoot: root, packageRoot, preset: "default", harnesses: ["codex"] });
      assert.deepEqual((await readConfig(root))?.additionalSkills, ["grilling", "teach"]);
      assert.equal((await updateProject({ projectRoot: root, packageRoot })).applied?.changed, false);

      await installProject({
        projectRoot: root,
        packageRoot,
        preset: "default",
        additionalSkills: [],
        harnesses: ["codex"]
      });
      assert.equal(await missing(path.join(root, ".agents", "skills", "teach")), true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a half-written or corrupt consumer state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-corrupt-"));
    try {
      await mkdir(path.join(root, ".mattpack"));
      await writeFile(path.join(root, ".mattpack", "config.json"), "{bad json\n");
      await assert.rejects(installProject({
        projectRoot: root,
        packageRoot,
        preset: "general",
        harnesses: ["codex"],
        dryRun: true
      }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
