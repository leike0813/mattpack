import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { SKILL_DEPENDENCIES } from "../../src/catalog/dependencies.js";
import { canonicalPreset, presetRoots } from "../../src/catalog/presets.js";
import { loadUpstreamCatalog } from "../../src/catalog/upstream.js";
import { resolveSkillSet } from "../../src/core/dependency-graph.js";

describe("upstream catalog and presets", () => {
  it("validates the pinned snapshot and resolves every preset", async () => {
    const catalog = await loadUpstreamCatalog(fileURLToPath(new URL("../../../", import.meta.url)));
    const available = new Set(catalog.skills.keys());
    assert.equal(catalog.skills.size, 37);
    assert.equal(catalog.byBucket.engineering.length + catalog.byBucket.productivity.length, 25);
    assert.equal(catalog.byBucket["in-progress"].length, 8);
    assert.equal(catalog.byBucket.misc.length, 4);

    assert.equal(canonicalPreset("dev"), "default");
    assert.equal(canonicalPreset("developing"), "default");
    assert.equal(canonicalPreset("in-progress"), "beta-only");
    assert.equal(canonicalPreset("beta"), "everything");
    assert.equal(canonicalPreset("experimental"), "everything");

    assert.equal(resolveSkillSet(presetRoots("default", catalog), available, SKILL_DEPENDENCIES).skills.length, 16);
    assert.equal(resolveSkillSet(presetRoots("general", catalog), available, SKILL_DEPENDENCIES).skills.length, 6);
    assert.equal(presetRoots("full", catalog).length, 25);
    assert.equal(presetRoots("beta-only", catalog).length, 8);
    assert.equal(presetRoots("everything", catalog).length, 37);
  });
});
