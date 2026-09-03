import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MattpackError } from "../../src/core/errors.js";
import { doctorProject, installProject, removeProject, updateProject } from "../../src/core/service.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("installation lifecycle", () => {
  it("installs, preserves extras, rejects edits, backs up force, and removes safely", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-life-"));
    try {
      const first = await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      assert.equal(first.applied?.changed, true);
      assert.equal(first.resolution?.skills.length, 6);
      assert.equal((await doctorProject(root, packageRoot)).healthy, true);

      const second = await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      assert.equal(second.applied?.changed, false);

      const skillRoot = path.join(root, ".agents", "skills", "grill-me");
      await writeFile(path.join(skillRoot, "notes.md"), "keep me\n");
      await updateProject({ projectRoot: root, packageRoot });
      assert.equal(await readFile(path.join(skillRoot, "notes.md"), "utf8"), "keep me\n");

      const skillFile = path.join(skillRoot, "SKILL.md");
      await writeFile(skillFile, "local edit\n");
      await assert.rejects(
        updateProject({ projectRoot: root, packageRoot }),
        (error) => error instanceof MattpackError && error.code === "CONFLICT"
      );
      const forced = await updateProject({ projectRoot: root, packageRoot, force: true });
      assert.ok(forced.applied?.backupPath);
      assert.notEqual(await readFile(skillFile, "utf8"), "local edit\n");

      await writeFile(skillFile, "keep after remove\n");
      await removeProject({ projectRoot: root });
      assert.equal(await readFile(skillFile, "utf8"), "keep after remove\n");
      await assert.rejects(access(path.join(root, ".mattpack", "lock.json")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deduplicates the shared physical root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-shared-"));
    try {
      const result = await installProject({
        projectRoot: root,
        packageRoot,
        preset: "general",
        harnesses: ["agents", "codex", "zed"]
      });
      assert.equal(result.targets?.length, 1);
      assert.deepEqual(result.targets?.[0]?.consumers, ["agents", "codex", "zed"]);
      assert.equal(result.plan.lock?.managedSkills.length, 6);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
