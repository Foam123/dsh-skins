# 上游钩子守卫的 CI 结构化强制：装配钉版本 runtime

---
status: accepted
date: 2026-10-19
---

## 背景

`scripts/verify-upstream-hooks.mjs`（ADR-0006/0007/0009 的漂移绊网）是 `pnpm run check` 中唯一观察真实 DSH runtime 的门禁——bundle-guard 是壁纸体积门、smoke-test 跑在 DOM 桩上。但它解析不到 runtime 时打印人类可读黄字后 `exit 0`（跳过与验证过对一切调用方是同一个值），而 ci.yml 与 release.yml 的 GitHub runner 上不可能存在 runtime：**发布路径上这道门必然空转绿**，tag 一推即经 OIDC 发布到 npm latest。此前唯一强制点是 developers.md 发版第 2 步的 runbook 句子——写给人看的 prose，不在管线里；工作区 AGENTS.md 为此维护过踩坑注记。

## Decision

- **CI 装配 runtime（路线 A），不引入收据（路线 B）**：ci.yml 与 release.yml 在 `pnpm run check` 前经 `scripts/ci-install-runtime.mjs` 装配钉版本伞包 `@deepseek-ai/dsh-web-app@<pin>`——其依赖树以同一精确版本传递钉住整个 @deepseek-ai/dsh-* 同步家族（含 dsh-web-frontend 的 dist 资产），守卫在 runner 上以 strict（pnpm store）模式真跑。强制从「人的前置条件」变为「管线的结构属性」：runtime 在场，守卫不可能不跑。
- **钉版本单一来源** `scripts/runtime-pin.json`（exact semver，`tests/upstream-hooks-verdict.test.mjs` 钉死禁用可变 dist-tag）；两个 workflow 各一行调用共享脚本。**bump pin = manifest 重推导时刻**：strict 模式的精确哈希（Sixlwa_bubble 等）可能随新 runtime 失效，pin-bump PR 的 CI 红灯就是 ADR-0006「fails check at upgrade time」的设计触发点。
- **三态机器可辨裁决**：守卫输出 `upstream-hooks: VERIFIED <mode> — …` / `upstream-hooks: SKIPPED <原因>` / `upstream-hooks: FAILED (<n> problems)`；frontend dist 缺失时 VERIFIED 行如实标注 overlay 段 NOT CHECKED。本地无 runtime 机器仍 exit 0 + SKIPPED（absence is not a code defect），但从此可 grep。
- **pin 与 peerDependencies 无机械联动**：pin 是「验证过什么」，peer floor 是「声称支持什么」——允许「对旧版本仍声称支持但不再验证」的合法状态；bump pin 的 PR 顺带人工复核 peer floor。

## 被否方案

- **收据模式（路线 B）**：守卫在有 runtime 的机器真跑后落盘收据（含 runtime 指纹）提交进仓库、verify-release.mjs 在 tag 校验时强制消费。验证面最全（真实 306 包 runtime），但强制点退回「人记得跑+提交」、失败发现在 push tag 时（晚）、仓库多一件生成物。
- **跟随 next dist-tag**：上游一发版 CI 即可能红，且混淆 floor/ceiling 语义；exact pin 让红灯落在可审查的 bump PR 上。
- **混合（A+B）**：单人仓库过度工程。

## 实现期发现（2026-10-19，落地当日基线三连红及其处置）

守卫首次对活 runtime（web store 0.2.1-rc.2，本机与伞包同版本）strict 真跑即红 ×3——v1.5.9 曾带着这三个信号发出（发版 CI 空转绿 + 金标准跑的是 2026-10-11 asar 快照的 structural 模式）。处置（方案甲：管辖域修正 + 最小锚点维护，runtime.js 一行不动）：

- **P1 slots 锚点失效**：`dsh-client-ui-slots` 自 0.2.1-rc.2 不再作为独立包发布（模块编译进 dsh-web-frontend bundle）。锚点从 SERVICE_API_ANCHORS（lib 子串查 inject/register）移至第 6 节 frontend dist 的模块表键 `"@deepseek-ai/dsh-client-ui-slots"`——存在性检查，比原子串锚更真。
- **P2 attachment 伪命中面**：`dsh-client-ui-attachment` 的 `._frame` 是图片附件 tile/thumbnail 边框，无 `_sidebarCol` 子元素、永不可能命中 ADR-0009 选择器——按既有模式加入 reviewed set。
- **P3 sidebar `_root` 消失（遗留：桌面复核）**：ui-sidebar 0.2.1-rc.2 web build 不再有任何 `_root` 类，`background:var(--dsw-specific-sidebar-fill)` 涂底仍在但换了类名。守卫的 v2 前提检查改为 **desktop（asar）布局专属**——ADR-0009 本就是 Desktop 规则（`html[data-windows-titlebar]` 门控），对 web store 断言 desktop 涂底前提是类别错位（与 exact-hash 仅 strict 模式生效同一先例，非降级为警告）。**遗留**：现行 desktop 构建是否保留 `_root` 未取证；若也已改名，runtime.js 的 ADR-0009 v2/v3 规则 `[class*="_sidebarCol"] > [class*="_root"]` 疑似 no-op（桌面单涂对齐可能自 runtime 更新起静默失效）——需主人在 Windows 实机或新 asar 解包上复核后再裁决是否重推导规则。

## Consequences

- 发布路径空转绿消除：release.yml 的 `pnpm run check` 从「必然跳过守卫」变为「必然真跑守卫」；漂移发现时刻从 tag 时提前到 pin-bump PR 时。
- 守卫 page-wide 盘点在 CI 覆盖伞包全家族（实测 210 包），与真实 runtime（306 包）的差距收窄到家族外偶发 @deepseek-ai 包；本地金标准手跑（`DSH_RUNTIME_ROOT`）仍可用，不再设门禁。
- `.dsh-ci-runtime/` 入 .gitignore；scratch 装配 `--ignore-scripts`（守卫只读 lib/*.js 与 dist 资产）。
- developers.md 发版第 2 步人肉提示退役；工作区 AGENTS.md 对应踩坑注记退役（含 asar 解包可用性判定更新）。
- 新增 `tests/upstream-hooks-verdict.test.mjs`：钉死 SKIPPED token + exit 0、pin 的 exact-semver 形态。

## Amendments

- 无（首版）。

## 附录：grill 共识（Q1–Q13，2026-10-19 会话存档）

1. **Q1** 路线 A（CI 装配 runtime）胜出：结构性强制优于流程性收据。
2. **Q2** 三态 token 化：两条路线共同的诚实化底座。
3. **Q3** manifest 自动化（守卫↔src 选择器的机械链接）划出边界，留后续。
4. **Q4** 文档收编：developers.md + 工作区 AGENTS.md 注记退役；know-how 018/008 不动；GLOSSARY 不动。
5. **Q5** ci.yml 也装配：漂移发现提前到 pin-bump PR。
6. **Q6** 钉版本单一来源 `runtime-pin.json`，bump = 重推导触发点。
7. **Q7** 共享脚本 `ci-install-runtime.mjs`，两 workflow 一行调用。
8. **Q8** 立 ADR-0011。
9. **Q9** GLOSSARY 零改动（无新领域语言）。
10. **Q10** verdict 回归测试。
11. **Q11** pin 与 peer floor 无机械联动，本 ADR 记纪律。
12. **Q12** 直接开工，ADR 即设计记录，不再单写实施计划。
13. **Q13** 落地日三连红按方案甲处置（见「实现期发现」）；P3 桌面复核移交主人。
