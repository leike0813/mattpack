# Matt skills 自动化维护

这是 Mattpack 仓库的开发工具。它仅维护 `mattpocock/skills` 快照和相关 catalog、测试、文档及许可声明，不维护 harness 知识库或消费者项目，也不随 npm 包分发。

协调入口是 [.agents/skills/matt-skills-monitor/SKILL.md](../.agents/skills/matt-skills-monitor/SKILL.md)。仓库 AGENTS.md 提供持续授权：固定本次观察的上游 SHA，审查并同步，在完整验证和独立审查后正常提交、推送维护分支，创建或更新 draft PR。所有 PR 人工合并；自动化不发布 npm，不改 package version，不推进 OpenSpec 参考。

## 运行环境与调度

使用专用、干净的 linked worktree，而非主工作区。Node.js 24、已安装的 pnpm 开发依赖、Git、已认证的 `gh` 和 Orca runtime 必须可用。依赖准备由维护者完成；任务不能自行安装或升级。

| 项目 | 配置 |
|---|---|
| Orca provider | codex |
| Coordinator | minimax-cn/MiniMax-M3.1-Flash-Preview |
| Reasoning | high |
| Worktree | 固定独立目录，existing workspace |
| Session | 每次 fresh session |
| Schedule | daily 02:00，Asia/Shanghai |
| Missed run grace | 60 分钟 |
| Initial state | disabled |

在该 worktree 的 ignored `.codex/config.toml` 中设置：

```toml
model = "minimax-cn/MiniMax-M3.1-Flash-Preview"
model_reasoning_effort = "high"
```

沿用机器上已配置的 provider 和认证，不在仓库存储凭据。Native subagent 使用已有角色配置；只有带明确所有权和验收边界的任务才委派，最终独立审查及验收由 coordinator 负责。

注册参数示例（把 workspace selector 换成该仓库的专用 worktree；本机可执行文件也可能叫 `orca-ide`）：

```sh
orca automations create --name "Matt skills maintenance" \
  --trigger daily --time 02:00 --timezone Asia/Shanghai \
  --provider codex --workspace "<monitor-worktree-selector>" \
  --prompt "执行 matt-skills-monitor skill，使用默认 origin/main 基线，完成审计、验证、draft PR 和结构化报告。" \
  --disabled --fresh-session --missed-run-grace-minutes 60 --json
```

注册 ID、实际路径、首次验收 run ID 等本机信息保存到 ignored
`var/matt-skills-monitor/registration.json`。不要把本机路径或账号写进公开配置。

## 生命周期入口

在专用 worktree 根目录运行：

```sh
pnpm upstream:monitor --help
pnpm upstream:monitor start --owner-pid <coordinator-pid>
pnpm upstream:monitor status
pnpm upstream:monitor finish <run-id> --result-file <result-file>
pnpm upstream:monitor recover <run-id>
```

`owner-pid` 必须是跨整个维护流程存活的 coordinator 进程，不能是执行一次命令就退出的 shell 或 Node 脚本。start 默认 fetch `origin/main`；首次 feature 验收可显式传 `--base-ref <feature-commit>`。每次仅观察一次上游 main，之后只使用返回的完整 targetCommit。

stdout 是一个 JSON envelope：成功为 `{ok:true,result:...}`，失败为 `{ok:false,error:{code,message}}`。pnpm 自身可能打印命令头；需要机器消费时用 `pnpm --silent upstream:monitor ...`。详细 handoff/result 字段和结束 payload 见协调 skill。

整个语义审查、worker、验证、Git 和 PR 操作都在同一份仓库级锁下。锁位于 Git common directory，所有 linked worktree 共用。start 校验 linked worktree、清洁状态和 origin 身份；失败时不会把 PR 查询异常当成“没有 PR”。脚本会复用仍开放的 draft 维护分支，已关闭/合并的分支则从基线建立新分支。

上游没有变化时只生成报告，不 fetch 上游对象、不提交、不推送、不建 PR。存在变化时，脚本把固定两个 SHA 的完整差异存入 run 目录，由 agent 审查。vendor 替换仍通过已有 `pnpm sync:upstream` 完成，禁止执行上游脚本。

## 报告和故障恢复

运行证据写入 ignored `var/matt-skills-monitor/<run-id>/`；最近完成结果为原子写入的 `latest.json`。四种结果：`noop`、`draft_pr`、`blocked`、`failed`。draft_pr 必须包含 PR URL。blocked/failed 保留未提交变化及差异证据。

发现运行未结束时，先用 status 检查 run ID、owner PID、路径和进程是否存活。活跃运行不能抢锁；不完整或损坏的 metadata 必须停止并交给维护者诊断。只有明确匹配的 run ID 且 owner 已退出时，recover 才释放锁并清理该 run 记录的自有临时 checkout。若短期 lifecycle guard 也因中断遗留，recover 还必须核实 guard owner 已退出，并串行回收它；缺少 owner metadata 或遗留 recovery-guard 时停止诊断。它不会重置维护分支或清理用户改动。

如果前次失败留下脏 worktree，先审查 diff 和报告，再由维护者决定如何续做、提交或保存。后续自动运行会拒绝进入脏目录。不要用 reset、clean、强推或批量删除来“修复”。

## 首次验收与启用

保持 task disabled，手动运行一次并检查：

1. 实际协调模型及 reasoning，与 worktree 配置一致；
2. 返回完整 pinned/target SHA，报告使用本次固定的观察结果；
3. noop 时没有源同步、额外 commit、push 或 PR；
4. latest.json outcome 正确，status 没有遗留活跃锁；
5. schedule、timezone、fresh session 和 disabled 状态正确。

尚未合并的 feature 只在首次验收用 feature commit 作为 base-ref，随后把 prompt 恢复为默认 origin/main。Feature PR 合并前不能启用默认调度；合并后维护者检查专用 worktree 干净且基线包含本功能，再手动启用。验收报告不能用脚本 fixture 测试代替真实 Orca 运行。

2026-10-08 的真实 fresh-session 验收使用 feature commit
`2b997fa072603a63b454bc9ad9d5db4728630f6e`。实际协调模型为指定的
MiniMax-M3.1-Flash-Preview/high；单次观察返回的 pin 和 target 均为
`b0618bc436ad893b3c5e84e55fba86586d34a404`，结果为 noop，
finish 后锁释放且 worktree 干净。随后恢复 origin/main prompt，
保留 disabled、02:00 Asia/Shanghai 和 fresh session 设置。
变化后的完整更新/审查/PR 分支通过 Git fixture 测试验证，尚未触发真实上游更新。
