# 皮肤装饰族收拢为共享生成器 + 声明表完成度

---
status: accepted
date: 2026-10-21
---

## 背景

2026-10-21 架构摸底（三皮非资产代码逐段对齐）坐实四组共享不变量仍是多抄实现：

- **气泡描边**：`Sixlwa_bubble`/`oRe1gG_bubble` 以 28 处字面量散布 6 个文件（三皮各 4 处、`verify-upstream-hooks.mjs` 12 处、`upstream-hooks.test.mjs` 2 处、`meirenzhi-skin.test.mjs` 2 处），无单一来源；ADR-0011 Q3 显式递延「守卫↔src 选择器的机械链接」，现行靠 `verify-upstream-hooks.mjs:14` 的「keep in sync」注释纪律。哈希重推导是设计上的必然事件（`runtime-pin.json` 注释原话「bump = manifest re-derivation moment」，上游 rc 快车道），每次触发即 6 文件锁步编辑。
- **流式呼吸光条**：三皮三态——openbmc 呼吸动画版、uefi 静态版、meirenzhi 无。这是「正在生成」的状态反馈（用户每轮对话必经），不是纯装饰，换肤即语言不一致。
- **品牌名徽章**：openbmc `.dsh-openbmc-badge` 与 meirenzhi `.dsh-mrz-badge` 为同构反色片（tgcf badge 同源模式），仅 metrics 微差（line-height 14/16、font-weight 650/600，各有目测裁决史）；uefi 为内联描边风单皮变体。
- **root 清底**：openbmc/uefi 持防御性清底（上游 `#root` 现行仅 `height:100%;margin:0`，规则今日 no-op），meirenzhi 无。
- **声明表完成度**：meirenzhi 已是 `constantTokens` 完全体；openbmc/uefi 仍有约 16 token × 明暗（brand/label/interactive/selector/tip/bubble/nav 系，含 `--dsw-font-family` 字体栈）手写在 CSS 模板——ADR-0013「模板持排版、表持值」在两皮的未完成尾巴，恰是 ADR-0012 为 frost 族消灭的「文件内第二份字面量」同病。

## Decision

1. 新模块 `src/client/skins/decoration.js`（与 `frost-family.js` 平级同 doctrine：机制住共享模块，色值/metrics/品牌资源由各皮肤自持），导出五个成员：
   - `BUBBLE_HOOKS`：气泡钩子唯一事实对象 `{ chat: { exact, container }, goal: { exact, container }, bubbleLocal }`；
   - `decorationCss(scope, palette)`：user+goal 气泡描边 4 规则（明暗 × 两表面）；`palette = { light: "R, G, B", dark: "R, G, B" }`（ADR-0012 tint 同形）；描边 alpha（0.38/0.10）与投影几何（`0 1px 4px`/`0 1px 6px`）为机制常量（三皮全等，非参数）；
   - `streamingCss(scope, palette)`：流式呼吸光条三皮统一——静态骨架 `var(--dsw-alias-brand-primary)` + 家族 keyframes（1.6s alternate）+ `prefers-reduced-motion` 兜底；`palette = { decay: "R, G, B" }`，openbmc/uefi 取暗色态品牌主色 @0.20，meirenzhi 取鎏金 `rgba(217,180,92,0.20)`（主人裁定例外，与萤火虫同源色）；
   - `badgeCss(scope, colors, metrics)`：反色片徽章；`colors = { light: {bg,fg}, dark: {bg,fg} }`；`metrics = { lineHeight, fontWeight }` 参数化保留各皮现值（不统一、零像素）；排版常量（inline-flex、4px 圆角、padding 0 5px、10px、字距 .08em）归机制。uefi 描边风徽章不入族、保持内联（单皮变体非不变量）；
   - `rootClear(scope)`：防御性根容器清底一行，三皮统一持有。
2. **守卫与测试同源消费**：`verify-upstream-hooks.mjs` 的 exact-hash 检查、结构前提（userStack/_stack/_bubble）、`BUBBLE_WHITELIST`、verdict 文案与 `tests/upstream-hooks.test.mjs` 的 UNION/GOAL_UNION 钉串全部 import `BUBBLE_HOOKS` 派生——哈希重推导单点编辑、全链路自动同步；「keep in sync」注释纪律退役，ADR-0011 Q3 递延债就此收账。分工不变：守卫验**上游真值**（钩子在上游死没死），lib 计数钉验**接线真值**（皮肤真把常量拼进了 CSS）。
3. **声明表完成度**：openbmc/uefi 手写常量 token（含字体栈）全部迁入各自 `table.constantTokens`；CSS 模板只剩 `ridingDecl` 插值行与真装饰段（徽章/描边/流式/防御），对齐 meirenzhi 完全体。验收不是 staticCss 字节不变，而是机械等式：**anchor 处 `tokenOverrides` 输出与被删静态行逐项相等**（新测试钉住）；constantTokens 经 runtime 施加的通道已被 meirenzhi 生产验证。
4. **canonical 字节格式 = minified 单行**（meirenzhi 现状、frost-family 同风格）；三皮注释抄本收敛为生成器头注一段（取并集，含 ADR-0006 双支兜底原理、goal v1.0.4 扩入裁决、结构分支不命中 goal 的说明）。
5. **视觉变更窗口**（本 ADR 唯一允许的像素变化，经截图 gate + 主人目测）：meirenzhi 新增流式光条；uefi 静态升级呼吸；openbmc keyframes 家族化改名（`obmc-stream-pulse` → 家族名，字节变、像素不变）。其余全部任务零像素。
6. **出局面**（考虑过、不入族）：滚动条同系 token（openbmc 配色细节非结构防御）、placeholder 渐变（wallpaper 表字段自持）、fireflies/呼吸氛围（meirenzhi 个性）、Name JSX 构图、favicon 构造、artLayer 三元（wallpaper 表 plumbing，两实例低值）。

