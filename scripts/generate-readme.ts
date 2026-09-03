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
const chinesePurposes = {
  default: "精选的日常软件开发 skill",
  general: "轻量级通用规划和 agent 工作流支持",
  full: "所有已推广的稳定 skill",
  "beta-only": "所有 beta root 以及所需的 stable 依赖",
  everything: "所有已推广、in-progress 和 misc skill"
} as const;
const lines = [
  "# Mattpack",
  "",
  "[中文文档](README.zh-CN.md)",
  "",
  "Mattpack is an **unofficial** project-local installer for curated presets from [mattpocock/skills](https://github.com/mattpocock/skills). It is not affiliated with Matt Pocock.",
  "",
  "It copies a fixed upstream snapshot bundled in the npm package into the native skill directories used by coding-agent harnesses. Normal commands do not contact GitHub, create global state, run a daemon, require an account or API key, or collect telemetry.",
  "",
  "## Why project-local installation",
  "",
  "`mattpocock/skills` is a practical set of AI-native development skills. Installing a large skill collection globally makes an agent spend part of its skill catalog budget on those skills for every task. Some harnesses, including Codex, can even run into prompt truncation. Installing skills at project scope and only when a project needs them keeps that catalog local to the work.",
  "",
  "The upstream collection contains many separate skills with dependencies between them. Mattpack offers presets for common situations, so users can choose a scenario without working out the dependency graph by hand.",
  "",
  "Existing project-skill managers such as [skills-manager](https://github.com/xingkongliang/skills-manager) are GUI applications. Mattpack provides a CLI that fits developer workflows and can be composed into worktree automation.",
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
const chineseLines = [
  "# Mattpack",
  "",
  "[English README](README.md)",
  "",
  "Mattpack 是一个非官方的项目级安装器，用于从 [mattpocock/skills](https://github.com/mattpocock/skills) 安装精选 preset。它与 Matt Pocock 没有隶属关系。",
  "",
  "它会把 npm 包中固定版本的上游快照复制到 coding-agent harness 使用的原生 skill 目录。正常命令不会访问 GitHub，不会创建全局状态、运行后台服务、要求账号或 API key，也不会收集遥测数据。",
  "",
  "## 为什么按项目按需安装",
  "",
  "`mattpocock/skills` 是一套非常实用的 AI-native development skills。如果把大量 skill 作为全局 skill 安装，agent 执行任何任务时都要在 skill catalog 中为它们消耗一部分预算。部分 harness，包括 Codex，还可能因此触发 prompt 截断。按项目、按需安装可以把这部分 catalog 限制在真正需要它的项目中。",
  "",
  "上游集合包含许多分散的 skill，它们之间还有一定的依赖关系。Mattpack 针对常见场景提供多个 preset，用户只需选择场景，不必自己梳理依赖图。",
  "",
  "现有的项目级 skill 管理工具，例如 [skills-manager](https://github.com/xingkongliang/skills-manager)，是 GUI 程序。对开发者来说，CLI 更容易使用，也更容易嵌入 worktree 自动化流程。",
  "",
  "## 快速开始",
  "",
  "```sh",
  "npx mattpack init default --harness codex",
  "```",
  "",
  "Mattpack 只会写入选定的项目根目录。复现旧版本安装结果时，请固定包版本：",
  "",
  "```sh",
  "npx mattpack@0.1.0 init default --harness codex",
  "```",
  "",
  "## Preset",
  "",
  "| Preset | 别名 | 用途 | Roots | 新增依赖 | 最终数量 |",
  "|---|---|---|---:|---|---:|"
];

for (const name of CANONICAL_PRESETS) {
  const roots = presetRoots(name, catalog);
  const resolved = resolveSkillSet(roots, available, SKILL_DEPENDENCIES);
  const additions = resolved.dependencies.map((item) => item.name + " (" + item.kind + ")");
  lines.push("| " + code(name) + " | " + cells(PRESETS[name].aliases) + " | " + PRESETS[name].purpose + " | " + roots.length + " | " + cells(additions) + " | " + resolved.skills.length + " |");
  chineseLines.push("| " + code(name) + " | " + cells(PRESETS[name].aliases) + " | " + chinesePurposes[name] + " | " + roots.length + " | " + cells(additions) + " | " + resolved.skills.length + " |");
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
chineseLines.push(
  "",
  "Preset 选择 root。Mattpack 会递归加入声明为 `requires` 和 `setupCompanion` 的 skill，说明每个新增 skill 的原因，去重结果，并拒绝缺失节点或循环依赖。`beta-only` 的 root 只来自 beta，但仍可能加入 stable 依赖。只有在接受安装结果可能不可用时才使用 `--no-deps`。",
  "",
  "## 支持的 Harness",
  "",
  "| Harness | 项目级 skill 目录 |",
  "|---|---|"
);

for (const adapter of HARNESS_ADAPTERS) {
  const root = path.relative("/project", adapter.getSkillRoot("/project")).split(path.sep).join("/");
  lines.push("| " + code(adapter.id) + " | " + code(root) + " |");
  chineseLines.push("| " + code(adapter.id) + " | " + code(root) + " |");
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
  "Regenerate both language versions with `pnpm run docs`; CI uses `pnpm docs:check` to reject catalog, harness-table, or README drift.",
  ""
);
chineseLines.push(
  "",
  "`agents`、`codex` 和 `zed` 共用 `.agents/skills`。同时选择它们时只写入一棵物理目录，并记录所有逻辑消费者。检测结果只作建议，显式传入的 `--harness` 优先。",
  "",
  "## 命令",
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
  "常用选项包括 `--dir <path>`、可重复的 `--harness <id>`、`--harness all`、`--yes`、`--dry-run`、`--json`、`--no-color`、`--force` 和 `--no-deps`。在终端中运行 `mattpack` 且输入不足时，会打开 preset 和 harness 选择器；首次安装会预选检测到的 harness。非交互环境下缺少必要输入会报错。`inspect` 使用真实安装规划器但不会写入，`update` 根据当前运行包中的快照同步，`doctor` 只报告漂移而不会自动修复。",
  "",
  "`init`、`update` 和 `remove` 在交互式写入前会展示真实计划。脚本、agent 和 JSON 写入必须传入 `--yes`；dry-run 和无变化的 update 不需要确认。拒绝确认不会修改项目，Ctrl+C 会以状态码 130 退出。",
  "",
  "JSON 模式下 stdout 只输出一个结构化 JSON 值。人类可读的诊断和 `--no-deps` 警告输出到 stderr。使用 `--no-color` 或 `NO_COLOR` 获取纯文本输出。",
  "",
  "## 所有权与安全",
  "",
  "Mattpack 将用户意图保存到 `.mattpack/config.json`，将解析后的 hash 保存到 `.mattpack/lock.json`，并在每个受管理 skill 旁放置一个 `.mattpack-owner.json`。它不会修改复制后的 `SKILL.md` 文件。",
  "",
  "- 已存在但不属于 Mattpack 的目标会被报告为冲突并保留。",
  "- 已受管理但被本地修改的文件会被保留，除非传入 `--force`。",
  "- 受管理目录中的额外文件会被保留并报告为漂移。",
  "- `--force` 会在替换前将受影响内容备份到 `.mattpack/backups/`。",
  "- preset 收缩和 `remove` 只会删除仍与之前 lock 匹配的内容。",
  "- 输入不变的重复安装是真正的 no-op。",
  "",
  "写入会经过 staging，在替换前再次检查，失败时回滚，并最后才写入 `lock.json`。",
  "",
  "## 随包上游来源",
  "",
  "本版本包含 `mattpocock/skills` 的 commit `" + commit + "`，遵循 MIT 许可证。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。完整的上游 skill 目录按字节复制，Mattpack 不会执行上游脚本。",
  "",
  "[OpenSpec](https://github.com/Fission-AI/OpenSpec) 固定在 `references/OpenSpec`，仅作为开发阶段的设计参考。它不是运行时依赖，也不会包含在 npm 包中。",
  "",
  "## 开发",
  "",
  "需要 Node.js 20+ 和 pnpm。",
  "",
  "```sh",
  "pnpm install --frozen-lockfile",
  "pnpm check",
  "```",
  "",
  "使用 `pnpm run docs` 同时生成中英文 README。CI 使用 `pnpm docs:check` 检查 catalog、harness 表格和 README 是否漂移。",
  ""
);

const outputs = [
  [path.join(packageRoot, "README.md"), lines.join("\n")],
  [path.join(packageRoot, "README.zh-CN.md"), chineseLines.join("\n")]
] as const;
if (process.argv.includes("--check")) {
  let outdated = false;
  for (const [file, output] of outputs) {
    const current = await readFile(file, "utf8").catch(() => "");
    if (current !== output) {
      process.stderr.write(`${path.basename(file)} is out of date; run pnpm docs.\n`);
      outdated = true;
    }
  }
  if (outdated) process.exitCode = 1;
} else {
  await Promise.all(outputs.map(([file, output]) => writeFile(file, output, "utf8")));
}
