---
name: upstream-bump
description: Maintain the pinned mattpocock/skills source snapshot, catalog, and package provenance. Use when explicitly reviewing, bumping, or validating the upstream skills commit.
disable-model-invocation: true
---

# Bump the Upstream Skills Snapshot

## Goal

把 `mattpocock/skills` 的一个明确、可复现的 commit 更新为 Mattpack 的 vendor 快照，并让目录校验、preset、依赖、文档、许可证声明和 npm 离线包保持一致。整个流程完成后，代码库必须只承认目标 commit，不留下“锁已更新但 vendor 未更新”的半完成状态。

## Non-goals

- 不维护消费者项目中的 `.mattpack` 安装状态；消费者更新使用已发布 Mattpack 包的 `mattpack update`。
- 不把上游仓库变成运行时网络依赖，不跟踪 branch、tag 或 `latest`。
- 不改写、重命名、裁剪或翻译 vendor 中的上游 skill 内容。
- 不自动扩大 `default` 或 `general`；新 skill 是否加入这些显式 allowlist 是产品决策。
- 不提交、推送或覆盖与本次更新无关的工作区改动。

## When to use

使用本 skill 的请求包括：

- “把 Matt Pocock skills 更新到某个 commit/tag。”
- “审查并同步 `mattpocock/skills` 的上游版本。”
- “验证当前 vendor 快照和 upstream lock 是否一致。”

不要用于：

- 只想在消费者项目安装或更新 skill。
- 只想编辑某个上游 `SKILL.md`。
- 只想更新 `references/OpenSpec` 子模块。

## Input / Output Contract

### Required input

- `target`: 目标上游版本。优先直接提供 40 位小写 commit SHA；如果提供 tag 或 release，先解析为唯一的完整 SHA，再继续。

### Optional input

- `reviewScope`: 用户指定的变更范围或关注的 skill。未提供时审查整个上游差异。
- `releaseNotes`: 用户提供的发行说明或比较链接。未提供时从上游仓库的 commit、变更文件和 changelog 获取证据。

目标不明确、无法解析为唯一 commit，或用户只说“更新到最新”但没有批准候选 commit 时，先询问目标，不写文件。

### Return

用人类可读的报告返回：

- 当前锁定 commit 与目标 commit；
- 上游差异中新增、删除、重命名、移动 bucket、frontmatter、plugin manifest 和依赖相关的发现；
- 修改的 Mattpack 文件；
- `pnpm sync:upstream`、`pnpm validate:upstream`、`pnpm docs`、`pnpm check` 的结果；
- 未解决 blocker、未纳入 preset 的新增 skill 以及需要用户决策的事项。

保留脚本产生的 JSON 行作为证据；不要把未验证的 skill 数量、依赖或测试结果写进结论。

## Execution Flow

### 1. Establish the boundary

从项目根目录开始，读取：

- `AGENTS.md` 的 **Upstream Locking**、**Presets**、**Dependency Catalog**、**Testing and Release Gates**、**Documentation and Licensing**；
- `upstream.lock.json`；
- `package.json` 的 `sync:upstream`、`validate:upstream`、`docs`、`check` 和 `test:pack` scripts；
- `scripts/sync-upstream.ts`、`scripts/validate-upstream.ts`；
- `src/catalog/upstream.ts`、`src/catalog/presets.ts`、`src/catalog/dependencies.ts`。

先运行：

```bash
git status --short
```

记录开始时已存在的改动。保留它们，不使用 `git reset`、`git checkout --`、`git clean` 或批量 stash 清理工作区。如果 `upstream.lock.json`、`vendor/mattpocock-skills/`、上面列出的 catalog/script 文件已经被其他工作修改，暂停并说明冲突边界。

### 2. Resolve and review the target

验证目标来自 `https://github.com/mattpocock/skills.git`，是完整 40 位小写 SHA，并且目标对象可由上游 fetch。用户给出 tag 或 release 时，报告 tag/version 到 SHA 的解析结果；不要把 tag 写入 lock。

在任何写入前审查从当前 commit 到目标 commit 的完整差异：

- 阅读上游 release notes、changelog 或目标 commit 的说明；
- 枚举 `skills/engineering/`、`skills/productivity/`、`skills/in-progress/`、`skills/misc/` 中的目录增删改和 bucket 变化；
- 检查每个变动 skill 的目录名、`SKILL.md` frontmatter、附属文件、链接和执行脚本；
- 检查 `.claude-plugin/plugin.json` 的 promoted skill 列表；
- 检查 `LICENSE` 和上游许可是否仍满足 `upstream.lock.json` 的约束；
- 为每个潜在依赖变化写出证据和候选 `requires` / `setupCompanions` 边，不能从 prose 的偶然提及自动推断依赖。

