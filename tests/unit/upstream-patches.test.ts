import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import { applyUpstreamPatches } from "../../scripts/lib/upstream-patches.js";
import { loadUpstreamLock } from "../../src/catalog/upstream.js";

it("applies a recorded patch and fails without changing files when it no longer applies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-patch-"));
  try {
    const checkout = path.join(root, "checkout");
    await mkdir(checkout);
    await mkdir(path.join(root, "patches"));
    execFileSync("git", ["init", "--quiet", checkout]);
    await writeFile(path.join(checkout, "value.txt"), "before\n");
    await writeFile(path.join(root, "patches/fix.patch"), "--- a/value.txt\n+++ b/value.txt\n@@ -1 +1 @@\n-before\n+after\n");
    await applyUpstreamPatches(checkout, root, ["patches/fix.patch"]);
    assert.equal(await readFile(path.join(checkout, "value.txt"), "utf8"), "after\n");
    await assert.rejects(applyUpstreamPatches(checkout, root, ["patches/fix.patch"]));
    assert.equal(await readFile(path.join(checkout, "value.txt"), "utf8"), "after\n");
    await assert.rejects(applyUpstreamPatches(checkout, root, ["../outside.patch"]), { code: "PATH_OUTSIDE_PROJECT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("validates optional patch provenance before use", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-patch-lock-"));
  try {
    const entry = { repository: "https://github.com/mattpocock/skills.git", commit: "a".repeat(40), vendorPath: "vendor/mattpocock-skills", license: "MIT" };
    const save = async (patches: unknown) => writeFile(path.join(root, "upstream.lock.json"), JSON.stringify({
      schemaVersion: 1, upstreams: { "mattpocock/skills": { ...entry, ...(patches === undefined ? {} : { patches }) } }
    }));
    for (const patches of [undefined, [], ["patches/fix.patch"]]) {
      await save(patches);
      assert.deepEqual((await loadUpstreamLock(root)).upstreams["mattpocock/skills"].patches, patches);
    }
    for (const patches of ["patches/fix.patch", [null], ["/tmp/fix.patch"], ["patches/../fix.patch"], ["patches\\fix.patch"], ["patches/fix.patch", "patches/fix.patch"]]) {
      await save(patches);
      await assert.rejects(loadUpstreamLock(root), { code: "INVALID_UPSTREAM" });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
