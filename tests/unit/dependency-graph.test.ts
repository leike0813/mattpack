import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MattpackError } from "../../src/core/errors.js";
import { resolveSkillSet } from "../../src/core/dependency-graph.js";
import { SKILL_DEPENDENCIES } from "../../src/catalog/dependencies.js";

describe("dependency resolution", () => {
  it("returns a deterministic recursive reason chain", () => {
    const result = resolveSkillSet(
      ["root"],
      new Set(["root", "required", "setup", "leaf"]),
      {
        root: { requires: ["required"], setupCompanions: ["setup"] },
        required: { requires: ["leaf"] }
      }
    );
    assert.deepEqual(result.skills, ["leaf", "required", "root", "setup"]);
    assert.deepEqual(result.dependencies, [
      { name: "leaf", kind: "requires", chain: ["root", "required", "leaf"] },
      { name: "required", kind: "requires", chain: ["root", "required"] },
      { name: "setup", kind: "setupCompanion", chain: ["root", "setup"] }
    ]);
  });

  it("reports missing nodes and cycles with stable codes", () => {
    assert.throws(
      () => resolveSkillSet(["root"], new Set(["root"]), { root: { requires: ["missing"] } }),
      (error) => error instanceof MattpackError && error.code === "MISSING_SKILL"
    );
    assert.throws(
      () => resolveSkillSet(["a"], new Set(["a", "b"]), { a: { requires: ["b"] }, b: { requires: ["a"] } }),
      (error) => error instanceof MattpackError && error.code === "DEPENDENCY_CYCLE"
    );
  });

  it("can deliberately skip dependencies", () => {
    assert.deepEqual(
      resolveSkillSet(["root"], new Set(["root", "child"]), { root: { requires: ["child"] } }, false),
      { roots: ["root"], dependencies: [], skills: ["root"] }
    );
  });

  it("resolves implement-spec's explicit closure and dependency kinds", () => {
    const result = resolveSkillSet(
      ["implement-spec"],
      new Set([
        "implement-spec", "tdd", "code-review", "codebase-design", "setup-matt-pocock-skills"
      ]),
      SKILL_DEPENDENCIES
    );
    assert.deepEqual(result.dependencies, [
      { name: "code-review", kind: "requires", chain: ["implement-spec", "code-review"] },
      { name: "codebase-design", kind: "requires", chain: ["implement-spec", "tdd", "codebase-design"] },
      { name: "setup-matt-pocock-skills", kind: "setupCompanion", chain: ["implement-spec", "setup-matt-pocock-skills"] },
      { name: "tdd", kind: "requires", chain: ["implement-spec", "tdd"] }
    ]);
  });
});
