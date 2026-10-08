import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { SKILL_DEPENDENCIES } from "../src/catalog/dependencies.js";
import { CANONICAL_PRESETS, PRESETS, presetRoots } from "../src/catalog/presets.js";
import { loadUpstreamCatalog } from "../src/catalog/upstream.js";
import { resolveSkillSet } from "../src/core/dependency-graph.js";
import { HARNESS_ADAPTERS } from "../src/harnesses/registry.js";

const packageRoot = process.cwd();
const packageManifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as { version: string };
const packageVersion = packageManifest.version;
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
  "npx @leike0813/mattpack init --tools codex",
  "```",
  "",
  "Mattpack writes only below the selected project root. Pin the package version when reproducing an older installation:",
  "",
  "```sh",
  "npx @leike0813/mattpack@" + packageVersion + " init --tools codex",
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
  "npx @leike0813/mattpack init --tools codex",
  "```",
  "",
  "Mattpack 只会写入选定的项目根目录。复现旧版本安装结果时，请固定包版本：",
  "",
  "```sh",
  "npx @leike0813/mattpack@" + packageVersion + " init --tools codex",
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
  "A preset selects roots. Add individual roots with `--skills <comma-separated ids>` or the interactive skill catalog. Mattpack recursively adds declared `requires` and `setupCompanion` skills, reports why each was added, deduplicates the result, and rejects missing nodes or cycles. `beta-only` has beta roots but may add stable dependencies. Use `--no-deps` only when you accept a potentially unusable installation.",
  "",
  "## Supported harnesses",
  "",
  "| Harness | Project-local skill root |",
  "|---|---|"
);
chineseLines.push(
  "",
  "Preset 选择 root。可以通过 `--skills <逗号分隔的 id>` 或交互式 skill catalog 添加单独的 root。Mattpack 会递归加入声明为 `requires` 和 `setupCompanion` 的 skill，说明每个新增 skill 的原因，去重结果，并拒绝缺失节点或循环依赖。`beta-only` 的 root 只来自 beta，但仍可能加入 stable 依赖。只有在接受安装结果可能不可用时才使用 `--no-deps`。",
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
  "Harnesses that share a root (including `.agents/skills` and Roo/Zoo Code's `.roo/skills`) write one physical tree and record every logical consumer. Detection is advisory, while an explicit `--tools` selection wins. See [harness audit evidence](docs/harness-audit.md) for verified product surfaces.",
  "",
  "CoStrict now targets `.costrict/skills` and Kilo Code targets `.kilo/skills`. Preview `update --dry-run`: unchanged owned files migrate through the normal planner; local edits and extra files at the old root remain preserved and reported. Resolve unowned conflicts at the new root before updating.",
  "",
  "`amazon-q` is retired because the reviewed Q CLI has no native skills target; its IDE surface remains unverified. Stored selections return `UNKNOWN_TOOL` from update/doctor before writes. Reselect supported tools with `init --tools <ids> --yes`, or use ownership-safe `remove --yes` to uninstall from the old lock.",
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
  "Common options are `--dir <path>`, `--tools <comma-separated ids>`, `--tools all`, `--skills <comma-separated ids>`, `--yes`, `--dry-run`, `--json`, `--no-color`, `--force`, and `--no-deps`. `--skills` adds explicit roots to the persisted selection for `init` and to the plan for `inspect`; use the TUI to remove selections. Interactive `mattpack init` keeps Preset and Tools as two main steps and opens a paginated skill catalog from Preset with `S`. An explicit preset starts at Tools but can return to editable Preset and Skills pages. Supplying `--tools` skips the setup TUI, and an omitted preset then defaults to `default`. Detected harnesses are pre-selected on first setup. Non-interactive ambiguity is an error. `inspect` uses the installation planner without writing, `update` reconciles against the snapshot in the running package, and `doctor` reports drift without repairing it.",
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
  "## Upgrading from the previous snapshot",
  "",
  "Upgrade the Mattpack package, then preview `mattpack update --dry-run`. Upstream promoted `implement-spec` and `retro` to stable, added stable `pr` and beta `chief-of-staff`, and removed `resolving-merge-conflicts`. New skills follow dynamic presets; `default` only drops the removed skill and `general` is unchanged. To keep the promoted skills in `beta-only`, add them explicitly with `mattpack init beta-only --tools <your-tools> --skills implement-spec,retro --yes`.",
  "",
  "If `.mattpack/config.json` lists `resolving-merge-conflicts` in `additionalSkills`, remove that entry before retrying `update` or interactive `init`. Both validate stored roots and return `UNKNOWN_SKILL` before writes; preserve the other selections and configuration.",
  "",
  "The skills now use `GLOSSARY.md` and `GLOSSARY-MAP.md`. Rename existing `CONTEXT.md` and `CONTEXT-MAP.md` documents as appropriate, including per-context files and map links, and update navigation pointers in project instructions and domain configuration. Mattpack leaves these consumer documents untouched. Upstream has frozen `misc` maintenance; those skills remain available through `everything`. See [release notes](https://github.com/leike0813/mattpack/blob/main/CHANGELOG.md).",
  "",
  "## Bundled provenance",
  "",
  "This release bundles `mattpocock/skills` commit `" + commit + "` under the MIT license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Complete upstream skill directories are copied byte-for-byte; Mattpack does not execute upstream scripts.",
  "",
  "[OpenSpec](https://github.com/Fission-AI/OpenSpec) is pinned under `references/OpenSpec` as a development-only design reference. It is not a runtime dependency and is excluded from the npm package.",
  "",
  "## Development",
  "",
  "Use Node.js 24 and the pinned pnpm version for development. The published CLI supports Node.js 20+; CI also runs the tests and offline package smoke test on Node.js 20.",
  "",
  "```sh",
  "pnpm install --frozen-lockfile",
  "pnpm check",
  "```",
  "",
  "Regenerate both language versions with `pnpm run docs`; CI uses `pnpm docs:check` to reject catalog, harness-table, or README drift.",
  "",
  "Maintainers can use the development-only [Matt skills automation](docs/automations.md) to review a fixed upstream SHA and open a draft PR. It is excluded from the npm package; consumer commands remain offline.",
  "",
  "See the [release and npm publishing guide](https://github.com/leike0813/mattpack/blob/main/docs/releases.md) before preparing or publishing a release.",
  ""
);
chineseLines.push(
  "",
  "共用目录的 harness（包括 `.agents/skills`，以及 Roo/Zoo Code 的 `.roo/skills`）只写入一棵物理目录，并记录所有逻辑消费者。检测结果只作建议，显式传入的 `--tools` 优先。已核实的产品形态见 [harness 审计依据](docs/harness-audit.md)。",
  "",
  "CoStrict 的目标改为 `.costrict/skills`，Kilo Code 改为 `.kilo/skills`。先用 `update --dry-run` 查看计划：未修改的受管理文件通过现有规划器迁移，旧目录中的本地修改和额外文件会保留并报告。新目录存在不属于 Mattpack 的冲突时，先处理冲突再更新。",
  "",
  "`amazon-q` 已移除，因为审查过的 Q CLI 没有原生 skills 目标；IDE 形态仍未核实。保存了该选择的项目在 update/doctor 写入前会收到 `UNKNOWN_TOOL`。可用 `init --tools <ids> --yes` 重新选择支持的工具，或用 `remove --yes` 根据旧 lock 安全卸载。",
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
  "常用选项包括 `--dir <path>`、`--tools <逗号分隔的 id>`、`--tools all`、`--skills <逗号分隔的 id>`、`--yes`、`--dry-run`、`--json`、`--no-color`、`--force` 和 `--no-deps`。`--skills` 会为 `init` 的持久选择或 `inspect` 的检查计划追加显式 root；移除已保存的选择需使用 TUI。交互式 `mattpack init` 仍以 Preset 和 Tools 为两个主步骤，在 Preset 页按 `S` 可打开分页 skill catalog。显式传入 preset 时从 Tools 开始，但可以返回编辑 Preset 和 Skills。传入 `--tools` 会跳过设置 TUI，此时未提供 preset 就默认使用 `default`。首次安装会预选检测到的 harness。非交互环境下缺少必要输入会报错。`inspect` 使用真实安装规划器但不会写入，`update` 根据当前运行包中的快照同步，`doctor` 只报告漂移而不会自动修复。",
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
  "## 从上一版快照升级",
  "",
  "先升级 Mattpack 包，再用 `mattpack update --dry-run` 查看计划。上游将 `implement-spec`、`retro` 转为稳定 skill，新增稳定 skill `pr` 和 beta skill `chief-of-staff`，并删除 `resolving-merge-conflicts`。新 skill 随动态 preset 收录；`default` 只移除被删除的 skill，`general` 保持不变。若要在 `beta-only` 中保留晋升的两个 skill，可运行 `mattpack init beta-only --tools <你的工具> --skills implement-spec,retro --yes` 显式追加。",
  "",
  "若 `.mattpack/config.json` 的 `additionalSkills` 含有 `resolving-merge-conflicts`，请先删除这一项，再重试 `update` 或交互式 `init`，并保留其他选择与配置。两个命令都会校验已保存的 root，在写入前返回 `UNKNOWN_SKILL`。",
  "",
  "Skill 现在使用 `GLOSSARY.md` 和 `GLOSSARY-MAP.md`。请按项目情况重命名已有的 `CONTEXT.md`、`CONTEXT-MAP.md`，包括各 context 中的文件和 map 内的链接，并更新项目指令及领域配置中的导航引用。Mattpack 会保留这些消费者文档。上游已冻结 `misc` 的维护，相关 skill 仍可通过 `everything` 安装。详见[更新记录](https://github.com/leike0813/mattpack/blob/main/CHANGELOG.md)。",
  "",
  "## 随包上游来源",
  "",
  "本版本包含 `mattpocock/skills` 的 commit `" + commit + "`，遵循 MIT 许可证。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。完整的上游 skill 目录按字节复制，Mattpack 不会执行上游脚本。",
  "",
  "[OpenSpec](https://github.com/Fission-AI/OpenSpec) 固定在 `references/OpenSpec`，仅作为开发阶段的设计参考。它不是运行时依赖，也不会包含在 npm 包中。",
  "",
  "## 开发",
  "",
  "开发使用 Node.js 24 和固定版本的 pnpm。发布的 CLI 支持 Node.js 20+；CI 也会在 Node.js 20 上运行测试和离线安装包验证。",
  "",
  "```sh",
  "pnpm install --frozen-lockfile",
  "pnpm check",
  "```",
  "",
  "使用 `pnpm run docs` 同时生成中英文 README。CI 使用 `pnpm docs:check` 检查 catalog、harness 表格和 README 是否漂移。",
  "",
  "维护者可使用开发专用的 [Matt skills 自动化](docs/automations.md)，审查固定的上游 SHA 并创建 draft PR。自动化不包含在 npm 包中，消费者命令仍然离线运行。",
  "",
  "准备或发布版本前，请阅读[发布与 npm 发布指南](https://github.com/leike0813/mattpack/blob/main/docs/releases.md)。",
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
      process.stderr.write(`${path.basename(file)} is out of date; run pnpm run docs.\n`);
      outdated = true;
    }
  }
  if (outdated) process.exitCode = 1;
} else {
  await Promise.all(outputs.map(([file, output]) => writeFile(file, output, "utf8")));
}
