import { readFile } from "node:fs/promises";

import { verifyReleaseTag } from "./lib/release.js";

const manifest: unknown = JSON.parse(await readFile("package.json", "utf8"));
const version = verifyReleaseTag(manifest, process.env.RELEASE_TAG ?? "");
process.stdout.write(`Verified release v${version}\n`);