## Considered Options

- **保持三皮手抄**（现状）——被否：与 ADR-0012 同病（不变量已共享而实现三抄），且守卫侧 6 文件 28 处锁步税由上游 rc 发布节奏必然反复触发；测试钉只能 fence 漏改，不能减少要改的地方。
- **仅收描边一族**——被否（主人裁定）：趁摸底一次性收全所有值得入族的共享设计，避免家族机制二次立 ADR。
- **徽章 metrics 统一 16px/600**——被否：引入无必要的 openbmc 像素变化与目测成本；参数化即零像素，统一留作将来目测项。
- **root 清底删除**——被否：上游若回填 root 背景，三皮裸奔且无守卫观察此点；统一持有成本≈0。
- **常量 token 留在 CSS 模板**——被否：每皮两处持值正是 ADR-0013 要消灭的「文件内第二份字面量」；meirenzhi 已证 constantTokens 通道可行。

## Consequences

- 哈希重推导 = `BUBBLE_HOOKS` 单点编辑，守卫、守卫测试、三皮、lib 计数钉全链路自动同步；ADR-0006 修订规程「登记后同步一处」再添一族。
- 第四张皮肤接入装饰族 = decoration.js 各生成器一行调用 + palette 表；徽章/描边/流式/防御零手抄。
- 字节验收线：零像素任务以 canon 等式/golden 验收（meirenzhi 气泡描边与徽章 golden 零改动即佐证）；视觉任务以 release-gate 截图 + 主人目测验收。
- `developers.md` 更新：皮肤配方引入装饰族调用；「实现耦合的已知边界」过期 `.gdEzaW_bubble` 注修正为当前哈希事实与单源指向。
- GLOSSARY 零改动（机制名属 ADR 范畴；先例 ADR-0011 Q9 / ADR-0014）。
- 本次不发版，随下一个自然 1.5.x 搭车。
- ADR-0011 Q3 递延项收账（其 Amendments 加注）。

## Amendments

- **2026-10-22（发版前）**：视觉窗口（Decision 5）的验收形态按主人裁定调整——截图 gate 豁免、活会话目测以独立评审的离线渲染冻结帧（三皮 × 明暗锚点态 6/6 帧逐像素零差 + 流式三冻结进度态实证）代偿接受，真机活会话目测移至发版升级后补课；decay 色不满意时单点调 palette 另发版。机制与色值裁定不变。
- **2026-10-21（立案同日）**：Decision 2 的「lib 计数钉……计数断言 6/6 原样保留」在单源收拢下静态字节不可达（UNION 以插值碎片存在于生成器函数体）——经主人裁定（B-1①），`tests/upstream-hooks.test.mjs` 的计数钉升级为**运行时求值**：import 三皮工厂（`tests/fake-react.mjs` 的 `jsx`），在 `project(出厂锚).staticCss` 里 split 计数（chat/goal 各 2 × 三皮 = 6/6）。「守卫验上游真值、lib 钉验接线真值」的分工不变，仅求值形态升级。

## 附录：grill 共识（Q1–Q16，2026-10-21 会话存档）

1. **Q1** `decoration.js` + `decorationCss(scope, palette)`；palette 仅明暗 RGB，alpha/几何为机制常量。
2. **Q2** `BUBBLE_HOOKS` 单源对象；守卫与 lib 钉测试直接 import；守卫=上游真值、lib 钉=接线真值。
3. **Q3** 族注释并集入生成器头注；canonical = minified 单行；meirenzhi 气泡 golden 零改动。
4. **Q4** decoration-family golden + 三皮等价断言 + 既有计数钉保留；零像素任务免截图 gate。
5. **Q5** 新立 ADR-0016 + ADR-0011 Amendments 一行收账。
6. **Q6** GLOSSARY 零改动。
7. **Q7** 随下一个自然 1.5.x 搭车；developers.md 过期 `.gdEzaW_bubble` 边界注一并修正。
8. **Q8**（经 Round 3 全量摸底扩展）入族资格 = 共享不变量 + 仅参数差异；B1 描边/B2 流式/B3 徽章/B4 root 清底/C1 常量表化入族；滚动条/placeholder/fireflies/Name/favicon/artLayer 出局。
9. **Q10** 流式光条全员呼吸版；meirenzhi 衰减鎏金 `rgba(217,180,92,0.20)`。
10. **Q11** 徽章 metrics 参数化保留现值（零像素）。
11. **Q12** root 清底三皮统一入族（防御一致，今日 no-op）。
12. **Q13** 常量 token 表化做；anchor 等式验收 + 既有契约测试重钉。
13. **Q14** 出局面确认，写入 Considered。
14. **Q15** ADR-0016 题定「皮肤装饰族收拢 + 声明表完成度」；任务序零像素先、视觉后带 gate，每 checkpoint 再生 lib。
15. **Q16** uefi 衰减色 = 暗色态品牌主色 @0.20 → `rgba(169,156,255,0.20)`。