形成一份简短的变更决策表：`upstream change → Mattpack action → reason/evidence`。没有明确产品理由时，新稳定 skill只进入动态 `full`，不进入 `default` 或 `general`。

### 3. Change the lock

只更新 `upstream.lock.json` 中 `mattpocock/skills.commit` 为目标 SHA。保留 `schemaVersion`、repository、vendorPath 和 license；不要引入第二个 upstream 记录或复制目标内容到其他手维护文件。

修改后立即检查 JSON 和 diff：

```bash
pnpm exec node --input-type=module -e "import { readFileSync } from 'node:fs'; JSON.parse(readFileSync('upstream.lock.json', 'utf8'))"
git diff -- upstream.lock.json
```

如果随后同步失败，且失败发生在 vendor 替换之前，把本次写入的 commit 恢复为开始时的值，并报告失败原因；不要留下锁与快照不一致的工作区。

### 4. Regenerate the vendor snapshot

运行仓库已有的确定性同步脚本：

```bash
pnpm sync:upstream
```

该命令会 fetch 精确 commit，把允许的 `LICENSE`、`.claude-plugin/plugin.json` 和四个 source bucket 复制到 staging，先完成目录校验，再原子替换 `vendor/mattpocock-skills/`。成功 stdout 是单行 JSON，至少包含 `commit` 和 `skills`。

成功条件：输出 commit 等于目标 SHA，且命令退出码为 0。脚本失败时不要手工复制、删除或修改 `vendor/mattpocock-skills/`；先按错误类型修复源 catalog 或目标选择，再重新运行。

### 5. Reconcile catalog and product policy

运行：

```bash
pnpm validate:upstream
```

它必须同时通过：

- `upstream.lock.json` schema、完整 SHA、MIT license 和 package 内路径检查；
- source bucket 目录、普通文件、路径安全、无 symlink、每个 skill 的单一 `SKILL.md` 和 frontmatter 检查；
- stable/beta/misc 数量门禁；
- `.claude-plugin/plugin.json` 与 promoted skill 路径一致性。

若目标快照改变了受保护的数量或 manifest，先确认这是真实上游变更，再同步更新 `src/catalog/upstream.ts` 的门禁和对应测试。不要为了让命令通过而删除校验或把数量改成无约束的“动态成功”。

按审查结果维护：

- `src/catalog/presets.ts`：显式 roots、aliases、preset purpose；`full`、`beta-only`、`everything` 继续按 catalog bucket 动态解析；
- `src/catalog/dependencies.ts`：仅记录有上游/产品证据的 `requires` 和 `setupCompanions`；检查缺失节点、重复边、循环和 reason chain；
- 相关 unit/integration/e2e 测试：只更新稳定的可观察契约和目标数量，不锁定无关文案或文件顺序。

上游新增 skill 不等于 Mattpack 自动提供依赖。Mattpack 的依赖目录是唯一事实源。

### 6. Regenerate documentation and provenance

目录和 catalog 一致后运行：

```bash
pnpm docs
```

该命令根据同一 catalog 生成 `README.md` 和 `README.zh-CN.md`。然后手动更新 `THIRD_PARTY_NOTICES.md` 中记录的上游 commit 和与该快照相关的事实；保留 MIT attribution，不把 OpenSpec 子模块写进 npm provenance。

检查 README、catalog、lock 和 notice 中的 commit 与数量是否来自同一个目标快照。不要手写重复的 preset 表来绕过 `generate-readme.ts`。

### 7. Run release gates

运行：

```bash
pnpm check
```

`pnpm check` 必须覆盖 lint、TypeScript 类型检查、测试、npm 离线打包 smoke test 和 `docs:check`。其中打包门禁必须证明：

- `vendor/mattpocock-skills` 的许可文件和代表性 skill 被打包；
- `references/OpenSpec`、tests、scripts 等开发内容没有进入 tarball；
- 离线 `init`、`doctor`、幂等重装和 `remove` 仍然成功。

失败时按失败模块修复；不要跳过检查、只运行编译，或把失败测试标记为预期变化。若失败来自开始前已存在的无关改动，区分并报告，不要覆盖它。

### 8. Report and leave reviewable changes

最后运行：

```bash
git diff --stat
git status --short
```

确认本次变更只包含目标 lock、vendor、catalog、测试、生成文档、第三方声明以及明确需要的源码。vendor 中的每个文件都应来自同步脚本；不要提交、推送或替用户解决未授权的冲突。

## LLM vs Script Responsibilities

