import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { SKILL_DEPENDENCIES } from "../src/catalog/dependencies.js";
import { CANONICAL_PRESETS, PRESETS, presetRoots } from "../src/catalog/presets.js";
import { loadUpstreamCatalog } from "../src/catalog/upstream.js";
import { resolveSkillSet } from "../src/core/dependency-graph.js";
import { HARNESS_ADAPTERS } from "../src/harnesses/registry.js";

const packageRoot = process.cwd();
const catalog = await loadUpstreamCatalog(packageRoot);
const available = new Set(catalog.skills.keys());
const commit = catalog.lock.upstreams["mattpocock/skills"].commit;
const code = (value: string): string => "`" + value + "`";
const cells = (values: readonly string[]): string => values.length > 0 ? values.map(code).join("<br>") : "—";
const lines = [
  "# Mattpack",
  "",
  "Mattpack is an **unofficial** project-local installer for curated presets from [mattpocock/skills](https://github.com/mattpocock/skills). It is not affiliated with Matt Pocock.",
  "",
  "It copies a fixed upstream snapshot bundled in the npm package into the native skill directories used by coding-agent harnesses. Normal commands do not contact GitHub, create global state, run a daemon, require an account or API key, or collect telemetry.",
  "",
  "## Quick start",
  "",
  "```sh",
  "npx mattpack init default --harness codex",
  "```",
  "",
  "Mattpack writes only below the selected project root. Pin the package version when reproducing an older installation:",
  "",
  "```sh",
  "npx mattpack@0.1.0 init default --harness codex",
  "```",
  "",
  "## Presets",
  "",
  "| Preset | Aliases | Purpose | Roots | Added dependencies | Resolved |",
  "|---|---|---|---:|---|---:|"
];

for (const name of CANONICAL_PRESETS) {
  const roots = presetRoots(name, catalog);
  const resolved = resolveSkillSet(roots, available, SKILL_DEPENDENCIES);
  const additions = resolved.dependencies.map((item) => item.name + " (" + item.kind + ")");
  lines.push("| " + code(name) + " | " + cells(PRESETS[name].aliases) + " | " + PRESETS[name].purpose + " | " + roots.length + " | " + cells(additions) + " | " + resolved.skills.length + " |");
}

lines.push(
  "",
  "A preset selects roots. Mattpack recursively adds declared `requires` and `setupCompanion` skills, reports why each was added, deduplicates the result, and rejects missing nodes or cycles. `beta-only` has beta roots but may add stable dependencies. Use `--no-deps` only when you accept a potentially unusable installation.",
  "",
  "## Supported harnesses",
  "",
  "| Harness | Project-local skill root |",
  "|---|---|"
);

for (const adapter of HARNESS_ADAPTERS) {
  const root = path.relative("/project", adapter.getSkillRoot("/project")).split(path.sep).join("/");
  lines.push("| " + code(adapter.id) + " | " + code(root) + " |");
}

lines.push(
  "",
  "`agents`, `codex`, and `zed` share `.agents/skills`; selecting them together writes one physical tree and records every logical consumer. Detection is advisory, while an explicit `--harness` selection wins.",
  "",
  "## Commands",
  "",
  "```text",
  "mattpack [init] [preset]",
  "mattpack inspect [preset]",
  "mattpack list",
  "mattpack update",
  "mattpack doctor",
  "mattpack remove",
  "```",
  "",
  "Common options are `--dir <path>`, repeatable `--harness <id>`, `--harness all`, `--yes`, `--dry-run`, `--json`, `--no-color`, `--force`, and `--no-deps`. Running `mattpack` without enough input in a terminal opens preset and harness selectors; detected harnesses are pre-selected on first setup. Non-interactive ambiguity is an error. `inspect` uses the installation planner without writing, `update` reconciles against the snapshot in the running package, and `doctor` reports drift without repairing it.",
  "",
  "`init`, `update`, and `remove` show the real plan before interactive writes. Scripts, agents, and JSON mutations must pass `--yes`; dry runs and no-op updates do not require approval. Declining a prompt leaves the project unchanged, while Ctrl+C exits with status 130.",
  "",
  "In JSON mode stdout is one structured JSON value. Human diagnostics and the `--no-deps` warning use stderr. Use `--no-color` or `NO_COLOR` for plain human output.",
  "",
  "## Ownership and safety",
  "",
  "Mattpack stores intent in `.mattpack/config.json`, resolved hashes in `.mattpack/lock.json`, and a small `.mattpack-owner.json` beside each managed skill. It never edits copied `SKILL.md` files.",
  "",
  "- An existing unowned destination is a conflict and is preserved.",
  "- A locally modified managed file is preserved unless `--force` is supplied.",
  "- Extra files inside managed directories are preserved and reported as divergence.",
  "- `--force` copies affected directories to `.mattpack/backups/` before replacement.",
  "- Preset contraction and `remove` delete only bytes still matching the previous lock.",
  "- An unchanged reinstall is a true no-op.",
  "",
  "Writes are staged, checked again immediately before replacement, rolled back on failure, and committed to `lock.json` last.",
  "",
  "## Bundled provenance",
  "",
  "This release bundles `mattpocock/skills` commit `" + commit + "` under the MIT license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Complete upstream skill directories are copied byte-for-byte; Mattpack does not execute upstream scripts.",
  "",
  "[OpenSpec](https://github.com/Fission-AI/OpenSpec) is pinned under `references/OpenSpec` as a development-only design reference. It is not a runtime dependency and is excluded from the npm package.",
  "",
  "## Development",
  "",
  "Node.js 20+ and pnpm are required.",
  "",
  "```sh",
  "pnpm install --frozen-lockfile",
  "pnpm check",
  "```",
  "",
  "Regenerate this README with `pnpm run docs`; CI uses `pnpm docs:check` to reject catalog or harness-table drift.",
  ""
);

const output = lines.join("\n");
const readme = path.join(packageRoot, "README.md");
if (process.argv.includes("--check")) {
  const current = await readFile(readme, "utf8").catch(() => "");
  if (current !== output) {
    process.stderr.write("README.md is out of date; run pnpm docs.\n");
    process.exitCode = 1;
  }
} else {
  await writeFile(readme, output, "utf8");
}
