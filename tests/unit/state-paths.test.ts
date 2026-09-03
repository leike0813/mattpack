import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { MattpackError } from "../../src/core/errors.js";
import { assertContained, resolveProjectRoot } from "../../src/core/paths.js";
import { readConfig } from "../../src/core/state.js";

describe("paths and state", () => {
  it("resolves explicit directories and rejects escaped paths", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-path-"));
    try {
      assert.equal(await resolveProjectRoot({ dir: root }), root);
      await assert.rejects(
        assertContained(root, path.join(root, "..", "outside")),
        (error) => error instanceof MattpackError && error.code === "PATH_OUTSIDE_PROJECT"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a linked destination component", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-link-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "mattpack-outside-"));
    try {
      await symlink(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(
        assertContained(root, path.join(root, "linked", "skills")),
        (error) => error instanceof MattpackError && error.code === "PATH_OUTSIDE_PROJECT"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("validates config and defaults legacy dependency intent to true", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-state-"));
    try {
      await mkdir(path.join(root, ".mattpack"));
      await writeFile(path.join(root, ".mattpack", "config.json"), JSON.stringify({
        schemaVersion: 1,
        preset: "dev",
        harnesses: ["codex"]
      }));
      assert.deepEqual(await readConfig(root), {
        schemaVersion: 1,
        preset: "default",
        harnesses: ["codex"],
        includeDependencies: true
      });
      await writeFile(path.join(root, ".mattpack", "config.json"), "[]");
      await assert.rejects(
        readConfig(root),
        (error) => error instanceof MattpackError && error.code === "INVALID_STATE"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
