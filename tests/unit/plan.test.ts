import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planInstall, type DesiredSkill } from "../../src/core/plan.js";
import type { ConfigState, ExistingSkill, LockState, ManagedSkill } from "../../src/core/state.js";

const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const config: ConfigState = { schemaVersion: 1, preset: "general", harnesses: ["codex"], includeDependencies: true };
const managed: ManagedSkill = {
  root: ".agents/skills",
  name: "demo",
  sourcePath: "skills/productivity/demo",
  files: [{ path: "SKILL.md", sha256: OLD }]
};
const lock: LockState = {
  schemaVersion: 1,
  mattpackVersion: "0.1.0",
  installationId: "installation",
  upstreamCommit: "0".repeat(40),
  preset: "general",
  includeDependencies: true,
  roots: ["demo"],
  dependencies: [],
  harnesses: ["codex"],
  targets: [{ root: ".agents/skills", consumers: ["codex"] }],
  managedSkills: [managed]
};
const desired: DesiredSkill = { ...managed, sourceDirectory: "/source" };

describe("reconciliation planner", () => {
  it("classifies unchanged managed content and extra files", () => {
    const existing: ExistingSkill = {
      exists: true,
      owner: { schemaVersion: 1, manager: "mattpack", installationId: "installation", sourcePath: managed.sourcePath },
      files: [...managed.files, { path: "notes.md", sha256: NEW }]
    };
    const plan = planInstall({
      command: "update",
      config,
      lock,
      priorConfig: config,
      priorLock: lock,
      desiredSkills: [desired],
      existing: new Map([[".agents/skills/demo", existing]])
    });
    assert.deepEqual(plan.unchanged, [".agents/skills/demo"]);
    assert.equal(plan.actions.length, 0);
    assert.equal(plan.divergences[0]?.code, "EXTRA_FILE");
  });

  it("blocks unowned and locally modified bytes deterministically", () => {
    const unowned = planInstall({
      command: "init",
      config,
      lock,
      desiredSkills: [desired],
      existing: new Map([[".agents/skills/demo", { exists: true, files: managed.files }]])
    });
    assert.equal(unowned.conflicts[0]?.code, "UNOWNED_DESTINATION");

    const modified = planInstall({
      command: "update",
      config,
      lock,
      priorConfig: config,
      priorLock: lock,
      desiredSkills: [desired],
      existing: new Map([[".agents/skills/demo", {
        exists: true,
        owner: { schemaVersion: 1, manager: "mattpack", installationId: "installation", sourcePath: managed.sourcePath },
        files: [{ path: "SKILL.md", sha256: NEW }]
      }]])
    });
    assert.equal(modified.conflicts[0]?.code, "LOCAL_MODIFICATION");
  });
});
