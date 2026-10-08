import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyReleaseTag } from "../../scripts/lib/release.js";

test("release tags match a stable version of the public package", () => {
  const manifest = { name: "@leike0813/mattpack", version: "0.1.4" };
  assert.equal(verifyReleaseTag(manifest, "v0.1.4"), "0.1.4");
  for (const [value, tag] of [
    [manifest, "v0.1.3"],
    [manifest, "0.1.4"],
    [{ ...manifest, version: "0.1.4-beta.1" }, "v0.1.4-beta.1"],
    [{ ...manifest, version: "01.1.4" }, "v01.1.4"],
    [{ ...manifest, name: "other-package" }, "v0.1.4"],
    [{ ...manifest, version: 4 }, "v0.1.4"],
    [null, "v0.1.4"],
    [[], "v0.1.4"]
  ] as const) {
    assert.throws(() => verifyReleaseTag(value, tag), { code: "INVALID_ARGUMENT" });
  }
});
