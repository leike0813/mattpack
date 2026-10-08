import { MattpackError } from "../../src/core/errors.js";

export function verifyReleaseTag(manifest: unknown, tag: string): string {
  if (typeof manifest !== "object" || manifest === null || !("name" in manifest)
    || manifest.name !== "@leike0813/mattpack" || !("version" in manifest)
    || typeof manifest.version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(manifest.version)) {
    throw new MattpackError("INVALID_ARGUMENT", "Release requires the public Mattpack package and a stable version");
  }
  if (tag !== `v${manifest.version}`) {
    throw new MattpackError("INVALID_ARGUMENT", "Release tag must match package.json version");
  }
  return manifest.version;
}
