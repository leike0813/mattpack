import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { harnessPromptChoices, isPromptCancellation } from "../../src/output/prompts.js";

describe("CLI prompts", () => {
  it("orders configured and detected harnesses and chooses useful defaults", () => {
    const choices = harnessPromptChoices([
      { id: "cursor", displayName: "Cursor", root: ".cursor/skills", evidence: [], configured: false },
      { id: "claude", displayName: "Claude Code", root: ".claude/skills", evidence: [".claude"], configured: false },
      { id: "codex", displayName: "Codex", root: ".agents/skills", evidence: [], configured: true }
    ]);

    assert.deepEqual(choices.map((choice) => choice.value), ["codex", "claude", "cursor"]);
    assert.deepEqual(choices.map((choice) => choice.checked), [true, false, false]);

    const firstInstall = harnessPromptChoices([
      { id: "cursor", displayName: "Cursor", root: ".cursor/skills", evidence: [], configured: false },
      { id: "claude", displayName: "Claude Code", root: ".claude/skills", evidence: [".claude"], configured: false }
    ]);
    assert.deepEqual(firstInstall.map((choice) => choice.checked), [true, false]);
  });

  it("recognizes Inquirer cancellation without hiding other failures", () => {
    const cancelled = new Error("User force closed the prompt");
    cancelled.name = "ExitPromptError";
    assert.equal(isPromptCancellation(cancelled), true);
    assert.equal(isPromptCancellation(new Error("boom")), false);
  });
});
