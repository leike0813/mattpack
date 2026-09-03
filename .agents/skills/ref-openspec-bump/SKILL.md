---
name: ref-openspec-bump
description: Maintain the pinned OpenSpec Git submodule used as Mattpack's development reference. Use when explicitly reviewing or bumping the references/OpenSpec commit.
disable-model-invocation: true
---

# Bump the OpenSpec Reference

## Goal

把 `references/OpenSpec` 更新到一个明确、可复现、经过审查的 OpenSpec commit，并确认 Mattpack 的 harness、路径和所有权设计仍与该参考版本相容。OpenSpec 只作为开发阶段的只读设计参考；完成后 superproject 的 gitlink 是唯一的精确版本记录。

## Non-goals

- 不升级或安装 npm 包 `@fission-ai/openspec`。
- 不运行 OpenSpec 的 `openspec update` 来刷新消费者项目中的生成 skill 或 command 文件。
- 不修改 `references/OpenSpec` 内的源文件、文档、锁文件、测试或生成内容。
- 不把 OpenSpec 代码导入 Mattpack，不把它加入 npm dependencies，不把它打进 package。
- 不自动跟踪 branch、tag、latest 或远端默认分支。
- 不提交、推送或覆盖其他任务的工作区改动。

## When to use

使用本 skill 的请求包括：

- “把参考项目 OpenSpec 更新到某个 commit/tag。”
- “审查并升级 `references/OpenSpec` 的版本。”
- “确认新的 OpenSpec 参考版本是否影响 harness 路径或适配器。”

不要用于：

- 在本项目中创建、实现、验证或归档 OpenSpec change。
- 更新消费者项目由 OpenSpec 生成的 `.agents/skills/openspec-*`、`.claude/skills/openspec-*` 或 command 文件。
- 修改 Mattpack 自身的上游 `mattpocock/skills` vendor 快照。

## Input / Output Contract

### Required input

- `target`: 目标 OpenSpec 版本。优先直接提供 40 位 commit SHA；如果提供 release tag 或 package version，先解析为唯一完整 SHA，再继续。

### Optional input

- `reviewScope`: 关注的适配器、工具路径、skill 生成行为或所有权语义。未提供时审查所有与 Mattpack 参考用途相关的差异。
- `compatibilityDecision`: 用户已经批准的本地适配策略。未提供时由差异证据决定是否需要更新 Mattpack 源码，并在不确定时询问。

### Return

用人类可读的报告返回：

- 当前 gitlink commit、目标 commit，以及目标 tag/package version（如可解析）；
- OpenSpec 差异涉及的文件和对 Mattpack 的兼容性判断；
- 是否修改本地 harness/catalog/测试文件及其理由；
- gitlink、根项目文档和验证命令的结果；
- 未解决 blocker、需要用户决策的兼容性问题和剩余风险。

不要把子模块内部未经验证的版本、路径或测试结果写进结论。

## Execution Flow

### 1. Establish the boundary

从 superproject 根目录开始，读取：

- `AGENTS.md` 的 **OpenSpec Reference Submodule**、**Harness Adapters**、**Testing and Release Gates**；
- `.gitmodules`；
- `references/OpenSpec/package.json`、`README.md`、`CHANGELOG.md`；
- `src/harnesses/registry.ts` 及其相关测试；
- `scripts/verify-package.ts` 和 `package.json` 的 `check`、`test:pack` scripts。

先检查根项目和子模块状态：

```bash
git status --short -- references/OpenSpec AGENTS.md .gitmodules src/harnesses tests
git -C references/OpenSpec status --short
git -C references/OpenSpec rev-parse HEAD
git submodule status -- references/OpenSpec
```

子模块有未提交改动、根 gitlink 已被其他任务修改，或本次相关本地文件已经处于未说明的修改状态时，暂停并报告边界。不要使用 `git reset`、`git checkout --`、`git clean` 或批量 stash 清理工作区。子模块缺失时，只允许用声明的来源初始化：

```bash
git submodule update --init -- references/OpenSpec
```

### 2. Resolve and review the target

目标必须来自 `.gitmodules` 声明的 OpenSpec remote，是唯一完整的 40 位 commit SHA，并且对象可被该 remote fetch。用户提供 tag 或 package version 时，解析并报告其对应 SHA；不要把 tag/version 当作 superproject 的版本记录。

在任何 checkout 前审查当前 gitlink 到目标 commit 的完整差异：

```bash
git -C references/OpenSpec fetch --no-tags origin <target-sha>
git -C references/OpenSpec cat-file -e <target-sha>^{commit}
git -C references/OpenSpec diff --stat <current-sha> <target-sha>
git -C references/OpenSpec diff --name-status <current-sha> <target-sha>
git -C references/OpenSpec show <target-sha>:package.json
git -C references/OpenSpec show <target-sha>:CHANGELOG.md
```

