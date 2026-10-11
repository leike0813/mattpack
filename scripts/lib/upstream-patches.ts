import { execFileSync } from "node:child_process";
import path from "node:path";

import { assertContained } from "../../src/core/paths.js";

export async function applyUpstreamPatches(
  checkout: string, packageRoot: string, patches: readonly string[]
): Promise<void> {
  for (const patch of patches) {
    const patchFile = await assertContained(packageRoot, path.resolve(packageRoot, patch));
    execFileSync("git", ["-C", checkout, "apply", "--check", "--", patchFile], { stdio: "pipe" });
    execFileSync("git", ["-C", checkout, "apply", "--", patchFile], { stdio: "pipe" });
  }
}
