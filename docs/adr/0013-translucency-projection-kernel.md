# 通透度投影核：三皮统一参数模型与单源生成

---
status: accepted
date: 2026-10-20
---

## 背景

ADR-0012 收拢了浮层毛玻璃家族 CSS 后，锁步病的最大残留簇在投影数学上：三份手抄 `project()`（openbmc 与 uefi 逐字孪生——重基线 `pt = P + baked − 55`、模糊曲线 `24·max(0,(P−55)/45)²`、riding 装配、legacy 壁纸分支全部同构，仅 RGB 字面量不同；meirenzhi 为 t+offset 方言）。每个 harness 文件内部，riding 表的每对 RGB/烘焙点在静态 CSS 块里再烤一份字面量，P=55 字节等式靠测试钉住而非构造成立。出厂锚 55/55/35 与 desktopBlur 增益率 55 散布 3 个文件多处，仅靠注释互指；`b9c1019` 的 desktopBlur 铰链以三份手抄落地（openbmc 明暗分家、uefi 对称、meirenzhi 同式再抄）。ADR-0010 把 desktop 出厂默认统一为 66 后，锚（web 概念）与 profile 默认（catalog 概念）的分离成为必须显式持有的不变量。catalog.js 注释自认「legacy 壁纸语义住各皮 project() 分支」。

## Decision

- **统一参数模型**：`src/client/skins/translucency.js` 单一入口、表驱动，直接产出完整投影结果（随动重基线、纱、模糊曲线、玻璃规则铰链、桌面模糊增益、壁纸分支、SkinEffects 组装）。皮肤 `project` 退化为「声明表 + 入口」的绑定。meirenzhi 的 `t + off` 模型在数学上即 pivot 形式的实例（锚 35、`baked = 35 + 100·off`，clamp 与格式化逐位一致），展开为表行，不保留方言入口。
- **出厂锚**：单一具名常量同时驱动 riding 重基线与模糊铰链；两代曲线同构 `max·max(0,(P−锚)/(100−锚))²`（span 不独立成参）。锚住皮肤表、与 profile 无关——desktop 出厂 66 属 catalog 默认层，投影核不感知 profile。
- **riding 表强制逐 token 展开**：meirenzhi 的共享 BASE_RGB 是书写便利不是语义，表中每行自含 RGB 与明暗烘焙点。
- **具名 capability**：纱两方言（烤进 image+artLayer / overlay 公式）与壁纸模式（legacy-baked / assets-overlay）、PLACEHOLDER 兜底为表内声明；desktopBlur 增益率独立具名（rate 55，与锚纯属同值巧合），openbmc 暗色无增益为表声明而非行内注释。
- **单源到底**：表同时生成 CSS 块内的 riding 声明——文件内双份字面量从构造上消失，字节等式免测自持；字节验收复用 ADR-0012 的 canon 机器，smoke 钉死值原样通过。
- **验收线**：双出厂点契约测试——每皮 × {web 锚构造性等式、P=66 desktop 金值（补齐现有 pins 缺口：twins riding α=baked+11、blurPx 1、desktopBlur 明 2.2/暗 1（openbmc）或 2.2（uefi）；meirenzhi blurPx 3、desktopBlur 4.2）、P=0 下限、P=100 clamp、逐 token 单调}。

## Considered Options

- **两代模型（legacy / meirenzhi 双入口）**——被否：方言会作为 interface 的第二种形态永久存活；meirenzhi 的世代差异实为参数差异，ADR-0012 对「menu 暗色恰好等于冻层暗色」巧合的处理先例同样适用。
- **只收 `project()`、CSS 块保持手抄**——被否：pins 继续补偿局部性缺失，只消灭跨文件锁步、留下文件内双份，属半份工程。
- **锚从 `getSkinSchema(profile)` 取默认值**——被否：desktop 将以 66 重基线，P=66 时 riding α 误等于烘焙字节（应为 +11），Windows/macOS 出厂观感整体漂移，且现有 pins 全在 web 点上抓不到该回归。
- **增益率与锚共用一个参数**——被否：meirenzhi 锚 35、增益率仍 55，同值巧合编码进 interface 会让 meirenzhi 的桌面模糊曲线变形。

## Consequences

- 通透度语义的任何裁决（出厂锚、曲线、desktop 特例）落在一处；新增代码级皮肤（ADR-0004 前瞻）一张表接入全部投影语义。
- runtime 消费 `--dsw-specific-sidebar-fill` 时反向解析 rgba 字符串的耦合（`parseRgbaChannels` 只认精确逗号格式）暴露面从三处发射缩为一处。
- `meirenzhi-skin` / `personalization-projector` 的逐皮金值测试改写为参数化契约循环；catalog.js「legacy 壁纸语义住各皮 project() 分支」注释随迁指向投影核。
- GLOSSARY 增设「**通透度投影核**」「**出厂锚**」词条（已随本轮裁定写入）。
- 纯重构、零行为变化，独立正式版本发版；沿用 ADR-0012 修正案纪律：独立评审 + 主人 headless A/B 像素实测后收编。
- 与 ADR-0014（皮肤 interface 收窄）同批实施、单 PR 落地。

## Amendments

- **2026-10-20**：本决定以 `1.5.11` 独立正式版本收编（同日完成）：三轮计划评审 + 两轮实现评审 + 主人准许的 headless A/B 像素实测（夹具 12 cell 全等、灵敏度负对照三向检出）背书；发布 tarball / 仓库构建 / 装机 lib 三方逐字节一致，OIDC 发布三键核验通过。实施计划勘误一处留痕：P=100 仅 baked≥锚的 token 钳 1.00（layer-1 亮 = 0.93）。
- 无（首版）。

## 附录：grill 共识（2026-10-20 会话存档）

Q1 统一参数模型胜出（meirenzhi = 锚 35 实例，数学等价经逐位验证）；Q2 出厂锚单一常量驱动重基线与铰链、profile 盲；Q3 落位 `skins/translucency.js` 同 frost-family 位；Q4 单源生成 CSS 声明；Q5 增益率独立具名、openbmc 暗特例进表；Q6 壁纸模式与 PLACEHOLDER 为 capability；Q7 kernel 组装完整结果、皮肤退化为声明；Q8 riding 逐 token 展开；Q9 双出厂点验收；Q10 独立发版；Q11 单 PR 三皮同批。