若目标由 tag 解析而来，先确认 tag 指向的对象是 commit，不是可变分支引用。审查 changelog、目标 commit 说明和这些参考区域中实际发生的变化：

- `src/core/config.ts`、`src/core/available-tools.ts`；
- `src/core/shared/skill-paths.ts`、`src/core/shared/tool-detection.ts`、`src/core/shared-skill-target.ts`；
- `docs/supported-tools.md`、`docs/installation.md`；
- `skills/` 下的生成 skill 与其路径；
- `package.json`、schemas、会改变工具安装或检测契约的测试。

建立 `OpenSpec change → Mattpack impact → action` 记录。特别核对：

- canonical tool 是否新增、删除、重命名或改变 project-local skill root；
- `.agents/skills` 共享目标和多个逻辑 harness 的仲裁语义是否改变；
- skill、command、profile、delivery 的默认组合是否改变；
- 检测、路径 containment、所有权或生成内容是否会影响 Mattpack 的 adapter contract；
- 目标 license 和参考用途是否仍符合 `AGENTS.md`。

### 3. Decide local compatibility work

根据差异证据决定本次是否需要更新 Mattpack：

- 只改变 OpenSpec 自身实现、文档或与 Mattpack 无关的工具时，只更新 gitlink，并记录“无本地适配变化”；
- 改变 harness 名称、skill root、检测规则、共享 `.agents/skills` 语义、生成文件边界或所有权假设时，更新 `src/harnesses/registry.ts`、相关类型/服务和 fixture/contract tests；
- 新增工具不能只复制 OpenSpec 的实现，必须通过 Mattpack 既有 adapter contract、项目根路径 containment 和 shared-target dedup 规则；
- 发现目标行为与 Mattpack 产品契约冲突时，暂停并报告冲突，不静默把参考项目行为当成产品要求。

本步骤的语义判断由 LLM 完成。不得因为某个路径在 changelog 中出现就自动修改 registry；必须指出对应代码、文档或测试证据。不得为了适配参考版本而修改 `references/OpenSpec` 内的任何文件。

### 4. Move the submodule gitlink

确认子模块干净且目标已经审查后，在子模块内切换到目标 commit：

```bash
git -C references/OpenSpec checkout --detach <target-sha>
git -C references/OpenSpec rev-parse HEAD
git submodule status -- references/OpenSpec
git diff --submodule=log -- references/OpenSpec
```

成功条件：子模块 HEAD 等于目标 SHA；superproject 将 `references/OpenSpec` 显示为 gitlink 变化；子模块内容没有本地修改。不要执行 `git submodule update --remote`，不要把目标 commit 写入新的重复 lock 文件。`.gitmodules` 只有在远端 URL 确实变化且该变化属于本次明确范围时才修改；通常只更新 gitlink。

如果 checkout 或 fetch 失败，保持原 gitlink 和子模块内容不变，报告错误。不要用工作树复制、压缩包解包或手工编辑模拟 submodule 更新。

### 5. Verify local behavior and package boundary

如果第 3 步发现本地适配变化，先完成对应源码和稳定行为测试，再运行：

```bash
pnpm check
```

`pnpm check` 覆盖 lint、TypeScript 类型检查、测试、npm 离线打包 smoke test 和 `docs:check`；其中打包检查必须证明 `references/OpenSpec` 没有进入 tarball。若本次修改了 adapter、路径、所有权、CLI 或 package boundary，记录其中 `test:pack` 的独立 smoke 结果；不需要为同一结果重复运行整套门禁。

即使没有本地源码变化，也至少确认：

```bash
git -C references/OpenSpec status --short
pnpm check
```

不要在子模块内执行 `pnpm install`、build 或测试作为 Mattpack 的替代验证；该子模块是只读参考，不是本项目的 runtime/build dependency。只有用户明确要求审查 OpenSpec 自身实现时，才把子模块测试作为额外的只读证据，并将其与 Mattpack 门禁分开报告。

### 6. Report and leave reviewable changes

最后运行：

```bash
git status --short
git diff --stat
git diff --submodule=log -- references/OpenSpec
```

报告必须区分：

- superproject 的 gitlink 变化；
- Mattpack 本地源码、测试或文档变化；
- 子模块内部内容（应为干净 checkout，不是 superproject 的普通文件 diff）；
- 已运行的根项目门禁和未运行的可选检查。

不提交、不推送、不自动修正与本次 bump 无关的用户改动。

## LLM vs Script Responsibilities

LLM 必须完成：

- 取得明确 target 并判断 tag/version 到 SHA 的映射；
- 阅读 OpenSpec changelog、关键源码路径和差异，判断对 Mattpack adapter 的影响；
- 决定是否修改本地 registry、路径、所有权逻辑和测试；
- 解释产品契约冲突、兼容性取舍和最终风险；
- 汇总 gitlink 与验证证据。

