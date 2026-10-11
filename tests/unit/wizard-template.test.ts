import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const template = (await readFile(path.join(packageRoot, "vendor/mattpocock-skills/skills/engineering/wizard/template.sh"), "utf8"))
  .replace(/\r\n/gu, "\n");
// Only reviewed helpers run; stages, browsers, and external services are excluded.
const helpers = ["_existing", "ask", "ask_secret", "write_env"].map((name) => {
  const match = template.match(new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?^\\}`, "m"));
  assert.ok(match);
  return match[0];
}).join("\n");
const bash = process.platform === "win32"
  ? path.resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "../../../bin/bash.exe")
  : "bash";

interface Scenario { name: string; env: string | null; input: string; result: string | null }
const cases: Scenario[] = [
  { name: "new file accepts Enter", env: null, input: "\n", result: "" },
  { name: "missing key accepts Enter", env: "OTHER=untouched\n", input: "\n", result: "" },
  { name: "new value", env: null, input: "replacement\n", result: "replacement" },
  { name: "unquoted default", env: "KEY=old\n", input: "\n", result: "old" },
  { name: "single-quoted default", env: "KEY='old'\n", input: "\n", result: "old" },
  { name: "double-quoted default", env: 'KEY="old"\n', input: "\n", result: "old" },
  { name: "CRLF double-quoted default", env: 'KEY="old"\r\n', input: "\n", result: "old" },
  { name: "CRLF undecodable default rejects Enter", env: 'KEY="old$value"\r\n', input: "\n", result: null },
  { name: "empty default", env: 'KEY=""\n', input: "\n", result: "" },
  { name: "replace safe default", env: 'KEY="old"\n', input: "replacement\n", result: "replacement" },
  { name: "new file at EOF", env: null, input: "", result: null },
  { name: "safe default at EOF", env: 'KEY="old"\n', input: "", result: null },
  { name: "partial input at EOF", env: 'KEY="old"\n', input: "replacement", result: "replacement" }
];
for (const [name, env] of [
  ["backslash", 'KEY="old\\nvalue"\n'],
  ["dollar", 'KEY="old$value"\n'],
  ["embedded quote", 'KEY="old"value"\n'],
  ["command substitution", 'KEY="$(touch SHOULD_NOT_EXIST)"\n']
]) {
  assert.ok(name && env);
  cases.push(
    { name: `${name} rejects Enter`, env, input: "\n", result: null },
    { name: `${name} accepts replacement`, env, input: "replacement\n", result: "replacement" },
    { name: `${name} at EOF`, env, input: "", result: null },
    { name: `${name} with partial input at EOF`, env, input: "replacement", result: "replacement" }
  );
}

for (const helper of ["ask", "ask_secret"]) {
  describe(`wizard ${helper}`, () => {
    for (const scenario of cases) {
      it(scenario.name, async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), "mattpack-wizard-"));
        try {
          const envFile = path.join(root, ".env");
          if (scenario.env !== null) await writeFile(envFile, scenario.env);
          const run = spawnSync(bash, ["-c", `set -euo pipefail
ENV_FILE=.env
BOLD= DIM= RESET= GREEN=
WRITTEN_ENV=()
warn() { printf '%s\\n' "$1"; }
${helpers}
${helper} KEY "Enter value:"
write_env KEY "$KEY"
printf '%s' "$KEY" > result
`], { cwd: root, input: scenario.input, encoding: "utf8", timeout: 5000 });
          assert.ifError(run.error);
          assert.equal(run.signal, null);
          if (scenario.result === null) {
            assert.notEqual(run.status, 0);
            assert.equal(existsSync(path.join(root, "result")), false);
            assert.equal(existsSync(envFile) ? await readFile(envFile, "utf8") : null, scenario.env);
          } else {
            assert.equal(run.status, 0, run.stderr);
            assert.equal(await readFile(path.join(root, "result"), "utf8"), scenario.result);
            const preserved = scenario.env?.includes("OTHER=") ? "OTHER=untouched\n" : "";
            assert.equal(await readFile(envFile, "utf8"), `${preserved}KEY='${scenario.result}'\n`);
          }
          assert.equal(existsSync(path.join(root, "SHOULD_NOT_EXIST")), false);
        } finally { await rm(root, { recursive: true, force: true }); }
      });
    }
  });
}
