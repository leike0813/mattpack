import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { deduplicateTargets, HARNESS_ADAPTERS, harnessById, selectHarnesses } from "../../src/harnesses/registry.js";

const EXPECTED_ROOTS: Readonly<Record<string, string>> = {
  agents: ".agents/skills",
  amp: ".agents/skills",
  antigravity: ".agents/skills",
  autohand: ".autohand/skills",
  auggie: ".augment/skills",
  bob: ".bob/skills",
  claude: ".claude/skills",
  cline: ".cline/skills",
  codeartsagent: ".codeartsdoer/skills",
  codebuff: ".agents/skills",
  codebuddy: ".codebuddy/skills",
  codex: ".agents/skills",
  "command-code": ".commandcode/skills",
  continue: ".continue/skills",
  costrict: ".costrict/skills",
  crush: ".crush/skills",
  cursor: ".cursor/skills",
  "deep-agents": ".deepagents/skills",
  "deepseek-harness": ".dsh/skills",
  devin: ".devin/skills",
  factory: ".factory/skills",
  forgecode: ".forge/skills",
  gemini: ".gemini/skills",
  "github-copilot": ".github/skills",
  goose: ".goose/skills",
  grok: ".grok/skills",
  hermes: ".hermes/skills",
  iflow: ".iflow/skills",
  junie: ".junie/skills",
  kilocode: ".kilo/skills",
  kimi: ".kimi-code/skills",
  kiro: ".kiro/skills",
  lingma: ".lingma/skills",
  "minimax-code": ".minimax/skills",
  "oh-my-pi": ".omp/skills",
  openhands: ".openhands/skills",
  opencode: ".opencode/skills",
  pi: ".pi/skills",
  "prime-agent": ".prime/agent/skills",
  qoder: ".qoder/skills",
  qwen: ".qwen/skills",
  "replit-agent": ".agents/skills",
  roocode: ".roo/skills",
  rovodev: ".rovodev/skills",
  "sourcecraft-code-assistant": ".codeassistant/skills",
  trae: ".trae/skills",
  vibe: ".vibe/skills",
  warp: ".agents/skills",
  zcode: ".zcode/skills",
  zed: ".agents/skills",
  "zoo-code": ".roo/skills"
};

describe("harness registry", () => {
  it("defines 51 logical harnesses across 43 exact project-local roots", () => {
    assert.equal(HARNESS_ADAPTERS.length, 51);
    for (const [id, root] of Object.entries(EXPECTED_ROOTS)) {
      assert.equal(path.relative("/project", harnessById(id).getSkillRoot("/project")), root);
    }
    assert.equal(deduplicateTargets("/project", selectHarnesses(["all"])).length, 43);
    assert.throws(() => harnessById("amazon-q"), { code: "UNKNOWN_TOOL" });
  });

  it("deduplicates all eight .agents consumers and both Roo consumers", () => {
    const selected = selectHarnesses(["codex", "agents", "antigravity", "zed", "amp", "codebuff", "warp", "replit-agent", "roocode", "zoo-code"]);
    const targets = deduplicateTargets("/project", selected);
    assert.deepEqual(targets.map(({ root, consumers }) => ({ root, consumers })), [
      { root: ".agents/skills", consumers: ["agents", "amp", "antigravity", "codebuff", "codex", "replit-agent", "warp", "zed"] },
      { root: ".roo/skills", consumers: ["roocode", "zoo-code"] }
    ]);
  });

  it("selects all harnesses only as a standalone selector", () => {
    assert.equal(selectHarnesses(["all"]).length, 51);
    assert.throws(() => selectHarnesses(["all", "codex"]));
  });

  it("detects Warp's project marker and both Kilo config directory names", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "mattpack-detection-"));
    try {
      await writeFile(path.join(project, "WARP.md"), "");
      assert.deepEqual(await harnessById("warp").detect(project), { detected: true, evidence: ["WARP.md"] });
      for (const directory of [".kilo", ".kilocode"]) {
        await mkdir(path.join(project, directory));
        assert.deepEqual(await harnessById("kilocode").detect(project), { detected: true, evidence: [directory] });
        await rm(path.join(project, directory), { recursive: true });
      }
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});
