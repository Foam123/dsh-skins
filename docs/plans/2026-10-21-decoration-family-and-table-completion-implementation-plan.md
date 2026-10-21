# 皮肤装饰族收拢 + 声明表完成度实施计划（ADR-0016）

## 目标

- 三皮共享的装饰不变量收拢进 `src/client/skins/decoration.js` 单一模块：气泡描边（`decorationCss`）、流式呼吸光条（`streamingCss`）、反色片徽章（`badgeCss`）、防御性 root 清底（`rootClear`），色值/metrics 由各皮肤声明自持。
- 气泡钩子哈希（`Sixlwa_bubble`/`oRe1gG_bubble`）单源化为 `BUBBLE_HOOKS` 常量对象；守卫 `verify-upstream-hooks.mjs` 与 lib 钉测试 `upstream-hooks.test.mjs` 直接 import 消费——同步由 construction 保证，还 ADR-0011 Q3 递延债。
- ADR-0013 尾巴收口：openbmc/uefi 手写常量 token（含字体栈）迁 `table.constantTokens`，CSS 模板只剩 `ridingDecl` 插值行与真装饰段，对齐 meirenzhi 完全体。
- **像素红线**：Task 1–4 零像素变化（canon 等式验收）；Task 5（流式光条统一）为唯一视觉窗口，经主人活会话目测验收。
- 唯一行为新增：meirenzhi 获得流式呼吸光条（鎏金衰减）、uefi 静态光条升级呼吸——均为 ADR-0016 裁定的视觉变更窗口内容。

## 架构快照

- **decoration.js 接口（唯一权威定义）**：

```js
// src/client/skins/decoration.js — 皮肤装饰族机制（ADR-0016），与 frost-family.js
// 平级同 doctrine：机制住共享模块，色值/metrics/品牌资源由各皮肤自持。
export const BUBBLE_HOOKS = {
  chat: { exact: "Sixlwa_bubble", container: "userStack" },  // 气泡哈希漂移重推导的单点编辑处
  goal: { exact: "oRe1gG_bubble", container: "_stack" },
  bubbleLocal: "_bubble",
};
export function decorationCss(scope, palette)
  // palette = { light: "R, G, B", dark: "R, G, B" }（ADR-0012 tint 同形）
  // 产出 minified 单行 4 规则：user+goal × 明暗；并集选择器由 BUBBLE_HOOKS 拼装；
  // alpha 0.38/0.10 与投影几何 0 1px 4px / 0 1px 6px 为机制常量。
  // meirenzhi 现值（index.js:50-51/:55-56）即 canonical 字节——零改动 golden。
export function streamingCss(scope, palette)
  // palette = { decay: "R, G, B" }；静态骨架 var(--dsw-alias-brand-primary) +
  // 家族 keyframes（1.6s ease-in-out infinite alternate）+ prefers-reduced-motion 兜底。
  // 三皮衰减色：openbmc "62, 193, 232"（暗色品牌主色，现值）、
  // uefi "169, 156, 255"（Q16）、meirenzhi "217, 180, 92"（Q10 鎏金裁定）。
export function badgeCss(scope, className, colors, metrics)
  // 输出两条完整规则，镜像现行两皮结构：亮规则全量声明；暗规则仅 background/color 覆写。
  // className：openbmc ".dsh-openbmc-badge"、meirenzhi ".dsh-mrz-badge"（类名是皮肤自持，
  // JSX className 与选择器名不变，生成器接管完整规则体含选择器）。
  // colors = { light: {bg,fg}, dark: {bg,fg} }；metrics = { lineHeight, fontWeight }
  // 参数化保留各皮现值：openbmc {"14px",650}、meirenzhi {"16px",600}（Q7）。
  // 排版常量归机制：inline-flex / 4px 圆角 / padding 0 5px / 10px / 字距 .08em。
  // uefi 描边风徽章不入族、保持内联（ADR-0016 Decision 6）。
export function rootClear(scope)
  // `${scope} [id="root"]{background:0 0}`——防御性清底一行，上游 #root 现行
  // 无背景，三皮统一持有（ADR-0016 Q12）。
```

- **三皮接入点（收拢后各皮 CSS 只持 palette 字面量）**：

