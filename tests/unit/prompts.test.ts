import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  harnessPromptChoices,
  isPromptCancellation,
  pageBounds,
  transitionSetup,
  type SetupState
} from "../../src/output/prompts.js";

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

  it("pages bounded lists and preserves nested skill selections", () => {
    assert.deepEqual(pageBounds(7, 12, 5), { start: 5, end: 10, page: 1, pageCount: 3 });
    const skills = [
      { name: "research", description: "Research", relations: [] },
      { name: "teach", description: "Teach", relations: [] }
    ];
    const harnesses = [{ name: "Codex", value: "codex", description: ".agents/skills", checked: true }];
    const context = {
      presetCount: 5,
      skills,
      harnesses,
      skillPageSize: 1,
      harnessPageSize: 1
    };
    let state: SetupState = {
      view: "tools",
      presetIndex: 1,
      skillIndex: 0,
      harnessIndex: 0,
      additionalSkills: [],
      harnesses: ["codex"],
      errorMessage: undefined
    };
    const press = (key: string): void => {
      const transition = transitionSetup(state, key, context);
      assert.ok(transition);
      state = transition.state;
    };

    press("left");
    press("up");
    press("s");
    press("pagedown");
    press("space");
    press("enter");
    assert.equal(state.view, "preset");
    assert.equal(state.presetIndex, 0);
    assert.deepEqual(state.additionalSkills, ["teach"]);
    press("right");
    assert.equal(state.view, "tools");
    assert.deepEqual(state.harnesses, ["codex"]);
  });
});
