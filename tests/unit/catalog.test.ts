import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { SKILL_DEPENDENCIES } from "../../src/catalog/dependencies.js";
import { canonicalPreset, presetRoots } from "../../src/catalog/presets.js";
import { loadUpstreamCatalog } from "../../src/catalog/upstream.js";
import { resolveSkillSet } from "../../src/core/dependency-graph.js";
import { skillSelectionCatalog } from "../../src/core/service.js";

describe("upstream catalog and presets", () => {
  it("validates the pinned snapshot and resolves every preset", async () => {
    const catalog = await loadUpstreamCatalog(fileURLToPath(new URL("../../../", import.meta.url)));
    const available = new Set(catalog.skills.keys());
    assert.equal(catalog.skills.size, 39);
    assert.equal(catalog.byBucket.engineering.length + catalog.byBucket.productivity.length, 27);
    assert.equal(catalog.byBucket["in-progress"].length, 8);
    assert.equal(catalog.byBucket.misc.length, 4);

    assert.equal(canonicalPreset("dev"), "default");
    assert.equal(canonicalPreset("developing"), "default");
    assert.equal(canonicalPreset("in-progress"), "beta-only");
    assert.equal(canonicalPreset("beta"), "everything");
    assert.equal(canonicalPreset("experimental"), "everything");

    assert.equal(resolveSkillSet(presetRoots("default", catalog), available, SKILL_DEPENDENCIES).skills.length, 15);
    assert.equal(resolveSkillSet(presetRoots("general", catalog), available, SKILL_DEPENDENCIES).skills.length, 6);
    assert.equal(presetRoots("full", catalog).length, 27);
    assert.equal(presetRoots("beta-only", catalog).length, 8);
    assert.equal(resolveSkillSet(presetRoots("beta-only", catalog), available, SKILL_DEPENDENCIES).skills.length, 18);
    assert.equal(presetRoots("everything", catalog).length, 39);
    assert.equal(presetRoots("default", catalog).includes("resolving-merge-conflicts"), false);
    assert.equal(presetRoots("default", catalog).length, 12);
    assert.equal(presetRoots("general", catalog).length, 5);

    for (const promoted of ["pr", "implement-spec", "retro"]) {
      assert.equal(presetRoots("full", catalog).includes(promoted), true);
      assert.equal(presetRoots("beta-only", catalog).includes(promoted), false);
      assert.equal(presetRoots("everything", catalog).includes(promoted), true);
      assert.equal(presetRoots("default", catalog).includes(promoted), false);
      assert.equal(presetRoots("general", catalog).includes(promoted), false);
    }
    assert.equal(presetRoots("beta-only", catalog).includes("chief-of-staff"), true);
    assert.equal(presetRoots("full", catalog).includes("chief-of-staff"), false);
    assert.equal(presetRoots("everything", catalog).includes("chief-of-staff"), true);
    assert.equal(presetRoots("default", catalog).includes("chief-of-staff"), false);
    assert.equal(presetRoots("general", catalog).includes("chief-of-staff"), false);
  });

  it("exposes descriptions and derives preset relationships", async () => {
    const skills = await skillSelectionCatalog(fileURLToPath(new URL("../../../", import.meta.url)));
    assert.equal(skills.length, 39);
    assert.equal(skills.every((skill) => skill.description.length > 0), true);

    const grilling = skills.find((skill) => skill.name === "grilling");
    assert.equal(grilling?.relations.find((item) => item.preset === "default")?.relation, "dependency");
    assert.equal(grilling?.relations.find((item) => item.preset === "full")?.relation, "root");

    const teach = skills.find((skill) => skill.name === "teach");
    assert.equal(teach?.relations.find((item) => item.preset === "default")?.relation, "none");
    assert.equal(teach?.relations.find((item) => item.preset === "everything")?.relation, "root");
  });

  it("resolves the procedures chief-of-staff reads from sibling skills", async () => {
    const catalog = await loadUpstreamCatalog(fileURLToPath(new URL("../../../", import.meta.url)));
    const available = new Set(catalog.skills.keys());
    const resolved = resolveSkillSet(presetRoots("beta-only", catalog), available, SKILL_DEPENDENCIES);

    for (const procedure of ["retro", "to-spec", "to-tickets", "implement-spec"]) {
      assert.equal(resolved.skills.includes(procedure), true);
    }

    const additions = new Map(resolved.dependencies.map((item) => [item.name, item]));
    assert.equal(additions.get("retro")?.chain.join(" -> "), "chief-of-staff -> retro");
    assert.equal(additions.get("writing-for-agents")?.chain.join(" -> "), "chief-of-staff -> retro -> writing-for-agents");
    assert.equal(additions.get("tdd")?.chain.join(" -> "), "chief-of-staff -> implement-spec -> tdd");
  });
});
