import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MattpackError } from "../../src/core/errors.js";
import { installProject, removeProject, updateProject } from "../../src/core/service.js";
import { HARNESS_ADAPTERS } from "../../src/harnesses/registry.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function missing(file: string): Promise<boolean> {
  try {
    await access(file);
    return false;
  } catch {
    return true;
  }
}

describe("shared harness contract", () => {
  for (const adapter of HARNESS_ADAPTERS) {
    it(`${adapter.id} installs and reconciles only its exact project-local root`, async () => {
      const projectRoot = await mkdtemp(path.join(os.tmpdir(), `mattpack-${adapter.id}-`));
      const skillRoot = adapter.getSkillRoot(projectRoot);
      const managed = path.join(skillRoot, "grill-me");
      try {
        await mkdir(managed, { recursive: true });
        if (adapter.id === "antigravity") await mkdir(path.join(projectRoot, ".agent"));
        if (adapter.id === "warp") await writeFile(path.join(projectRoot, "WARP.md"), "");
        assert.equal((await adapter.detect(projectRoot)).detected, true);
        await writeFile(path.join(managed, "mine.txt"), "unowned\n");
        const conflict = await installProject({
          projectRoot,
          packageRoot,
          preset: "general",
          harnesses: [adapter.id],
          dryRun: true
        });
        assert.equal(conflict.plan.conflicts[0]?.code, "UNOWNED_DESTINATION");
        await rm(managed, { recursive: true });

        const first = await installProject({ projectRoot, packageRoot, preset: "general", harnesses: [adapter.id] });
        assert.equal(first.applied?.changed, true);
        assert.equal(first.targets?.[0]?.absoluteRoot, skillRoot);
        assert.equal(await missing(path.join(managed, "SKILL.md")), false);

        const second = await installProject({ projectRoot, packageRoot, preset: "general", harnesses: [adapter.id] });
        assert.equal(second.applied?.changed, false);
        assert.equal((await updateProject({ projectRoot, packageRoot })).applied?.changed, false);

        const skillFile = path.join(managed, "SKILL.md");
        const original = await readFile(skillFile, "utf8");
        await writeFile(skillFile, "local edit\n");
        await assert.rejects(
          updateProject({ projectRoot, packageRoot }),
          (error) => error instanceof MattpackError && error.code === "CONFLICT"
        );
        await writeFile(path.join(managed, "notes.md"), "keep\n");
        await removeProject({ projectRoot });
        assert.equal(await readFile(skillFile, "utf8"), "local edit\n");
        assert.equal(await readFile(path.join(managed, "notes.md"), "utf8"), "keep\n");
        assert.equal(await missing(path.join(skillRoot, "handoff")), true);
        assert.notEqual(original, "local edit\n");
      } finally {
        await rm(projectRoot, { recursive: true, force: true });
      }
    });
  }
});
