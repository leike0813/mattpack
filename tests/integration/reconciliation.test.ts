import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MattpackError } from "../../src/core/errors.js";
import { doctorProject, installProject, removeProject, updateProject } from "../../src/core/service.js";
import { OWNER_FILE, readConfig, readLock, scanSkill, type ConfigState, type LockState, type ManagedSkill } from "../../src/core/state.js";

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

  it("moves corrected harness roots through normal ownership planning", async () => {
    for (const [id, oldRoot, newRoot] of [
      ["costrict", ".cospec/skills", ".costrict/skills"],
      ["kilocode", ".kilocode/skills", ".kilo/skills"]
    ] as const) {
      const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-root-move-"));
      try {
        await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
        const lockPath = path.join(root, ".mattpack", "lock.json");
        const configPath = path.join(root, ".mattpack", "config.json");
        const config = await readConfig(root);
        const lock = await readLock(root);
        assert.ok(config && lock);
        const oldSkillRoot = path.join(root, oldRoot);
        const newSkillRoot = path.join(root, newRoot);
        await mkdir(oldSkillRoot, { recursive: true });
        await mkdir(newSkillRoot, { recursive: true });
        const oldManaged = lock.managedSkills.map((skill) => ({ ...skill, root: oldRoot }));
        for (const skill of oldManaged) {
          const installed = path.join(root, ...oldRoot.split("/"), skill.name);
          const source = path.join(root, ".agents", "skills", skill.name);
          await mkdir(path.dirname(installed), { recursive: true });
          await cp(source, installed, { recursive: true });
        }
        await rm(path.join(root, ".agents"), { recursive: true });
        const installedLock: LockState = {
          ...lock,
          harnesses: [id],
          targets: [{ root: oldRoot, consumers: [id] }],
          managedSkills: oldManaged
        };
        const installedConfig: ConfigState = { ...config, harnesses: [id] };
        await writeFile(configPath, `${JSON.stringify(installedConfig, null, 2)}\n`);
        await writeFile(lockPath, `${JSON.stringify(installedLock, null, 2)}\n`);

        const oldSkill = path.join(root, ...oldRoot.split("/"), oldManaged[0]!.name);
        const newConflict = path.join(newSkillRoot, oldManaged[1]!.name);
        await mkdir(newConflict, { recursive: true });
        await writeFile(path.join(newConflict, "mine.txt"), "unowned\n");
        const before = await readFile(path.join(oldSkill, "SKILL.md"));
        const blocked = await updateProject({ projectRoot: root, packageRoot, dryRun: true });
        assert.ok(blocked.plan.conflicts.some((issue) => issue.key === `${newRoot}/${oldManaged[1]!.name}`));
        assert.deepEqual(await readFile(path.join(oldSkill, "SKILL.md")), before);
        assert.equal(await readFile(path.join(newConflict, "mine.txt"), "utf8"), "unowned\n");
        assert.deepEqual(await readLock(root), installedLock);
        await assert.rejects(
          updateProject({ projectRoot: root, packageRoot }),
          (error) => error instanceof MattpackError && error.code === "CONFLICT"
        );
        assert.deepEqual(await readLock(root), installedLock);

        await rm(newConflict, { recursive: true });
        await writeFile(path.join(oldSkill, "SKILL.md"), "local edit\n");
        await writeFile(path.join(oldSkill, "notes.txt"), "local extra\n");
        const deletedSkill = path.join(root, oldRoot, oldManaged[2]!.name);
        await rm(path.join(deletedSkill, "SKILL.md"));
        const migrated = await updateProject({ projectRoot: root, packageRoot });
        assert.equal(migrated.applied?.changed, true);
        assert.equal(await readFile(path.join(oldSkill, "SKILL.md"), "utf8"), "local edit\n");
        assert.equal(await readFile(path.join(oldSkill, "notes.txt"), "utf8"), "local extra\n");
        assert.equal(await readFile(path.join(root, newRoot, "grill-me", "SKILL.md"), "utf8"),
          await readFile(path.join(packageRoot, "vendor/mattpocock-skills/skills/productivity/grill-me/SKILL.md"), "utf8"));
        assert.equal(await access(path.join(root, oldRoot, oldManaged[1]!.name)).then(() => true, () => false), false);
        assert.equal(await access(path.join(root, oldRoot, oldManaged[2]!.name)).then(() => true, () => false), false);
        assert.ok(migrated.plan.divergences.some((issue) =>
          issue.key === `${oldRoot}/${oldManaged[2]!.name}` && issue.paths.includes("SKILL.md")));
        assert.equal((await readLock(root))?.harnesses[0], id);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects retired Amazon Q config before mutation and removes from prior ownership state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-retired-tool-"));
    try {
      await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      const config = await readConfig(root);
      const lock = await readLock(root);
      assert.ok(config && lock);
      const amazonRoot = ".amazonq/skills";
      const managed = lock.managedSkills.map((skill) => ({ ...skill, root: amazonRoot }));
      for (const skill of managed) {
        const destination = path.join(root, amazonRoot, skill.name);
        await mkdir(path.dirname(destination), { recursive: true });
        await cp(path.join(root, ".agents/skills", skill.name), destination, { recursive: true });
      }
      await rm(path.join(root, ".agents"), { recursive: true });
      const priorLock: LockState = { ...lock, harnesses: ["amazon-q"], targets: [{ root: amazonRoot, consumers: ["amazon-q"] }], managedSkills: managed };
      const priorConfig: ConfigState = { ...config, harnesses: ["amazon-q"] };
      await writeFile(path.join(root, ".mattpack/config.json"), `${JSON.stringify(priorConfig, null, 2)}\n`);
      await writeFile(path.join(root, ".mattpack/lock.json"), `${JSON.stringify(priorLock, null, 2)}\n`);
      const stateBefore = await readFile(path.join(root, ".mattpack/lock.json"));
      await assert.rejects(updateProject({ projectRoot: root, packageRoot }), (error) => error instanceof MattpackError && error.code === "UNKNOWN_TOOL");
      await assert.rejects(doctorProject(root, packageRoot), (error) => error instanceof MattpackError && error.code === "UNKNOWN_TOOL");
      assert.deepEqual(await readFile(path.join(root, ".mattpack/lock.json")), stateBefore);
      assert.equal((await removeProject({ projectRoot: root })).applied?.changed, true);
      await assert.rejects(access(path.join(root, amazonRoot, "grill-me", "SKILL.md")));
      assert.equal((await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] })).applied?.changed, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refreshes ownership after a skill moves from beta to stable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-promotion-"));
    try {
      await installProject({ projectRoot: root, packageRoot, preset: "full", harnesses: ["codex"] });
      const dir = path.join(root, ".agents", "skills", "implement-spec");
      const lockPath = path.join(root, ".mattpack", "lock.json");
      const lock = await readLock(root);
      assert.ok(lock);
      const managed = lock.managedSkills.find((skill) => skill.name === "implement-spec");
      assert.ok(managed);
      managed.sourcePath = "skills/in-progress/implement-spec";
      await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
      const ownerPath = path.join(dir, OWNER_FILE);
      const existing = await scanSkill(dir);
      assert.ok(existing.owner);
      await writeFile(ownerPath, `${JSON.stringify({ ...existing.owner, sourcePath: managed.sourcePath }, null, 2)}\n`);
      await writeFile(path.join(dir, "consumer-notes.md"), "preserve me\n");

      const updated = await updateProject({ projectRoot: root, packageRoot });
      assert.equal(updated.applied?.changed, true);
      const nextLock = await readLock(root);
      assert.equal(nextLock?.managedSkills.find((skill) => skill.name === "implement-spec")?.sourcePath,
        "skills/engineering/implement-spec");
      const nextOwner = await scanSkill(dir);
      assert.equal(nextOwner.owner?.sourcePath, "skills/engineering/implement-spec");
      const vendorSkill = path.join(packageRoot, "vendor/mattpocock-skills/skills/engineering/implement-spec/SKILL.md");
      assert.equal(await readFile(path.join(dir, "SKILL.md"), "utf8"), await readFile(vendorSkill, "utf8"));
      assert.equal(await readFile(path.join(dir, "consumer-notes.md"), "utf8"), "preserve me\n");
      assert.equal((await doctorProject(root, packageRoot)).healthy, false);
      await rm(path.join(dir, "consumer-notes.md"));
      assert.equal((await doctorProject(root, packageRoot)).healthy, true);
      assert.equal((await updateProject({ projectRoot: root, packageRoot })).applied?.changed, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renames a managed resource and conflicts when the old file was edited", async () => {
    for (const modified of [false, true]) {
      const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-resource-rename-"));
      try {
        await installProject({ projectRoot: root, packageRoot, preset: "full", harnesses: ["codex"] });
        const dir = path.join(root, ".agents", "skills", "domain-modeling");
        const oldPath = "CONTEXT-FORMAT.md";
        const newPath = "GLOSSARY-FORMAT.md";
        const bytes = await readFile(path.join(dir, newPath));
        const lock = await readLock(root);
        assert.ok(lock);
        const managed = lock.managedSkills.find((skill) => skill.name === "domain-modeling");
        assert.ok(managed);
        const priorFile = managed.files.find((file) => file.path === newPath);
        assert.ok(priorFile);
        const oldManaged: ManagedSkill = {
          ...managed,
          files: managed.files.filter((file) => file.path !== newPath).concat({ ...priorFile, path: oldPath })
        };
        const nextLock = {
          ...lock,
          managedSkills: lock.managedSkills.map((skill) => skill.name === managed.name ? oldManaged : skill)
        };
        await rm(path.join(dir, newPath));
        await writeFile(path.join(dir, oldPath), bytes);
        if (modified) await writeFile(path.join(dir, oldPath), "local edit\n");
        await writeFile(path.join(root, ".mattpack", "lock.json"), `${JSON.stringify(nextLock, null, 2)}\n`);
        await writeFile(path.join(root, "CONTEXT.md"), "consumer glossary\n");
        await writeFile(path.join(root, "CONTEXT-MAP.md"), "consumer map\n");

        if (modified) {
          const beforeLock = await readLock(root);
          await assert.rejects(
            updateProject({ projectRoot: root, packageRoot }),
            (error) => error instanceof MattpackError && error.code === "CONFLICT"
          );
          assert.equal(await readFile(path.join(dir, oldPath), "utf8"), "local edit\n");
          assert.deepEqual(await readLock(root), beforeLock);
          assert.equal(await access(path.join(dir, newPath)).then(() => true, () => false), false);
        } else {
          assert.equal((await updateProject({ projectRoot: root, packageRoot })).applied?.changed, true);
          await assert.rejects(access(path.join(dir, oldPath)));
          assert.deepEqual(await readFile(path.join(dir, newPath)), bytes);
          assert.equal(await readFile(path.join(root, "CONTEXT.md"), "utf8"), "consumer glossary\n");
          assert.equal(await readFile(path.join(root, "CONTEXT-MAP.md"), "utf8"), "consumer map\n");
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("fails on a removed stored additional root before changing consumer state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-removed-root-"));
    try {
      await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      await writeFile(path.join(root, "CONTEXT.md"), "consumer document\n");
      const config = await readConfig(root);
      assert.ok(config);
      const nextConfig = { ...config, additionalSkills: ["resolving-merge-conflicts"] };
      const configPath = path.join(root, ".mattpack", "config.json");
      await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
      const beforeLock = await readLock(root);
      const installed = path.join(root, ".agents", "skills", "grill-me", "SKILL.md");
      const beforeSkill = await readFile(installed, "utf8");

      await assert.rejects(
        updateProject({ projectRoot: root, packageRoot }),
        (error) => error instanceof MattpackError && error.code === "UNKNOWN_SKILL"
      );
      assert.deepEqual(await readConfig(root), nextConfig);
      assert.deepEqual(await readLock(root), beforeLock);
      assert.equal(await readFile(installed, "utf8"), beforeSkill);
      assert.equal(await readFile(path.join(root, "CONTEXT.md"), "utf8"), "consumer document\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes an obsolete managed skill while preserving changed and extra files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-obsolete-skill-"));
    try {
      await installProject({ projectRoot: root, packageRoot, preset: "general", harnesses: ["codex"] });
      const lock = await readLock(root);
      assert.ok(lock);
      const name = "resolving-merge-conflicts";
      const skillRoot = path.join(root, ".agents", "skills", name);
      await mkdir(skillRoot, { recursive: true });
      const intact = "unchanged owned content\n";
      const edited = "original owned content\n";
      await writeFile(path.join(skillRoot, "owned.txt"), intact);
      await writeFile(path.join(skillRoot, "edited.txt"), "local edit\n");
      await writeFile(path.join(skillRoot, "notes.txt"), "local extra\n");
      await writeFile(path.join(skillRoot, OWNER_FILE), `${JSON.stringify({
        schemaVersion: 1,
        manager: "mattpack",
        installationId: lock.installationId,
        sourcePath: "skills/engineering/resolving-merge-conflicts"
      }, null, 2)}\n`);
      const obsolete: ManagedSkill = {
        root: ".agents/skills",
        name,
        sourcePath: "skills/engineering/resolving-merge-conflicts",
        files: [
          { path: "edited.txt", sha256: createHash("sha256").update(edited).digest("hex") },
          { path: "owned.txt", sha256: createHash("sha256").update(intact).digest("hex") }
        ]
      };
      await writeFile(path.join(root, ".mattpack", "lock.json"), `${JSON.stringify({
        ...lock,
        managedSkills: [...lock.managedSkills, obsolete]
      }, null, 2)}\n`);

      const result = await updateProject({ projectRoot: root, packageRoot });
      assert.equal(result.applied?.changed, true);
      const remaining = await scanSkill(skillRoot);
      assert.equal(remaining.exists, true);
      assert.equal(remaining.owner, undefined);
      assert.deepEqual(remaining.files.map((file) => file.path), ["edited.txt", "notes.txt"]);
      assert.equal(await readFile(path.join(skillRoot, "edited.txt"), "utf8"), "local edit\n");
      assert.equal(await readFile(path.join(skillRoot, "notes.txt"), "utf8"), "local extra\n");
      assert.equal((await readLock(root))?.managedSkills.some((skill) => skill.name === name), false);
      assert.equal((await updateProject({ projectRoot: root, packageRoot })).applied?.changed, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
