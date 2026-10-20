# 皮肤模块 interface 收窄为生产面七字段

---
status: accepted
date: 2026-10-20
---

## 背景

grep 实证：生产代码消费的皮肤字段只有 `{id, label, description, Mark, Name, project, builtinAssets}`（runtime.js 的 register/list/brand-seat，projector.js 的 project，index.js 的 assetResolver）。工厂 return 的其余字段——`css`、`slogans`、`bodyAttr`、`title`、`favicon`、`faviconMime`、`scrimLight`、`scrimDark`、`placeholderDark`——生产零消费，纯由测试读取养活（projector 字节 pins 读 `skin.css/skin.art/skin.scrim*/skin.slogans`）；`art`/`placeholderLight` 只被 index.js 的 builtinAssets 补底分支消费——该分支是 ADR-0004 删除 legacy 适配器后的残影，且在 brand-seat 测试里还有第三份手抄。slogan 默认存在 3–4 份协调副本（catalog default / `SLOGANS` 常量 / 工厂 return / `values.slogan ?? SLOGANS` 兜底），而 `mergeValues` 已保证 `values.slogan` 恒在。删除测试判定：删去这些字段，复杂度不在任何调用方复活——是 interface 肥肉，不是模块。

## Decision

- **生产面 = 七字段**：`{id, label, description, Mark, Name, project, builtinAssets}`。工厂 return 不再携带任何其他字段。
- **register() 强制**：`register()` 对七字段之外的未知字段直接抛错（与既有 id 校验、projector 三层 fail-closed 同风格）；另设白名单测试钉住字段清单。interface 变宽必须动 seam 的构造点。
- **测试读行为不读包装**：projector 字节 pins 改对 `project()` 输出断言；smoke 维持钉构建产物字符串（不经皮肤对象）；brand-seat 测试的合成分支第三抄随分支删除。
- **slogan 默认单源 catalog**：皮肤不再持 `SLOGANS` 常量与 `??` 兜底；ADR-0004「catalog 与工厂 same-source」由构造保证而非纪律保证。
- **builtinAssets 显式声明**：三皮各自声明（openbmc/uefi 的 url 引用各自内部常量），index.js 补底分支及其 `art/placeholderLight` 依赖整体删除。

## Considered Options

- **仅独立 lint 测试、不强制生产**——被否：与仓库全线 fail-closed 风格不一致，且 lint 可被绕过。
- **保留字段供测试读取**——被否：测试作为唯一调用方养活 interface 肥肉，正是「包装不是测试面」的反例；每加一个概念要动工厂 return、project()、catalog、dicts 四处。
- **在 projector/normalizeEffects 层过滤未知字段**——被否：静默过滤掩盖 interface 漂移，不如在构造点失败。

## Consequences

- 皮肤模块的 interface 与生产消费面逐字段对齐；新增字段成为显式决策（动 register 白名单）。
- 工厂 return 三处瘦身；index.js 失去合成分支；测试不再能绕过 `project()` 直接读静态包装。
- 与 ADR-0013 同批实施：投影核表驱动组装使 `project()` 成为皮肤唯一的行为出口，收窄后的皮肤 = 声明表 + Mark/Name + 品牌 CSS 与资源。
- GLOSSARY 不新增词条（interface 标准属 ADR 范畴，非领域语言）。

## Amendments

- 无（首版）。

## 附录：grill 共识（2026-10-20 会话存档）

Q12 register() 强制 + 白名单测试（生产 fail closed）；Q13 测试改读 project() 输出；Q14 slogan 单源 catalog；Q15 builtinAssets 显式声明、补底分支删除；Q16 与投影核分立两篇 ADR。
