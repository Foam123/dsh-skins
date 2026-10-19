# 浮层毛玻璃家族收拢为共享生成器

---
status: accepted
date: 2026-10-19
---

## 背景

ADR-0007 的五次修订（v1.2.0 / v1.2.2 / v1.2.3 / v3 / v1.5.1）每一次都以「三/四皮肤同构」收尾，每一步落地都是同一段家族 CSS 在 openbmc / uefi-harness / meirenzhi（移除前的 tgcf 同样）三处锁步手抄：`2aa4b85`（tooltip 抬升）三文件同修、`8773a28`（灯箱豁免）三处各 ±12 行、`7b7113b`（dsh-context v3）三皮同补。「三皮同构、仅 tint 异」这条不变量一直由 `overlay-frost.test.mjs` 按皮钉住——不变量是共享的，实现却是三抄的：任何一次家族语义修订都要三文件锁步，漏掉一份即静默发散，且三份注释抄本已各自措辞分叉。

## Decision

- 家族 CSS（菜单三件套 + 冻层 ⑧~⑧e 全段，选择器并集与配方常量）由 `src/client/skins/frost-family.js` 的单一函数 `frostFamilyCss(scope, tints)` 生成；`tints = { frost: { light, dark }, menu: { light, dark } }` 四个带空格 `"R, G, B"` 字符串是仅有的皮肤自由度。
- tint 色值与品牌资源仍由各皮肤目录自持——`developers.md` 自持条款（不从其他皮肤目录导入视觉资源）不变；本决定只把「家族机制」收拢到 `skins/` 平级的共享模块，与 `runtime.js` 承载通用机制的定位同构。
- ADR-0007 的修订规程由「登记后同步四处」改为「登记后同步一处」（家族生成器），ADR-0007 已加注记。
- 「menu 暗色恰好等于冻层暗色」（仅 meirenzhi 如此）的巧合不编码进 interface——menu 参数独立成对。

## Considered Options

- **保持三皮独立手抄**（现状）：皮肤自持教条最彻底，tgcf 式整体删除最干净（删目录即净），测试已机械持有不变量——被否：不变量已共享而实现三抄，锁步税已付五次且有继续支付的明确趋势；测试只能钉采样点，钉不住「三份彼此同构」本身。
- **双段返回 `{ menuCss, frostCss }`**：openbmc/uefi 文件内规则位置 bit 级不动——被否：把「菜单声明历史上恰好住在 token 块、冻层段住在尾部」这一偶然布局固化进 interface；单点插入（菜单迁入家族段）才是家族的自然边界。

## Consequences

- 字节验收线（操作定义）：openbmc / uefi 的家族规则在 canon literal 通道下逐字——声明 trim 后逐字节相等、选择器空白折叠后相等；值级空格风格（`rgb(248, 247, 255)` 逗号后空格等）逐字保留，`smoke-test.cjs` 的带空格钉死原样通过。uefi 家族段选择器行因生成器模板缩进统一 +2 列（旧文件顶格），属排版列位差、CSS 语义零影响；openbmc 在零归一通道下即逐字全等。meirenzhi 家族段允许排版归一（压缩体 → 空格体）。三皮与收拢前的等价由 (选择器, 声明) 对多重集在「去注释 + 去空白」canon 下恒等承载——收拢后家族段为 13 条顶层规则，此前 openbmc/uefi 为 11 条独立规则加散于 token 块的菜单声明。
- developers.md 自持条款增补一句：浮层毛玻璃等家族级机制住 `src/client/skins/` 平级共享模块，tint 色值与品牌资源仍由各皮自持。
- 三份注释抄本收敛为生成器内一段 canonical 家族注释（无测试钉注释字节）。
- 未来新增代码级皮肤（ADR-0004 前瞻条款）接入家族只需一行调用 + 一张 tint 表。
- 本次纯重构不发版，搭下一次 release。

## Amendments

- 无（首版）。
