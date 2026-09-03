# Mattpack

[English README](README.md)

Mattpack 是一个非官方的项目级安装器，用于从 [mattpocock/skills](https://github.com/mattpocock/skills) 安装精选 preset。它与 Matt Pocock 没有隶属关系。

它会把 npm 包中固定版本的上游快照复制到 coding-agent harness 使用的原生 skill 目录。正常命令不会访问 GitHub，不会创建全局状态、运行后台服务、要求账号或 API key，也不会收集遥测数据。

## 为什么按项目按需安装

`mattpocock/skills` 是一套非常实用的 AI-native development skills。如果把大量 skill 作为全局 skill 安装，agent 执行任何任务时都要在 skill catalog 中为它们消耗一部分预算。部分 harness，包括 Codex，还可能因此触发 prompt 截断。按项目、按需安装可以把这部分 catalog 限制在真正需要它的项目中。

上游集合包含许多分散的 skill，它们之间还有一定的依赖关系。Mattpack 针对常见场景提供多个 preset，用户只需选择场景，不必自己梳理依赖图。

现有的项目级 skill 管理工具，例如 [skills-manager](https://github.com/xingkongliang/skills-manager)，是 GUI 程序。对开发者来说，CLI 更容易使用，也更容易嵌入 worktree 自动化流程。

## 快速开始

```sh
npx @leike0813/mattpack init --tools codex
```

Mattpack 只会写入选定的项目根目录。复现旧版本安装结果时，请固定包版本：

```sh
npx @leike0813/mattpack@0.1.0 init --tools codex
```

## Preset

| Preset | 别名 | 用途 | Roots | 新增依赖 | 最终数量 |
|---|---|---|---:|---|---:|
| `default` | `developing`<br>`dev` | 精选的日常软件开发 skill | 13 | `codebase-design (requires)`<br>`domain-modeling (requires)`<br>`grilling (requires)` | 16 |
| `general` | — | 轻量级通用规划和 agent 工作流支持 | 5 | `grilling (requires)` | 6 |
| `full` | — | 所有已推广的稳定 skill | 25 | — | 25 |
| `beta-only` | `in-progress` | 所有 beta root 以及所需的 stable 依赖 | 8 | `code-review (requires)`<br>`codebase-design (requires)`<br>`grilling (requires)`<br>`setup-matt-pocock-skills (setupCompanion)`<br>`writing-for-agents (requires)` | 13 |
| `everything` | `beta`<br>`experimental` | 所有已推广、in-progress 和 misc skill | 37 | — | 37 |

Preset 选择 root。可以通过 `--skills <逗号分隔的 id>` 或交互式 skill catalog 添加单独的 root。Mattpack 会递归加入声明为 `requires` 和 `setupCompanion` 的 skill，说明每个新增 skill 的原因，去重结果，并拒绝缺失节点或循环依赖。`beta-only` 的 root 只来自 beta，但仍可能加入 stable 依赖。只有在接受安装结果可能不可用时才使用 `--no-deps`。

## 支持的 Harness

| Harness | 项目级 skill 目录 |
|---|---|
| `agents` | `.agents/skills` |
| `amazon-q` | `.amazonq/skills` |
| `antigravity` | `.agents/skills` |
| `auggie` | `.augment/skills` |
| `bob` | `.bob/skills` |
| `claude` | `.claude/skills` |
| `cline` | `.cline/skills` |
| `codeartsagent` | `.codeartsdoer/skills` |
| `codebuddy` | `.codebuddy/skills` |
| `codex` | `.agents/skills` |
| `command-code` | `.commandcode/skills` |
| `continue` | `.continue/skills` |
| `costrict` | `.cospec/skills` |
| `crush` | `.crush/skills` |
| `cursor` | `.cursor/skills` |
| `devin` | `.devin/skills` |
| `factory` | `.factory/skills` |
| `forgecode` | `.forge/skills` |
| `gemini` | `.gemini/skills` |
| `github-copilot` | `.github/skills` |
| `hermes` | `.hermes/skills` |
| `iflow` | `.iflow/skills` |
| `junie` | `.junie/skills` |
| `kilocode` | `.kilocode/skills` |
| `kimi` | `.kimi-code/skills` |
| `kiro` | `.kiro/skills` |
| `lingma` | `.lingma/skills` |
| `oh-my-pi` | `.omp/skills` |
| `opencode` | `.opencode/skills` |
| `pi` | `.pi/skills` |
| `qoder` | `.qoder/skills` |
| `qwen` | `.qwen/skills` |
| `roocode` | `.roo/skills` |
| `rovodev` | `.rovodev/skills` |
| `trae` | `.trae/skills` |
| `vibe` | `.vibe/skills` |
| `zcode` | `.zcode/skills` |
| `zed` | `.agents/skills` |

`agents`、`antigravity`、`codex` 和 `zed` 共用 `.agents/skills`。同时选择它们时只写入一棵物理目录，并记录所有逻辑消费者。检测结果只作建议，显式传入的 `--tools` 优先。

## 命令

```text
mattpack [init] [preset]
mattpack inspect [preset]
mattpack list
mattpack update
mattpack doctor
mattpack remove
```

常用选项包括 `--dir <path>`、`--tools <逗号分隔的 id>`、`--tools all`、`--skills <逗号分隔的 id>`、`--yes`、`--dry-run`、`--json`、`--no-color`、`--force` 和 `--no-deps`。`--skills` 会为 `init` 的持久选择或 `inspect` 的检查计划追加显式 root；移除已保存的选择需使用 TUI。交互式 `mattpack init` 仍以 Preset 和 Tools 为两个主步骤，在 Preset 页按 `S` 可打开分页 skill catalog。显式传入 preset 时从 Tools 开始，但可以返回编辑 Preset 和 Skills。传入 `--tools` 会跳过设置 TUI，此时未提供 preset 就默认使用 `default`。首次安装会预选检测到的 harness。非交互环境下缺少必要输入会报错。`inspect` 使用真实安装规划器但不会写入，`update` 根据当前运行包中的快照同步，`doctor` 只报告漂移而不会自动修复。

`init`、`update` 和 `remove` 在交互式写入前会展示真实计划。脚本、agent 和 JSON 写入必须传入 `--yes`；dry-run 和无变化的 update 不需要确认。拒绝确认不会修改项目，Ctrl+C 会以状态码 130 退出。

JSON 模式下 stdout 只输出一个结构化 JSON 值。人类可读的诊断和 `--no-deps` 警告输出到 stderr。使用 `--no-color` 或 `NO_COLOR` 获取纯文本输出。

## 所有权与安全

Mattpack 将用户意图保存到 `.mattpack/config.json`，将解析后的 hash 保存到 `.mattpack/lock.json`，并在每个受管理 skill 旁放置一个 `.mattpack-owner.json`。它不会修改复制后的 `SKILL.md` 文件。

- 已存在但不属于 Mattpack 的目标会被报告为冲突并保留。
- 已受管理但被本地修改的文件会被保留，除非传入 `--force`。
- 受管理目录中的额外文件会被保留并报告为漂移。
- `--force` 会在替换前将受影响内容备份到 `.mattpack/backups/`。
- preset 收缩和 `remove` 只会删除仍与之前 lock 匹配的内容。
- 输入不变的重复安装是真正的 no-op。

写入会经过 staging，在替换前再次检查，失败时回滚，并最后才写入 `lock.json`。

## 随包上游来源

本版本包含 `mattpocock/skills` 的 commit `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`，遵循 MIT 许可证。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。完整的上游 skill 目录按字节复制，Mattpack 不会执行上游脚本。

[OpenSpec](https://github.com/Fission-AI/OpenSpec) 固定在 `references/OpenSpec`，仅作为开发阶段的设计参考。它不是运行时依赖，也不会包含在 npm 包中。

## 开发

需要 Node.js 20+ 和 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm check
```

使用 `pnpm run docs` 同时生成中英文 README。CI 使用 `pnpm docs:check` 检查 catalog、harness 表格和 README 是否漂移。
