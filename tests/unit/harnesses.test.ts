import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { deduplicateTargets, HARNESS_ADAPTERS, harnessById, selectHarnesses } from "../../src/harnesses/registry.js";

const EXPECTED_ROOTS: Readonly<Record<string, string>> = {
  agents: ".agents/skills",
  codex: ".agents/skills",
  zed: ".agents/skills",
  claude: ".claude/skills",
  opencode: ".opencode/skills",
  pi: ".pi/skills",
  "oh-my-pi": ".omp/skills",
  gemini: ".gemini/skills",
  cursor: ".cursor/skills",
  "github-copilot": ".github/skills",
  kimi: ".kimi-code/skills",
  qwen: ".qwen/skills",
  kilocode: ".kilocode/skills"
};

describe("harness registry", () => {
  it("defines all exact project-local roots", () => {
    assert.equal(HARNESS_ADAPTERS.length, 13);
    for (const [id, root] of Object.entries(EXPECTED_ROOTS)) {
      assert.equal(path.relative("/project", harnessById(id).getSkillRoot("/project")), root);
    }
  });

  it("deduplicates logical consumers sharing .agents", () => {
    const selected = selectHarnesses(["codex", "agents", "zed", "claude"]);
    const targets = deduplicateTargets("/project", selected);
    assert.deepEqual(targets.map(({ root, consumers }) => ({ root, consumers })), [
      { root: ".agents/skills", consumers: ["agents", "codex", "zed"] },
      { root: ".claude/skills", consumers: ["claude"] }
    ]);
  });

  it("selects all harnesses only as a standalone selector", () => {
    assert.equal(selectHarnesses(["all"]).length, 13);
    assert.throws(() => selectHarnesses(["all", "codex"]));
  });

  it("reports advisory evidence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-harness-"));
    try {
      await mkdir(path.join(root, ".opencode"));
      const detected = await harnessById("opencode").detect(root);
      assert.equal(detected.detected, true);
      assert.deepEqual(detected.evidence, [".opencode"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