```js
// openbmc：{ light: "0, 131, 176", dark: "62, 193, 232" }
// uefi：  { light: "101, 83, 216", dark: "169, 156, 255" }
// meirenzhi：{ light: "184, 67, 63", dark: "229, 138, 128" }
// 徽章 colors：openbmc { light:{bg:"#14202B",fg:"#F7FAFC"}, dark:{bg:"#F7FAFC",fg:"#14202B"} }
//             meirenzhi { light:{bg:"#12121A",fg:"#FAF9F6"}, dark:{bg:"#FAF9F6",fg:"#12121A"} }
```

- **守卫同源消费**：`verify-upstream-hooks.mjs` 的 chat/goal exact-hash 检查（现 :139/:165）、结构前提 userStack（:153）与 `_bubble`/`_stack` 局部名、verdict 文案（:421-422）改由 `import { BUBBLE_HOOKS }` 派生；`BUBBLE_WHITELIST`（:185）改为 `new Set([BUBBLE_HOOKS.chat.exact, BUBBLE_HOOKS.goal.exact, "ROF66W_bubble"])`——`ROF66W_bubble` 是上游观测的第三 `_bubble` 家族（非皮肤钩子，属「上游真值」观测面），保留字面量并注释来源。:14 头注「keep in sync with the selectors in src/client/skins/*」改为「单一来源 decoration.js」。
- **lib 钉测试**（`tests/upstream-hooks.test.mjs`）：`UNION`/`GOAL_UNION`（:13-14）改 import 拼装。⚠ 计数断言的求值形态是**待主人决策项 B-1**（见全局约束），裁定前 Task 1 冻结。
- **C1 表化范围（机械规则）**：openbmc/uefi CSS 模板内**全部非 `ridingDecl` 插值的声明行**迁入各自 `table.constantTokens`（值为现行字面量逐字搬运），明文包含：brand/label/interactive/selector/tip/nav/bubble 系常量、`--dsw-font-family` 与 openbmc `--ds-font-family-code` 字体栈、openbmc 装饰段旁的 bubble 明色补块、openbmc 滚动条 `--dsh-scrollbar-thumb(-hover)` 两行（:315-316，值为 `var(--dsw-alias-scrollbar-*)` 引用——迁 openbmc 自表、单皮自持，不入 decoration 家族，R6 不破）。模板剩 `ridingDecl` 行 + 徽章/描边/流式/防御段。ridingDecl 行不动（ADR-0004 锚点字节不变式的载体）。
- **C1 验收等式**：`project({panelOpacity: <anchor>}).tokenOverrides` 每一项与被删静态行值逐项相等（golden 表钉进 `tests/translucency-contract.test.mjs`）；constantTokens 经 runtime 施加的通道已被 meirenzhi 生产验证。

## 全局约束

- **B-1（已裁定：①，2026-10-21 主人拍板；同日批准 main 分支直接开工）**：R2「计数断言 6/6」现行数的是 `lib/client.js` 静态字节（裁定前现值 UNION=6/GOAL_UNION=6，源于三皮模板手抄）；单源收拢后 UNION 字节只以插值碎片形态存在于 `decorationCss` 函数体，静态计数必为 0。裁定①：计数钉升级为**运行时求值**——`tests/upstream-hooks.test.mjs` import 三皮工厂（经 `tests/fake-react.mjs` 的 `jsx`），在 `project(anchor).staticCss` 里 split 计数（chat=2/goal=2 × 三皮，合计 6/6）——接线真值语义完整保真；G0-1 扩围生效，ADR-0016 Decision 2 已补 amendment。
- **G0 例外（允许修改的测试，逐条穷尽）**：
  1. `tests/upstream-hooks.test.mjs`：:13-14 钉串改 import 拼装；计数断言按 B-1 裁定①执行——运行时求值（import 三皮工厂 + `tests/fake-react.mjs`，`project(anchor).staticCss` split 计数），G0 扩围经主人 2026-10-21 裁定生效。
  2. `tests/translucency-contract.test.mjs`：**新增** C1 等式 golden（被删行清单 → tokenOverrides 断言）。既有断言面清点结论：该文件既有断言仅围绕 riding 插值行与 glass 规则（:159-168 只迭代 spec.riding；:280-301 只数 ridingDecl 插值），C1 不动 ridingDecl → **既有断言预计零条受影响**；`tests/runtime-effects.test.mjs` 不读 staticCss token 字面量，同预计零受影响。执行中如遇非空受影响断言 → 停下说明，G0 未预授权盲改。
  3. 新建 `tests/decoration-family.test.mjs`（golden + 等价断言）。
  4. `tests/personalization-projector.test.mjs`（**G0-3，2026-10-22 主人批准补录**）：:255/:312 两处「`--dsw-alias-bg-overlay` 不在 tokenOverrides」通道形状断言，按值级等值迁移——改为钉 constantTokens 值 + P=0/P=100 不变性（tgcf ruling #16 不变量更直接的载体；背景：C1 通道迁移后代理失效，该文件是评审 S-2 断言面清点漏列的第三消费者，执行期全门禁暴露后停下说明获批）。
  - 除上述外，现存测试期望值禁止修改——特别是 `tests/meirenzhi-skin.test.mjs` **零改动**（:56-57 气泡 golden 是 Task 1 验收判据；:49 徽章暗色 golden 受 Task 2 影响但输出逐字节不变、应原样通过）；`smoke-test.cjs` 已核查未钉任何徽章/流式/描边串，预期零改动。实现中需改未列测试 → 停下说明，不猜。
- **零像素红线（Task 1–4）**：除注释删除与 minified 排版归一外，(选择器, 声明) 对在「去注释 + 去空白」canon 下与收拢前恒等；openbmc/uefi 多行美化段 → 单行的列位差属排版差。
- 命名沿用 GLOSSARY：「描边装饰层」「气泡哈希漂移」；GLOSSARY 本身零改动、不发明新领域词（ADR-0016 Q6）。
- checkpoint 纪律：凡触碰 `src/` 的 checkpoint 一并提交重建后的 `lib/`（developers.md「发版」节第 6 条）。
- 构建类命令（esbuild spawn）在 danger-full-access 会话执行；`verify:hooks` 本地无 runtime 打印 `upstream-hooks: SKIPPED` 属正常降级（ADR-0011），CI strict 真跑。
- 版本与发版：本计划**不 bump 版本、不发版**，随下一个自然 1.5.x 搭车。
- 聚焦测试：`node --test tests/<file>`（直测 src，无需构建）——**例外**：`tests/upstream-hooks.test.mjs` 读 `lib/client.js`，凡涉它的验证必须 `pnpm run build` 前置；全量以 `pnpm run test` / `pnpm run check` 为准。
- grep 判据写法：零命中一律 `! grep -rn … <paths>`（grep 计 0 exit 1，禁入 `&&` 链；对目录必须 -r）；所有 grep 判据只圈三皮目录/`scripts/`/指定测试文件，**不含 `src/client/skins/decoration.js`**（它是唯一来源，自身豁免）。

## 输入工件

- 设计文档：`docs/adr/0016-skin-decoration-family-and-table-completion.md`（status: accepted，含 Q1–Q16 grill 共识附录）。
- 关联 ADR：0006（气泡并集挂接）、0011（Amendments 已收账 Q3）、0012（frost 家族先例与 canon 验收机器）、0013（声明表 doctrine）。
- 现状证据：三皮装饰段行段（openbmc 描边注释 :274 起/规则 :279-297、uefi `:134-156`、meirenzhi `:50-56`）、守卫哈希字面量分布（src+scripts 生产代码 26 处 + 测试 4 处 / 6 文件）、lib 静态计数现值 UNION=6/GOAL_UNION=6。

## 文件结构与职责

- Create: `src/client/skins/decoration.js` — 装饰族机制唯一来源：`BUBBLE_HOOKS` 常量对象 + `decorationCss`/`streamingCss`/`badgeCss`/`rootClear` 四生成器 + canonical 家族头注。
- Create: `tests/decoration-family.test.mjs` — 装饰族 golden（meirenzhi 字节即 canon）+ 三皮等价断言 + palette 注入断言。
- Modify: `src/client/skins/openbmc-harness/index.js` — 描边/徽章/root 清底/流式段改生成器调用；常量 token（含字体栈与滚动条两行）迁 `table.constantTokens`；CSS 模板只剩 `ridingDecl` 行与装饰段调用。
- Modify: `src/client/skins/uefi-harness/index.js` — 同上（徽章除外：描边风内联不动）。
- Modify: `src/client/skins/meirenzhi/index.js` — 描边四行并一行、徽章两行并一行、新增 rootClear 与流式调用（后者属视觉窗口）。
- Modify: `scripts/verify-upstream-hooks.mjs` — 哈希/结构/白名单/文案 import `BUBBLE_HOOKS` 派生（白名单保留 `ROF66W_bubble` 字面量）；头注改单一来源说明。
- Modify: `tests/upstream-hooks.test.mjs` — `UNION`/`GOAL_UNION` 改 import 拼装；计数断言按 B-1 裁定执行。
- Modify: `tests/translucency-contract.test.mjs` — 新增 openbmc/uefi C1 等式 golden（既有断言预计零改动）。
- Modify: `docs/developers.md` — 配方增装饰族段；`.gdEzaW_bubble` 过期边界注修正。
- Test: 上述测试文件；`tests/meirenzhi-skin.test.mjs`、`tests/runtime-effects.test.mjs` 与 `smoke-test.cjs` 为**不变区**（零改动判据）。
- 边界稳定：`runtime.js`、`translucency.js`、`frost-family.js`、`catalog.js`、host 侧全部不动。

## 任务清单

### Task 0: 立案 checkpoint（先于一切实现）

- [ ] Step 1: 提交工作区现存立案工件（ADR-0016、本计划、ADR-0011 Amendments 加注），checkpoint：`docs(adr+plan): ADR-0016 装饰族收拢+声明表完成度 + 实施计划（grill 共识 Q1–Q16）`。
- Run: `git -C <repo> status --short` → Expected: 上述三文件外无游移改动；commit 后工作区净。

### Task 1: decoration.js 建立 + 气泡描边收拢 + 守卫同源（零像素）｜B-1 已裁定①（2026-10-21）

- 涉及文件：`src/client/skins/decoration.js`（Create）、三皮 `index.js`、`scripts/verify-upstream-hooks.mjs`、`tests/upstream-hooks.test.mjs`、`tests/decoration-family.test.mjs`（Create）。
- 接口契约：
  - Consumes: ADR-0016 接口定义（架构快照 code block）；三皮现行描边段字面量；B-1 裁定①（计数钉运行时求值）。
  - Produces: `decoration.js` 导出 `BUBBLE_HOOKS` 与 `decorationCss(scope, palette)`；守卫与钉测试同源形态。
- 验证范围：模块独立可测 + meirenzhi golden 零改动通过 + 新 lib 上守卫/钉测试行为符合 B-1 裁定。

- [ ] Step 1: 建 `src/client/skins/decoration.js`：`BUBBLE_HOOKS` + `decorationCss`（canonical 头注取三皮注释并集：ADR-0006 双支兜底原理、goal v1.0.4 扩入裁决、结构分支不命中 goal 的说明、哈希重推导单点在此）。
- [ ] Step 2: 新建 `tests/decoration-family.test.mjs`：① `decorationCss("body[data-dsh-meirenzhi-skin]", { light: "184, 67, 63", dark: "229, 138, 128" })` 输出含且仅含与 `meirenzhi/index.js:50-51/:55-56` 逐字节相同的 4 条规则；② 同 palette 换 scope，输出仅 scope 子串不同；③ palette RGB 注入生效。
- Run: `node --test tests/decoration-family.test.mjs`
- Expected: 绿（模块独立可测；若红，修模块不修测试）。
- [ ] Step 3: 三皮接线：openbmc 描边段（注释 :274 起/规则 :279-297）→ `${decorationCss(SCOPE, …)}`；uefi `:134-156` 同；meirenzhi CSS 数组 :50-56 四行 → 一行调用；删各皮注释抄本（指向生成器头注）。
- [ ] Step 4: 守卫切换：`verify-upstream-hooks.mjs` import `BUBBLE_HOOKS`，:139/:153/:165/:185（含 ROF66W 保留）/:421-422 全部派生，:14 头注改「单一来源 decoration.js」；`upstream-hooks.test.mjs` 按 B-1 裁定改造（①：钉串 import 拼装 + 计数升运行时求值，经 `tests/fake-react.mjs` 取三皮 `project(anchor).staticCss` split 计数 ==6/==6）。
- [ ] Step 5: 验证（build 前置——upstream-hooks.test 读 lib）。
- Run: `pnpm run build && node --test tests/decoration-family.test.mjs tests/meirenzhi-skin.test.mjs tests/upstream-hooks.test.mjs tests/overlay-frost.test.mjs && node smoke-test.cjs`
- Expected: 全绿；`tests/meirenzhi-skin.test.mjs` 全程零改动；判据 `! grep -rn "Sixlwa\|oRe1gG" src/client/skins/openbmc-harness src/client/skins/uefi-harness src/client/skins/meirenzhi scripts tests/upstream-hooks.test.mjs` 成立。
- [ ] Step 6: checkpoint：`refactor(skins): decorationCss 装饰族收拢 + BUBBLE_HOOKS 守卫同源（ADR-0016）`（含 lib）。

### Task 2: rootClear + badgeCss 收拢（零像素）

- 涉及文件：`decoration.js`、openbmc/uefi/meirenzhi `index.js`、`tests/decoration-family.test.mjs`。
- 接口契约：
  - Consumes: Task 1 的 `decoration.js` 模块位与 canonical 风格；openbmc 徽章 CSS 双行（亮 :255-260、暗 :261-263）与 meirenzhi `:44-45`；openbmc `:313`、uefi `:129` root 清底行。
  - Produces: `rootClear(scope)`、`badgeCss(scope, className, colors, metrics)` 导出；`.dsh-openbmc-badge`/`.dsh-mrz-badge` 类名与 JSX className 不变（生成器接管完整规则体含选择器）。
- 验证范围：meirenzhi 徽章 golden（:44-45 与测试 :49 暗行）零改动；openbmc 徽章 canon 等值；root 清底三皮唯一来源。

- [ ] Step 1: `decoration.js` 增 `rootClear(scope)` 与 `badgeCss(scope, className, colors, metrics)`（接口见架构快照）。
- [ ] Step 2: 三皮接入 rootClear：openbmc `:313`、uefi `:129` 现行行替换（uefi `background: transparent` → `background:0 0` 属排版归一、语义等值）；meirenzhi 新增调用（今日 no-op 防御）。
- [ ] Step 3: 徽章接入：openbmc ④b CSS 双行 → `badgeCss(SCOPE, ".dsh-openbmc-badge", …, { lineHeight: "14px", fontWeight: 650 })`；meirenzhi `:44-45` 双行 → 一行调用（className `.dsh-mrz-badge`，metrics `{"16px", 600}`）；uefi 不动。
- [ ] Step 4: `tests/decoration-family.test.mjs` 增断言：meirenzhi badgeCss 输出与 `:44-45` 现行两条逐字节相同（含暗行 `background:#FAF9F6;color:#12121A`，即 meirenzhi-skin.test :49 golden 原样通过）；openbmc badgeCss 输出在 canon（去空白）下与 ④b 现行声明对恒等；三皮 `rootClear` 输出仅 scope 异。
- Run: `pnpm run build && node --test tests/decoration-family.test.mjs tests/meirenzhi-skin.test.mjs tests/overlay-frost.test.mjs && node smoke-test.cjs`
- Expected: 全绿；判据 `! grep -rn 'id="root"' src/client/skins/openbmc-harness src/client/skins/uefi-harness src/client/skins/meirenzhi` 成立。
- [ ] Step 5: checkpoint：`refactor(skins): rootClear + badgeCss 家族收拢（ADR-0016）`（含 lib）。

### Task 3: 常量 token 表化 · openbmc（零计算值变化）

- 涉及文件：`src/client/skins/openbmc-harness/index.js`、`tests/translucency-contract.test.mjs`。
- 接口契约：
  - Consumes: openbmc CSS 模板现行非 ridingDecl 声明行全集（③ 明暗双块常量 + ④ 字体栈 `--dsw-font-family`/`--ds-font-family-code` + ⑥ bubble 明色补块 + ⑦ 滚动条 `--dsh-scrollbar-thumb(-hover)` 两行）；`table.constantTokens` 字段（meirenzhi `:102-118` 为形状先例）。
  - Produces: openbmc `table.constantTokens` 完整对象（Task 4 的 uefi 迁移同构参照）；`tests/translucency-contract.test.mjs` 内 C1 等式 golden 模式（被删行清单 → tokenOverrides 断言）。
- 验证范围：等式测试先红后绿；模板区字面量 token 声明行清零（含 `--dsw-`/`--ds-`/`--dsh-` 全前缀族）。

- [ ] Step 1: 在 `tests/translucency-contract.test.mjs` 增 openbmc C1 等式测试：以「被删行清单」golden 表（token 名 → 明暗值，含字体栈与滚动条两行）断言 `project(<anchor 55 的 values>).tokenOverrides` 逐项相等（values 形状沿用该文件既有调用）。
- Run: `node --test tests/translucency-contract.test.mjs`
- Expected: 红——openbmc `constantTokens` 现为 `null`（:1756 亲证），tokenOverrides 缺这些键。
- [ ] Step 2: 迁移：openbmc CSS 模板内全部非 `ridingDecl` 插值声明行（范围见 Consumes）逐字搬入 `table.constantTokens`（`constantTokens: null` → 对象）；删对应行与空块。
- [ ] Step 3: 复跑等式测试至绿；`tests/runtime-effects.test.mjs` 断言面清点结论为零受影响（G0-2）——如遇受影响断言，停下说明。
- Run: `pnpm run build && node --test tests/translucency-contract.test.mjs tests/runtime-effects.test.mjs tests/decoration-family.test.mjs tests/meirenzhi-skin.test.mjs && node smoke-test.cjs`
- Expected: 全绿；判据 `! grep -En '^\s*--[a-z0-9-]+: ' src/client/skins/openbmc-harness/index.js` 成立（模板内任何前缀的字面量 token 声明行清零；表内键为带引号 `"--x":` 形态、ridingDecl 为插值调用，均不误命中）。
- [ ] Step 4: checkpoint：`refactor(skins): openbmc 常量 token 迁声明表（ADR-0016 C1）`（含 lib）。

### Task 4: 常量 token 表化 · uefi（零计算值变化）

- 涉及文件：`src/client/skins/uefi-harness/index.js`、`tests/translucency-contract.test.mjs`。
- 接口契约：
  - Consumes: uefi CSS 模板现行非 ridingDecl 声明行全集（`:83-128` 亮暗双块常量 + `:102` `--dsw-font-family` 字体行；uefi 无 `--ds-`/`--dsh-` 行，已亲证）；Task 3 产出的 C1 等式 golden 模式（token 名 → 明暗值 → tokenOverrides 断言）。
  - Produces: uefi `table.constantTokens` 完整对象；两皮表化完成后 ADR-0013「模板持排版、表持值」在三皮全部达成。
- 验证范围：同 Task 3 形状，uefi 独立成立。

- [ ] Step 1: 在 `tests/translucency-contract.test.mjs` 增 uefi C1 等式测试（被删行清单 golden，anchor 55）。
- Run: `node --test tests/translucency-contract.test.mjs`
- Expected: 红——uefi `constantTokens` 现为 `null`（:1118 亲证）。
- [ ] Step 2: 迁移：uefi `:83-128` 亮暗双块常量与字体行逐字搬入 `table.constantTokens`；删对应行与空块。
- [ ] Step 3: 复跑至绿；`tests/runtime-effects.test.mjs` 同 Task 3 Step 3 口径。
- Run: `pnpm run build && node --test tests/translucency-contract.test.mjs tests/runtime-effects.test.mjs tests/decoration-family.test.mjs tests/meirenzhi-skin.test.mjs && node smoke-test.cjs`
- Expected: 全绿；判据 `! grep -En '^\s*--[a-z0-9-]+: ' src/client/skins/uefi-harness/index.js` 成立。
- [ ] Step 4: checkpoint：`refactor(skins): uefi-harness 常量 token 迁声明表（ADR-0016 C1）`（含 lib）。

### Task 5: streamingCss 流式光条统一（视觉任务）

- 涉及文件：`decoration.js`、三皮 `index.js`、`tests/decoration-family.test.mjs`。
- 接口契约：
  - Consumes: openbmc `:298-311` 现行流式段（呼吸语义 canonical：静态骨架 + pulse keyframes + reduced-motion 兜底）；三皮衰减色裁定（架构快照 streamingCss 注释）。
  - Produces: `streamingCss(scope, { decay })` 导出；三皮流式段唯一来源。
- 验证范围：golden 断言 + 冻结测试即时仍绿 + 主人活会话目测（本计划唯一像素变更窗口）。

- [ ] Step 1: `decoration.js` 增 `streamingCss(scope, palette)`。
- [ ] Step 2: 三皮接入：openbmc `:298-311` 替换（keyframes `obmc-stream-pulse` → 家族名，像素不变）；uefi `:130-133` 静态升级呼吸；meirenzhi 新增调用（decay `"217, 180, 92"`）。
- [ ] Step 3: `tests/decoration-family.test.mjs` 增 streamingCss 断言：家族 keyframes 名在场、decay 注入生效、`prefers-reduced-motion` 兜底行在场、三皮输出仅 scope 与 decay 异。
- Run: `pnpm run build && node --test tests/decoration-family.test.mjs tests/meirenzhi-skin.test.mjs && node smoke-test.cjs`
- Expected: 全绿（meirenzhi 新增流式后冻结测试即时仍绿，勿等 Task 6 兜底）；判据 `! grep -rn 'data-streaming' src/client/skins/openbmc-harness src/client/skins/uefi-harness src/client/skins/meirenzhi` 成立。
- [ ] Step 4: 主人目测（验收口径）：静态预览截图覆盖不了流式态，须活会话目测——web 机开新会话触发流式，逐皮核对：① meirenzhi 鎏金光条与衰减观感；② uefi 呼吸节奏与衰减色 `rgba(169, 156, 255, 0.20)`；③ openbmc 流式态与改前不回归。辅助回归：`node scripts/capture-previews.mjs --gate`（静态面，写入 `.artifacts/release-gates/v<当前版本>/`，gitignored）。
- [ ] Step 5: checkpoint：`feat(skins): 流式呼吸光条三皮统一（ADR-0016 视觉窗口）`（含 lib）。

### Task 6: 文档收编 + 全门禁收尾

- 涉及文件：`docs/developers.md`。
- 接口契约：
  - Consumes: Task 1–5 全部产出（decoration.js 五成员、三皮收拢形态、C1 表化完成）。
  - Produces: developers.md 装饰族配方段 + 修正后的边界注；全门禁绿作为计划完成信号。
- 验证范围：`pnpm run check` 全绿 + 收尾判据。

- [ ] Step 1: `developers.md`：①「自建一套皮肤」配方增装饰族段（decoration.js 各生成器一行调用 + palette 表）；②「实现耦合的已知边界」`.gdEzaW_bubble` 过期注修正为当前哈希 `Sixlwa_bubble` 事实 + 单源指向 decoration.js。
- [ ] Step 2: 全门禁 `pnpm run check`（构建 + lint + 测试 + README 配对 + bundle 守卫 + 上游钩子守卫 + lib-sync 零差异）。注意 bundle 守卫只有**上限**（`BASELINE_CLIENT_BYTES + base64 + SLACK`，exceeds 才报；C1 为同文件搬移、bundle 字节近似持平）——若超上限按守卫脚本自身的 bump 规程处理（G0 外围，执行时如遇先停下说明）。
- [ ] Step 3: 收尾判据：`! grep -rn "Sixlwa\|oRe1gG\|userStack" src/client/skins/openbmc-harness src/client/skins/uefi-harness src/client/skins/meirenzhi scripts` 全零（唯一来源 decoration.js；测试 golden 字节豁免）；ADR-0011 Amendments 已在 Task 0 提交，无需再动。
- [ ] Step 4: checkpoint：`docs(dev): developers.md 装饰族配方 + 边界注修正（ADR-0016 收尾）`（纯文档，无需构建）。

## 执行纪律

- 开始实现前，先批判性复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- 按任务顺序执行（Task 0–6），不无声跳步、不合并步、不改变任务目标；每完成一个任务运行其定义的验证，绿了才进下一任务。
- 遇阻塞、重复失败或计划与仓库现实不符，立即停下说明，不猜。
- main 分支直接开发已经主人批准（2026-10-21，随 B-1 裁定）。
- 凡触碰 `src/` 的 checkpoint 一并提交重建后的 `lib/`。
- 全部任务完成后运行最终验证并输出修改摘要。

## 最终验证

- Run: `pnpm run check`
- Expected: 全绿——构建、ESLint、全部单测（含零改动的 `meirenzhi-skin.test.mjs`、`runtime-effects.test.mjs` 与 `smoke-test.cjs`）、README 配对、bundle 守卫、上游钩子守卫（本地 SKIPPED 属正常降级）、lib-sync 零差异。
- 附加收尾判据（Task 6 Step 3 的三条 grep）全零命中。
- 输出：修改摘要（7 个 checkpoint 清单 + 三皮文件前后行数对比 + src/scripts 生产代码哈希字面量 26 处 → 1 处的收敛确认；测试 golden 字节豁免）。

## 审阅 Checkpoint

- 计划正文结束。请先审阅本计划与 ADR-0016；未获批准不进入实现。