LLM 必须完成：

- 解释用户目标并取得明确 target；
- 阅读上游差异和 changelog，判断新增/删除/重命名 skill 的产品影响；
- 决定显式 preset 是否变化；
- 根据证据维护依赖边和测试范围；
- 解释验证结果与剩余风险。

脚本必须完成：

- fetch 精确 commit、白名单复制、路径与文件类型检查、staging 和原子替换：`pnpm sync:upstream`；
- catalog、frontmatter、数量和 plugin manifest 校验：`pnpm validate:upstream`；
- README 稳定生成：`pnpm docs`；
- lint、类型检查、测试、npm 打包和离线 smoke test：`pnpm check`。

不要让临时脚本代替语义审查，也不要让 LLM 手工拼接 vendor 文件、权威 README 表格或验证 JSON。

## Constraints / FORBIDDEN

- **必须使用完整、唯一、可复现的 commit SHA；不得把 branch、tag、latest 或日期写入 lock。**
- **必须通过 `pnpm sync:upstream` 生成 vendor；不得直接编辑 `vendor/mattpocock-skills/`。**
- **必须审查并明确记录 preset 与依赖决策；不得从 skill prose 自动猜依赖，不得静默扩大 `default` 或 `general`。**
- **必须在写入完成后运行 `pnpm validate:upstream` 和 `pnpm check`；不得以编译成功代替 package smoke test。**
- **不得执行上游脚本、把 OpenSpec 子模块打包、修改消费者项目状态、清理用户改动、提交或推送。**

## Success Criteria

- `upstream.lock.json`、vendor、catalog、文档和第三方声明指向同一目标 SHA。
- 上游目录安全检查、frontmatter 检查、source bucket 和 plugin manifest 校验全部通过。
- 每个显式 preset 的 roots、依赖闭包、reason chain 和测试都与审查结果一致。
- `pnpm check` 通过，且 npm 离线打包不包含 `references/OpenSpec`。
- 工作区没有由本流程制造的半更新状态；报告包含完整 diff 范围和可复核证据。

## Common Pitfalls

- 只改 `upstream.lock.json`，忘记同步 vendor，导致 package 宣称的版本与实际字节不一致。
- 同步脚本因新数量失败时放宽门禁，而不是审查真实 catalog 变化。
- 看到新稳定 skill 就加入 `default`，破坏显式 allowlist 和可复现选择。
- 仅凭 skill 文本中出现的名称添加依赖，造成隐式或循环依赖。
- 手动编辑 vendor 或 README 表格，绕过原子同步和生成器。
- 在已有工作区改动上使用 reset/checkout，误删其他任务的内容。
- 把 `mattpack update`（消费者行为）与本仓库的 upstream bump 混为一谈。

## Example Flow

### Happy path

用户指定一个完整 SHA。读取当前 lock 与上游差异，审查 skill/manifest/license，更新 lock，运行：

```bash
pnpm sync:upstream
pnpm validate:upstream
pnpm docs
pnpm check
```

最后报告目标 SHA、catalog/preset/依赖决策、测试结果和可审查 diff。

### Near miss

用户只说“跟随上游 main”，但没有指定可复现提交。列出需要的完整 SHA 或已发布 release 对应 SHA，暂停写入；不把 `main` 写进 lock，也不运行会产生半更新状态的同步流程。

## References

按需读取，不要启动时通读全部资料：

| 需要 | 读取 |
|---|---|
| 产品不变量、pin、发布门禁 | [`AGENTS.md`](../../AGENTS.md) 的 Upstream Locking、Presets、Dependency Catalog、Testing and Release Gates、Documentation and Licensing |
| 当前上游身份 | [`upstream.lock.json`](../../upstream.lock.json) |
| 同步与原子替换行为 | [`scripts/sync-upstream.ts`](../../scripts/sync-upstream.ts) |
| 快照校验行为 | [`scripts/validate-upstream.ts`](../../scripts/validate-upstream.ts)、[`src/catalog/upstream.ts`](../../src/catalog/upstream.ts) |
| preset 与依赖唯一事实源 | [`src/catalog/presets.ts`](../../src/catalog/presets.ts)、[`src/catalog/dependencies.ts`](../../src/catalog/dependencies.ts) |
| 生成文档与打包门禁 | [`scripts/generate-readme.ts`](../../scripts/generate-readme.ts)、[`scripts/verify-package.ts`](../../scripts/verify-package.ts)、[`package.json`](../../package.json) |
| 上游差异与发行说明 | [`mattpocock/skills`](https://github.com/mattpocock/skills)、目标 commit 的 compare/changelog |
