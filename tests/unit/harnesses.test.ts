import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { deduplicateTargets, HARNESS_ADAPTERS, harnessById, selectHarnesses } from "../../src/harnesses/registry.js";

const EXPECTED_ROOTS: Readonly<Record<string, string>> = {
  agents: ".agents/skills",
  "amazon-q": ".amazonq/skills",
  antigravity: ".agents/skills",
  auggie: ".augment/skills",
  bob: ".bob/skills",
  claude: ".claude/skills",
  cline: ".cline/skills",
  codeartsagent: ".codeartsdoer/skills",
  codebuddy: ".codebuddy/skills",
  codex: ".agents/skills",
  "command-code": ".commandcode/skills",
  continue: ".continue/skills",
  costrict: ".cospec/skills",
  crush: ".crush/skills",
  cursor: ".cursor/skills",
  devin: ".devin/skills",
  factory: ".factory/skills",
  forgecode: ".forge/skills",
  gemini: ".gemini/skills",
  "github-copilot": ".github/skills",
  hermes: ".hermes/skills",
  iflow: ".iflow/skills",
  junie: ".junie/skills",
  kilocode: ".kilocode/skills",
  kimi: ".kimi-code/skills",
  kiro: ".kiro/skills",
  lingma: ".lingma/skills",
  "oh-my-pi": ".omp/skills",
  opencode: ".opencode/skills",
  pi: ".pi/skills",
  qoder: ".qoder/skills",
  qwen: ".qwen/skills",
  roocode: ".roo/skills",
  rovodev: ".rovodev/skills",
  trae: ".trae/skills",
  vibe: ".vibe/skills",
  zcode: ".zcode/skills",
  zed: ".agents/skills"
};

describe("harness registry", () => {
  it("defines all exact project-local roots", () => {
    assert.equal(HARNESS_ADAPTERS.length, 38);
    for (const [id, root] of Object.entries(EXPECTED_ROOTS)) {
      assert.equal(path.relative("/project", harnessById(id).getSkillRoot("/project")), root);
    }
  });

  it("deduplicates logical consumers sharing .agents", () => {
    const selected = selectHarnesses(["codex", "agents", "antigravity", "zed", "claude"]);
    const targets = deduplicateTargets("/project", selected);
    assert.deepEqual(targets.map(({ root, consumers }) => ({ root, consumers })), [
      { root: ".agents/skills", consumers: ["agents", "antigravity", "codex", "zed"] },
      { root: ".claude/skills", consumers: ["claude"] }
    ]);
  });

  it("selects all harnesses only as a standalone selector", () => {
    assert.equal(selectHarnesses(["all"]).length, 38);
    assert.throws(() => selectHarnesses(["all", "codex"]));
  });

});
