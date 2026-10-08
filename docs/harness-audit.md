# Harness 审计依据

适配路径以 `src/harnesses/registry.ts` 为事实源，公开路径表由 `pnpm run docs` 生成。本记录解释新增、纠正和移除决策，不维护第二份完整路径表。安装仅复制原始 skill 目录，测试验证安装生命周期，不等于证明每个 harness 都能执行全部跨 skill 调用。

审查材料来自官方文档、官方源码及 agent-harness-wiki 发布版本
`web-v1-ef4bbcdbb6a9bac18db54c9be3b377a75e8a1c48`（2026-10-06）。
下列 reference ID 可通过 wiki MCP 的 `get_source` 查询原文、定位和快照身份；它们仅用于开发审查，消费者运行时不访问 wiki。

## 共享目录和产品形态

| 决策 | 官方依据与 wiki 定位 | 适用范围 |
|---|---|---|
| 增加 Amp | [官方文档](https://ampcode.com/docs/markdown/customize/skills)，`ref-amp-skills-precedence` | 项目 skills |
| 增加 Codebuff | [源码](https://github.com/CodebuffAI/codebuff)，`sdk/src/skills/load-skills.ts:113–140`，`ref-codebuff-skills-dirs` | SDK/CLI 默认项目发现；自定义 skillsPath 会覆盖默认目录 |
| 增加 Warp | [skills 文档](https://docs.warp.dev/agents/capabilities/skills.md)，`ref-warp-skills-project`；`ref-warp-rules-project` | Warp agent；WARP.md 是额外检测线索 |
| 增加 Replit Agent | [官方文档](https://docs.replit.com/features/agent/skills.md)，`ref-replit-agent-skills-scope` | 有版本控制项目目录的 hosted agent |
| 区分 Roo Code 和 Zoo Code | [Roo 源码](https://github.com/RooCodeInc/Roo-Code)，`ref-roo-skills-code-dirs`（b867ec91）；Zoo 的 `ref-zoo-code-docs-skills` / `cat-zoo-code-readme`（bf3bc781） | 两个产品各有逻辑 ID，共用同一物理根 |

共享目录的存在只能建议一个候选集合，不能证明唯一产品身份。显式选择优先；同根消费者由现有 planner 合并。

## 专用项目目录

| 新增产品 | 官方依据与 wiki 定位 |
|---|---|
| Autohand | [官方仓库](https://github.com/autohandai/code-cli)，`ref-autohand-skills-discovery`；用户目录和第三方目录扫描另见 `ref-autohand-src-skill-locations`、`ref-autohand-src-thirdparty-skill-dirs` |
| Deep Agents | [源码](https://github.com/langchain-ai/deepagents)，`libs/code/deepagents_code/skills/load.py:64–79`，`ref-deep-agents-skills-precedence` |
| DeepSeek Harness | [源码](https://github.com/deepseek-ai/deepseek-harness)，`packages/skill/skill-filesystem/src/index.ts:245–257`，`ref-dsh-skills-provider-roots` |
| Goose | [源码](https://github.com/block/goose)，`crates/goose/src/skills/mod.rs:371–443`，`ref-goose-skills-src-roots` |
| Grok Build | [官方仓库文档](https://github.com/xai-org/grok-build)，Skill Locations，`ref-grok-skills-doc-locations` |
| MiniMax Code | [源码](https://github.com/MiniMax-AI/MiniMax-Code)，`packages/local-runtime/src/skills/roots.ts:76–120`，`ref-minimax-code-skills-roots-external` |
| OpenHands | [SDK 源码](https://github.com/OpenHands/software-agent-sdk)，`openhands-sdk/openhands/sdk/skills/skill.py:853–935`，`ref-openhands-sdk-skills-project` |
| Prime Agent | [官方仓库文档](https://github.com/PrimeIntellect-ai/prime-agent)，Locations，`ref-prime-agent-skills-locations` |
| SourceCraft Code Assistant | [官方文档](https://sourcecraft.dev/portal/docs/en/code-assistant/operations/agent/skills.md)，Select the location，`ref-sc-ca-skills-locations` |

OpenHands SDK 确实读取专用 skills 目录，官方建议新 skill 使用共享目录；本适配选择仍受支持的专用目录以保留产品选择边界。SourceCraft 的依据覆盖 VS Code Code Assistant，其他 CLI 形态不据此推定。所有新增路径都有同一套检测、安装、幂等、冲突、更新和移除测试。

## 纠正及排除

- CoStrict 使用 [CSC 官方 skills 文档](https://docs.costrict.ai/csc/tools-and-plugins/skills)，`ref-costrict-skills-locations`。旧 `.cospec` 映射来自不同配置约定；当前 CSC 的项目目标是 `.costrict`。
- Kilo Code 使用 [官方源码](https://github.com/Kilo-Org/kilocode)，`packages/kilo-docs/pages/customize/skills.md:145–156`，`ref-kilo-code-skills-project`。安装目标为 `.kilo`；运行时读取 `.kilocode` 配置的依据是 `ref-kilo-code-skills-src-configdirs`，因此保留该检测线索。
- 移除 Amazon Q：审查的官方 CLI commit `15cc8f3cd18c4272925ce1c7053268eedff1ea0a` 的 agent schema、slash commands 和根命令没有 skills 机制（`ref-amazon-q-repo-agent-schema`、`ref-amazon-q-repo-slash-commands`、`ref-amazon-q-repo-root-subcommands`）。[AWS 文档](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.md)说明 Q CLI 已转为 Kiro CLI。Amazon Q IDE 未核实，不能由此宣称整个产品家族都不支持。
- `hermes`、`iflow`、`codeartsagent`、`zcode` 保留固定 OpenSpec 参考中的明确项目 skills 目标；wiki 缺少记录不构成删除证据。
- Lovable、Bolt 没有核实的项目文件系统 skills 目标，本次不收录。只支持全局目录的目标同样不收录。

固定 OpenSpec 参考仍是基线，明确的官方证据可以纠正其中的过时路径。审计本身不推进任何参考 pin。

路径迁移及 Amazon Q 已存配置的恢复步骤见生成的中英文 README。旧根中的本地改动和额外文件按所有权规则保留；新根的未受管理冲突不能直接覆盖。