Git 必须完成：

- 从 `.gitmodules` 声明的 remote 获取并验证 commit；
- 以 detached HEAD checkout 目标 commit；
- 更新 superproject 的 submodule gitlink。

项目脚本必须完成：

- `pnpm check` 中的 lint、类型检查、测试、文档检查、npm 打包和离线 smoke test；
- `scripts/verify-package.ts` 对 `references/OpenSpec` 排除规则的确定性检查。

不要让临时脚本代替 changelog/源码差异的语义审查，也不要手工拼装 submodule 内容、权威路径表或 package 验证结果。

## Constraints / FORBIDDEN

- **必须使用 `.gitmodules` 指向的 remote 和完整 commit SHA；不得把 branch、latest 或可变 tag 当作精确 pin。**
- **必须先审查目标差异，再 checkout gitlink；不得无审查地追踪远端默认分支。**
- **必须保持 `references/OpenSpec` 为只读 submodule；不得修改、复制、导入或打包其内部文件。**
- **必须通过 Mattpack 自身的 adapter contract、路径安全和测试判断兼容性；不得把 OpenSpec 实现直接当作 Mattpack 产品规范。**
- **必须运行 `pnpm check`，并确认 npm tarball 排除 `references/OpenSpec`；不得只验证子模块自身。**
- **不得执行 `git submodule update --remote`，不得清理用户改动，不得提交或推送。**

## Success Criteria

- `references/OpenSpec` 的 HEAD 和 superproject gitlink 指向同一个目标 SHA。
- 目标 commit、tag/package version、changelog 和关键路径差异都有可复核证据。
- harness registry、shared-target、路径、所有权和测试契约已作出明确兼容性判断；需要修改时已完成，不能兼容时已阻塞并说明。
- `pnpm check` 通过，且 npm 打包明确排除 `references/OpenSpec`。
- 子模块工作树干净，superproject 只留下本次批准的 gitlink 和本地兼容性改动。

## Common Pitfalls

- 把 `openspec update` 当成更新 `references/OpenSpec` gitlink；前者作用于已安装 CLI 生成的项目文件。
- 只 checkout 目标 commit，不阅读 changelog 和工具路径差异。
- 用 `git submodule update --remote` 跟踪默认分支，破坏可复现 pin。
- 直接改子模块文件解决本地适配问题，导致参考项目被污染。
- 看到 OpenSpec 新增工具就复制其 adapter，而没有通过 Mattpack 的 registry 和 shared physical-root 规则。
- 运行子模块自身测试后跳过根项目 `pnpm check`，漏掉 npm package exclusion 和本地适配器回归。
- 子模块或根目录已有改动时使用 reset/checkout 清理，误删其他任务内容。

## Example Flow

### Happy path

用户指定一个完整 SHA。检查根项目与子模块干净，阅读当前到目标的 changelog 和关键路径差异，确认本地 adapter 无需变化，执行：

```bash
git -C references/OpenSpec fetch --no-tags origin <target-sha>
git -C references/OpenSpec checkout --detach <target-sha>
pnpm check
```

最后报告目标 SHA、无本地适配变化、gitlink diff 和打包排除结果。

### Near miss

用户说“把 OpenSpec 更新到最新”，但没有指定 release 或 commit。列出需要确认的候选完整 SHA，暂停 checkout；不执行 `git submodule update --remote`，不修改子模块。

## References

按需读取，不要启动时通读全部资料：

| 需要 | 读取 |
|---|---|
| 产品边界、submodule 规则、adapter 和发布门禁 | [`AGENTS.md`](../../AGENTS.md) 的 OpenSpec Reference Submodule、Harness Adapters、Testing and Release Gates |
| remote 与 submodule 入口 | [`.gitmodules`](../../.gitmodules) |
| 当前参考版本与差异 | [`references/OpenSpec/`](../../references/OpenSpec/) 的 `package.json`、`CHANGELOG.md`、`README.md` |
| 工具清单、路径、检测和 shared target 语义 | `references/OpenSpec/src/core/config.ts`、`src/core/available-tools.ts`、`src/core/shared/skill-paths.ts`、`src/core/shared/tool-detection.ts`、`src/core/shared-skill-target.ts` |
| 公开工具路径和安装行为 | `references/OpenSpec/docs/supported-tools.md`、`references/OpenSpec/docs/installation.md` |
| Mattpack 本地适配与回归范围 | [`src/harnesses/registry.ts`](../../src/harnesses/registry.ts)、相关 `tests/` |
| package exclusion 和离线 smoke test | [`scripts/verify-package.ts`](../../scripts/verify-package.ts)、[`package.json`](../../package.json) |
| 上游项目来源 | [`Fission-AI/OpenSpec`](https://github.com/Fission-AI/OpenSpec) |
