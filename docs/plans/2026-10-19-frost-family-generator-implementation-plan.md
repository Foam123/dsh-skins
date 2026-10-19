# 浮层毛玻璃家族共享生成器 实施计划

## 目标

- 把三套皮肤各自手抄的浮层毛玻璃家族 CSS（冻层五节 ⑧~⑧e + 菜单三件套，合计 ~420 行）收拢为 `src/client/skins/frost-family.js` 单一 module：单函数、tint-only 参数，规则字节不变（分层验收，见全局约束）。
- 交付两笔 commit：① 重构（生成器 + 三皮接入 + 测试四表合一 + ADR-0012 新建 + ADR-0007 注记 + `developers.md` 自持条款补句 + GLOSSARY 已先行入册）；② `developers.md` 陈旧配方修复（`project()` 形状、删「内置适配器」幻觉）。
- 不 bump 版本、不单独发版（搭下次 release）。

## 架构快照

- 生成器 `frostFamilyCss(scope, tints)`：`tints = { frost: { light, dark }, menu: { light, dark } }`，四个值为带空格的 `"R, G, B"` 字符串（逐字抄自各皮现行规则）；输出为**一个字符串**：菜单三件套（明/暗）在前，随后冻层 ⑧→⑧b→⑧c→⑧d→⑧e 全段；注释收敛为一段 canonical 家族注释（含 ADR-0007/0012 指针）；输出风格 = openbmc 空格风格（`blur(10px)`、`rgb(247, 250, 252)` 逗号后带空格、`}` 前有 `;`）——恰好满足 `smoke-test.cjs:397-398` 的带空格字节钉死。
- 三皮接入：openbmc/uefi 在 CSS 模板串内以**单点插值**替换冻层段，并从 token 块中**外科摘除**三行菜单声明（菜单规则迁入家族段 = meirenzhi 今天已在生产验证的顺序）；meirenzhi 把数组中连续的菜单+冻层 run 换成一个元素。级联中立由验收工具的「menu token 计数恒为 2」验证（同名 custom property 无第二次声明）。
- 生成器只含浮层毛玻璃家族；**不含**气泡哈希漂移守卫、徽章样式、通透度机制（玻璃三件套/铰链公式）——共识 Q2 明确挡在 seam 外，本次不碰。
- 验收工具 `canon.mjs` 放在仓库外（workspace `.dsh-research/frost-refactor/`，gitignored、跨 bash 调用持久；`/tmp` 会被清空不可用）：剥注释 → 顶层规则切分（嵌套块整体保留）→ 声明级 `(selector, declaration)` 对多重集比较，`--capture` 存基线、`--verify <skinId>` 比对。

## 全局约束

- **字节验收（逐字继承共识 Q13）**：openbmc/uefi 家族**规则字节逐字不变**（含空格风格）；meirenzhi 家族段仅排版归一（补空格、补尾 `;`，规则内容零变化）；三皮在「去注释 + 去空白 + `;}`→`}`」canon 下规则集与今天恒等（13 条/皮）；三份注释抄本归一为生成器内一份（已证无任何测试钉注释字节）。
- `smoke-test.cjs`、既有测试断言的种类与数量**零改动**；`tests/overlay-frost.test.mjs` 仅做「四张按皮 tint 表合一」，断言表达式不动；`tests/meirenzhi-skin.test.mjs`、`tests/personalization-projector.test.mjs`、`tests/runtime-effects.test.mjs` 一行不改。
- 参数形状固定为 `{frost:{light,dark}, menu:{light,dark}}`——不把「menu 暗色恰好等于冻层暗色」（仅 meirenzhi 如此）的巧合焊进 interface。
- 命名：模块文件 `frost-family.js`、导出 `frostFamilyCss`、域术语「浮层毛玻璃家族」（GLOSSARY.md 已入册）。
- 分支：`main` 直接提交（仓库惯例，GLOSSARY.md 当前已有未提交改动，随 commit 1 一起提交）。
- 环境命令前提：构建类命令（esbuild 会 spawn 子进程）在本机 danger-full-access 会话下执行；`pnpm run check` 的 upstream-hooks 段需 `DSH_RUNTIME_ROOT="$HOME/.local/share/dsh-runtime"`，否则该段打印 `upstream-hooks: SKIPPED` 不算真跑；`verify:hooks` 本地全量扫描可能远超 90 秒（评审实跑 60 秒窗口无输出），届时按后台纪律起跑、经 job_output 收结论，久无结论则记录覆盖度并以 CI（ADR-0011）为强制点；其余单条命令预计超 90 秒时同样转后台。

## 输入工件

- 设计共识：本会话 grilling Q1–Q14 与最终共识清单（ADR-0012 将在 Task 7 把它落为正式记录）
- `docs/adr/0007-overlay-frost-union.md`（家族裁决与五次修订史；Amendments 追加点）
- `docs/adr/0004-legacy-skin-personalization.md`（标准字段集前瞻条款，Task 9 引用）
- `GLOSSARY.md`「浮层毛玻璃家族」词条（已存在）
- 事实锚点（行号为当前辅助定位，**以符号/内容锚为准**）：
  - openbmc 冻层段 L309-432（模板串 L142-432 内），菜单声明 L169-173（明，与 `--dsw-specific-input-major`/`--dsw-specific-login-input` 穿插）/ L208-212（暗）
  - uefi 冻层段 L144-266（模板串 L56-266 内），菜单声明 L72-75 / L101-104
  - meirenzhi 菜单+冻层连续 run L60-114（数组 `CSS` L32-115 内，`SCOPE` 常量 L26）
  - `tests/overlay-frost.test.mjs` 四张 tint 表 ≈L73-77（darkAnchors）/ ≈L92-96（darkTints）/ ≈L141-145（tip）/ ≈L173-177（menu），jsx stub L16
  - `scripts/verify-upstream-hooks.mjs` 头注记 L14

## 文件结构与职责

- Create: `src/client/skins/frost-family.js` —— 家族 CSS 的唯一实现（生成器）
- Create: `docs/adr/0012-frost-family-shared-generator.md` —— 本次架构决定
- Create（仓库外，不提交）: `/home/ubuntu/workspace/.dsh-research/frost-refactor/canon.mjs` 与 `baseline-*.json`
- Modify: `src/client/skins/openbmc-harness/index.js`、`src/client/skins/uefi-harness/index.js`、`src/client/skins/meirenzhi/index.js` —— 删手抄家族段，换一行调用 + 每皮 `TINTS` 常量
- Modify: `tests/overlay-frost.test.mjs` —— 仅四表合一
- Modify: `scripts/verify-upstream-hooks.mjs` —— 仅头注记同步指向一行注释
- Modify: `docs/adr/0007-overlay-frost-union.md` —— Amendments 追加一行
- Modify: `docs/developers.md` —— 自持条款补一句（Task 7）；「自建一套皮肤」配方段重写（Task 9，独立 commit）
- Modify: `GLOSSARY.md` —— 已改完（新增「皮肤表面 / 浮层毛玻璃家族」），随 commit 1 提交
- 边界不变：`runtime.js`、`projector.js`、`catalog.js`、`smoke-test.cjs`、其余全部测试文件一行不改。

## 任务清单

### Task 1: 基线捕获与 canon 验收工具

- 目标：为「规则字节不变」提供机械验收：改动前把三皮建成 CSS 的声明级快照存为基线，改动后逐皮比对。
- Files: Create `/home/ubuntu/workspace/.dsh-research/frost-refactor/canon.mjs`（仓库外）
- 接口契约
  - Consumes: `tests/overlay-frost.test.mjs:12-21` 的 jsx stub 与工厂调用形状（统一 `{ jsx }` 传参，与测试文件 L18-19 一致；三工厂均以解构取 jsx——openbmc/meirenzhi 为函数体首行 `const { jsx } = jsxRuntime;`，uefi 为签名参数解构）
  - Produces: 命令 `node canon.mjs --capture`（在 `.dsh-research/frost-refactor/` 下运行，写 `baseline-<skinId>.json`）与 `node canon.mjs --verify <openbmc|uefi-harness|meirenzhi>`（exit 0 = 通过）
- 验证范围：capture 打印三皮快照统计且基线文件落盘；未改动时 verify 全 PASS。

- [ ] Step 1: 写工具（真实代码如下，逐字可用）

```js
// canon.mjs — 浮层家族重构的逐字节验收工具（仓库外，不提交）
// 用法: node canon.mjs --capture | node canon.mjs --verify <openbmc|uefi-harness|meirenzhi>
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenBmcHarness } from "/home/ubuntu/workspace/dsh-skins/src/client/skins/openbmc-harness/index.js";
import { createUefiHarness } from "/home/ubuntu/workspace/dsh-skins/src/client/skins/uefi-harness/index.js";
import { createMeirenzhiSkin } from "/home/ubuntu/workspace/dsh-skins/src/client/skins/meirenzhi/index.js";

// jsx stub：与 tests/overlay-frost.test.mjs L16 同型（仅服务 Mark/Name，不触 CSS）
const jsx = () => null;
const cssOf = {
  openbmc: () => createOpenBmcHarness({ jsx }).css,
  "uefi-harness": () => createUefiHarness({ jsx }).css,
  meirenzhi: () => createMeirenzhiSkin({ jsx }).css,
};

function topLevelRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, ""); // 剥注释
  const rules = [];
  let depth = 0, start = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}" && --depth === 0) { rules.push(src.slice(start, i + 1)); start = i + 1; }
  }
  return rules;
}

// 声明级 canon：每条 (selector, declaration) 对；嵌套块（@media/@keyframes）整体成对
function pairs(css, squash) {
  const out = [];
  for (const rule of topLevelRules(css)) {
    const at = rule.indexOf("{");
    const selector = rule.slice(0, at).trim().replace(/\s+/g, " ");
    const body = rule.slice(at + 1, -1);
    if (body.includes("{")) { out.push(`${selector}|${squash ? body.replace(/\s+/g, "") : body}`); continue; }
    for (const decl of body.split(";")) {
      const d = decl.trim();
      if (d !== "") out.push(`${selector}|${squash ? d.replace(/\s+/g, "") : d}`);
    }
  }
  return out.sort();
}

const MENU_TOKENS = ["--dsw-menu-surface-fill", "--dsw-alias-menu-group-header-fill", "--dsw-specific-menu"];
const snapshot = (css) => ({
  literal: pairs(css, false),
  squash: pairs(css, true),
  menuCounts: Object.fromEntries(MENU_TOKENS.map((t) => [t, css.split(t).length - 1])),
});

const [mode, skin] = process.argv.slice(2);
if (mode === "--capture") {
  for (const id of Object.keys(cssOf)) {
    const snap = snapshot(cssOf[id]());
    writeFileSync(new URL(`./baseline-${id}.json`, import.meta.url), JSON.stringify(snap));
    console.log(`${id}: ${snap.squash.length} canon pairs, menu ${JSON.stringify(snap.menuCounts)}`);
  }
} else if (mode === "--verify") {
  const base = JSON.parse(readFileSync(new URL(`./baseline-${skin}.json`, import.meta.url)));
  const cur = snapshot(cssOf[skin]());
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // squash 比较前对两侧做同一种全去空白规范化。动机：本文件 Task 1 原版
  // pairs() 对 selector 只折叠空白、未全剥除——meirenzhi 原手抄 selector 逗号
  // 后无空格、生成器输出为 ",\n"（折叠后 ", "），纯排版差会被误判为内容差
  //（实测 28 行差异全部仅此区别，复现工具 verify-planvariant.mjs）。计划全局
  // 约束定义的 squash canon 是「去注释 + 去空白」，sq 使实现与该定义一致；
  // 基线本身无瑕（评审已用 git archive 重算逐字节核证）。对称幂等：
  // openbmc/uefi 仍由 literal 通道逐字钉住，sq 不放松其严格门。
  const sq = (pairs) => pairs.map((p) => p.replace(/\s+/g, ""));
  const squashPass = eq(sq(base.squash), sq(cur.squash));
  const menuPass = eq(base.menuCounts, cur.menuCounts) && Object.values(cur.menuCounts).every((n) => n === 2);
  // meirenzhi 允许排版归一 → literal 仅参考；openbmc/uefi 必须逐字
  const literalPass = eq(base.literal, cur.literal);
  const strict = skin !== "meirenzhi";
  const pass = squashPass && menuPass && (!strict || literalPass);
  console.log(`${skin}: squash=${squashPass ? "PASS" : "FAIL"} menu=${menuPass ? "PASS" : "FAIL"} literal=${literalPass ? "PASS" : "FAIL"}${strict ? "" : " (参考)"}`);
  process.exit(pass ? 0 : 1);
} else {
  console.error("usage: canon.mjs --capture | --verify <skinId>");
  process.exit(2);
}
```

- [ ] Step 2: 运行 capture
  - Run: `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --capture`
  - Expected: 三行统计（每皮 canon pairs 数、三个 menu token 计数均为 2），生成 `baseline-openbmc.json`、`baseline-uefi-harness.json`、`baseline-meirenzhi.json`
- [ ] Step 3: 未改动自证
  - Run: `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify openbmc && node canon.mjs --verify uefi-harness && node canon.mjs --verify meirenzhi`
  - Expected: 三皮 `squash=PASS menu=PASS literal=PASS`，exit 0

### Task 2: 新建 frost-family.js 生成器

- 目标：以 openbmc 现行冻层段为底稿逐字移植出单函数生成器，参数只进 scope 与 tint。
- Files: Create `src/client/skins/frost-family.js`
- 接口契约
  - Consumes: openbmc `index.js` 冻层段（L309-432）与菜单声明三行（L169-173 明 / L208-212 暗）的**现行文本**（唯一底稿）
  - Produces: `export function frostFamilyCss(scope, tints)`；`tints = { frost: { light: "R, G, B", dark: "R, G, B" }, menu: { light: "R, G, B", dark: "R, G, B" } }`；返回一个字符串（菜单明/暗 + ⑧ + ⑧b + ⑧c + ⑧d + ⑧e）。Task 3-5 消费此签名。
- 验证范围：独立 node 冒烟（不接线皮肤）断言输出形状。

- [ ] Step 1: 当前缺失检查
  - Run: `cd /home/ubuntu/workspace/dsh-skins && node --input-type=module -e "import { frostFamilyCss } from './src/client/skins/frost-family.js'; console.log(typeof frostFamilyCss)"`
  - Expected: `ERR_MODULE_NOT_FOUND`（模块尚不存在）
- [ ] Step 2: 确认失败信号（同上，失败即证缺失）
- [ ] Step 3: 写实现（移植法，不重写）
  - 把 openbmc 冻层段 L309-432 原文拷入函数模板串；把其中所有 `body[data-dsh-openbmc-skin]` 字面量替换为 `${scope}`；冻层段内共 **8 处** tint 三元组——⑧ v1 明（≈L325）/暗（≈L334）、⑧b 明（≈L365）/暗（≈L374）、⑧c 明（≈L391）/暗（≈L399）、⑧e 明（≈L426）/暗（≈L431）——全部替换为 `${tints.frost.light}` / `${tints.frost.dark}`（⑧e 的 96% tip 与家族共用同一组 frost tint，三皮皆然，已逐皮核证：openbmc 247,250,252/12,26,38、uefi 248,247,255/23,18,45、meirenzhi 250,249,246/18,18,26）。
  - 在冻层段之前拼入菜单三件套两规则：selector 分别为 `${scope}` 与 `${scope}[data-ds-dark-theme]`，声明 = 三个 menu token 的 `rgba(<tint>, 0.94)`（明 = `rgba(242, 247, 251, 0.94)`、暗 = `rgba(14, 33, 48, 0.94)`，逐字照抄 openbmc 现行三行的格式与顺序；底稿值已核证）。
  - 段序：菜单明 → 菜单暗 → ⑧ → ⑧b → ⑧c → ⑧d → ⑧e；各节间保留一个空行。
  - 注释：三皮的分散注释收敛为**一段**家族注释（内容 = ⑧ 头注释的 canonical 版 + 「配方与裁决见 ADR-0007；单点生成见 ADR-0012」），段内不再保留分节小注。
  - 文件头加一句话 JSDoc：tints 形状与「输出为各皮家族段唯一来源」。
- [ ] Step 4: 冒烟验证（真实命令；menu 暗色故意用合成值 `1, 2, 3`，防止被误抄进 Task 3 的真实 TINTS——openbmc 真实 menu 暗色 ≠ 冻层暗色，须逐字抄现行文件）
  - Run: `node --input-type=module -e "import { frostFamilyCss } from './src/client/skins/frost-family.js'; const css = frostFamilyCss('body[data-dsh-openbmc-skin]', { frost: { light: '247, 250, 252', dark: '12, 26, 38' }, menu: { light: '247, 250, 252', dark: '1, 2, 3' } }); const count = (s) => css.split(s).length - 1; console.log(JSON.stringify({ notLightbox: count(':not(.dsvm-lightbox)'), menuFillDecls: count('--dsw-menu-surface-fill:'), topRules: (css.match(/(?:^|\})\s*[^\s@{][^{]*\{/g) || []).length, hasSpacedRecipe: css.includes('color-mix(in srgb, rgb(247, 250, 252) 86%, transparent)'), hasMaskBlur: css.includes('--dsw-mask-blur: blur(10px)') }));"`
  - Expected: `notLightbox: 2`（明/暗两支）；`menuFillDecls: 2`（明/暗两条声明各一次）；`hasSpacedRecipe: true`；`hasMaskBlur: true`；`topRules: 13`（事实核查的每皮顶层家族规则数；若与底稿实际计数有出入，以「openbmc 底稿冻层段 + 菜单行的顶层规则总数」为准并在 Task 3 的 canon 验收中核实）

### Task 3: openbmc 接入（单点插值 + 外科摘除菜单声明）

- 目标：openbmc 的家族段全部来自生成器，规则字节不变。
- Files: Modify `src/client/skins/openbmc-harness/index.js`
- 接口契约
  - Consumes: `frostFamilyCss`（Task 2）；`canon.mjs --verify openbmc`（Task 1）
  - Produces: openbmc CSS 常量含一行 `${frostFamilyCss("body[data-dsh-openbmc-skin]", TINTS)}`；`TINTS` 常量（frost `"247, 250, 252"` / `"12, 26, 38"`；menu `"242, 247, 251"` / `"14, 33, 48"`——menu 明/暗**均异于 frost**，值为已核证的现行 L169-173 / L208-212 读数，执行时仍须逐字复核）
- 验证范围：canon 三项 PASS + `pnpm test` 全绿。

- [ ] Step 1: 前置状态检查
  - Run: `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify openbmc && cd /home/ubuntu/workspace/dsh-skins && pnpm test`
  - Expected: verify 三项 PASS；测试全绿（确认起点干净）
- [ ] Step 2: 改文件
  - 在 `const CSS = \`...\`` 上方定义 `const TINTS = { frost: { light: "247, 250, 252", dark: "12, 26, 38" }, menu: { light: "242, 247, 251", dark: "14, 33, 48" } };`（menu 值与 L169-173 / L208-212 现行声明逐字一致，写入前复核）
  - 删除冻层段 L309-432（含 ⑧~⑧e 注释与规则、闭合反引号前内容），原位替换为一行 `${frostFamilyCss("body[data-dsh-openbmc-skin]", TINTS)}`。
  - 从 L169-173（明块）与 L208-212（暗块）各删除三行菜单声明；**保留**穿插其间的 `--dsw-specific-input-major` / `--dsw-specific-login-input` 等其他声明。
  - 同步清掉仅描述菜单面的注释：明块 L164-168 注释只删「菜单面（host Menu primitives 的 _material 层）…」一段（保留首行「输入/菜单/选择器/提示 同系冰蓝。」，`*/` 随之上移收口到保留行末），暗块 L207 注释只删行尾「（菜单面较实同 v1 注）」括注；其余注释原样保留。
  - 文件头 import 区加 `import { frostFamilyCss } from "../frost-family.js";`
- [ ] Step 3: 字节验收
  - Run: `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify openbmc`
  - Expected: `squash=PASS menu=PASS literal=PASS`，exit 0
- [ ] Step 4: 套件回归
  - Run: `cd /home/ubuntu/workspace/dsh-skins && pnpm test`
  - Expected: build + smoke + 全部 tests 绿（`smoke-test.cjs:397-398` 带空格钉死在此步必须原样通过）

### Task 4: uefi-harness 接入

- 目标：与 Task 3 同型，uefi 家族段换为生成器调用。
- Files: Modify `src/client/skins/uefi-harness/index.js`
- 接口契约
  - Consumes: `frostFamilyCss`（Task 2，签名同 Task 2 Produces）；`canon.mjs --verify uefi-harness`（Task 1）；锚点：冻层段 L144-266、菜单声明 L72-75（明）/ L101-104（暗）
  - Produces: `TINTS`（frost `"248, 247, 255"` / `"23, 18, 45"`；menu `"248, 247, 255"` / `"28, 22, 55"`——menu 明与 frost 明同值、menu 暗异于 frost 暗，值为已核证的现行 L72-75 / L101-104 读数，执行时逐字复核）
- 验证范围：canon 三项 PASS + `pnpm test` 全绿。

- [ ] Step 1: 前置状态检查
  - Run: `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify uefi-harness && cd /home/ubuntu/workspace/dsh-skins && pnpm test`
  - Expected: verify 三项 PASS；测试全绿
- [ ] Step 2: 改文件
  - 在 `const css = \`...\`` 上方定义 `const TINTS = { frost: { light: "248, 247, 255", dark: "23, 18, 45" }, menu: { light: "248, 247, 255", dark: "28, 22, 55" } };`（与 L72-75 / L101-104 现行声明逐字一致，写入前复核）。
  - 删除冻层段 L144-266，原位替换为一行 `${frostFamilyCss("body[data-dsh-uefi-harness]", TINTS)}`。
  - 从 L72-75（明块）与 L101-104（暗块）各删除三行菜单声明，保留块内其他 token 声明。
  - 同步删除仅描述菜单面的注释：uefi 明块 L71「菜单面较实（openbmc 同注…）」整行；其余注释保留。
  - 文件头 import 区加 `import { frostFamilyCss } from "../frost-family.js";`
- [ ] Step 3: 字节验收
  - Run: `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify uefi-harness`
  - Expected: `squash=PASS menu=PASS literal=PASS`，exit 0
- [ ] Step 4: 套件回归
  - Run: `cd /home/ubuntu/workspace/dsh-skins && pnpm test`
  - Expected: 全绿

### Task 5: meirenzhi 接入（数组单元素替换）

- 目标：meirenzhi 数组中菜单+冻层连续 run（L60-114）换为一个生成器元素。
- Files: Modify `src/client/skins/meirenzhi/index.js`
- 接口契约
  - Consumes: `frostFamilyCss`；`SCOPE` 常量（L26）；锚点 L60-114
  - Produces: `TINTS`（frost `"250, 249, 246"` / `"18, 18, 26"`；menu `"250, 249, 246"` / `"18, 18, 26"`——与 frost 同值，按现行 L65-66 复核后仍写两组，不靠巧合省略）
- 验证范围：canon `squash=PASS menu=PASS`（literal 允许 FAIL=排版归中）+ `pnpm test` 全绿。
- 步骤：
  - Step 1 前置：`cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify meirenzhi` PASS（起点干净）
  - Step 2 改文件：数组元素 L60-114（含菜单与冻层的注释与条目）替换为单元素 `frostFamilyCss(SCOPE, TINTS)`；`TINTS` 定义于 `CSS` 数组上方；加 import。
  - Step 3 验收：`cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify meirenzhi` → `squash=PASS menu=PASS literal=FAIL (参考)`
  - Step 4 回归：`cd /home/ubuntu/workspace/dsh-skins && pnpm test` 全绿（`tests/meirenzhi-skin.test.mjs` 钉的是徽章/气泡/keyframes 等家族外字节，必须零改动通过）

### Task 6: overlay-frost.test.mjs 四表合一

- 目标：按皮四张 tint 表合并为一张 `SKIN_TINTS` 常量，断言零改动。
- Files: Modify `tests/overlay-frost.test.mjs`
- 接口契约
  - Consumes: 现有四表：`darkAnchors`（≈L73-77）、`darkTints`（≈L92-96，值与 darkAnchors 相同）、tip tints 表 `const tints`（≈L141-145）、`menuTints`（≈L173-177）
  - Produces: 每皮一个 `SKIN_TINTS = { <id>: { frostDark, tipLight, tipDark, menuLight, menuDark } }` 形态的单一常量（键名按四表现有用途归并，允许执行者为贴合现状微调键名，但**每皮只留一处 tint 数据**）；各断言块改引 `SKIN_TINTS`（与皮肤文件内的 `TINTS` 同名不同物，各自文件内定义，避免混淆故测试侧定名 `SKIN_TINTS`）
- 验证范围：旧表名零残留 + 全套件绿。
- 步骤：
  - Step 1 前置：`cd /home/ubuntu/workspace/dsh-skins && grep -nE "darkAnchors|darkTints|menuTints|const tints" tests/overlay-frost.test.mjs` → 四张表定义各命中 1 处 + 若干引用（当前状态）
  - Step 2 改文件：合并四表为单一 `SKIN_TINTS`；断言表达式本身零改动（只换数据源标识符）
  - Step 3 验证：`cd /home/ubuntu/workspace/dsh-skins && grep -nE "darkAnchors|darkTints|menuTints|const tints" tests/overlay-frost.test.mjs` 零命中（exit 1）；`cd /home/ubuntu/workspace/dsh-skins && pnpm test` 全绿

### Task 7: 文档与守卫注记（ADR-0012、ADR-0007 注记、developers.md 补句、hooks 头注记）

- 目标：把本次架构决定落盘，同步所有提及家族实现位置的注记。
- Files: Create `docs/adr/0012-frost-family-shared-generator.md`；Modify `docs/adr/0007-overlay-frost-union.md`、`docs/developers.md`、`scripts/verify-upstream-hooks.mjs`
- 接口契约
  - Consumes: 本计划「目标/架构快照/全局约束」与 grilling 钢人记录（ADR-0012 的 Considered Options 素材）
  - Produces: ADR-0012（status: accepted、date: 2026-10-19）；ADR-0007 Amendments 新行；developers.md 自持条款增句；hooks 头注记新指向
- 验证范围：grep 各落点 + `pnpm run verify:hooks` 真跑通过。
- 步骤：
  - Step 1 写 ADR-0012，必含四拍：① 背景 = ADR-0007 五次修订均以「三/四皮肤同构」收尾、同一修法 ×3 锁步（`2aa4b85`/`8773a28`/`7b7113b`）；② Decision = 家族 CSS 由 `src/client/skins/frost-family.js` 单函数生成，`tints = {frost:{light,dark},menu:{light,dark}}`，tint 与品牌资源仍各皮自持，「同步四处」改「同步一处」；③ Considered Options = 保持三皮独立手抄（钢人：自持教条 + tgcf 干净删除先例 + 测试已持有不变量——被否：不变量已共享而实现三抄，锁步税已付五次）、双段返回 `{menuCss, frostCss}`（被否：把历史偶然的文件内位置固化进 interface）；④ Consequences = 字节验收线（本计划全局约束第一条）、不单独发版、developers.md 自持条款补句。
  - Step 2 ADR-0007 Amendments 末尾追加：`- **2026-10-19（ADR-0012）**：家族实现收拢——选择器并集与配方由 src/client/skins/frost-family.js 单点生成，后续新增浮层面在 ADR-0007 清单登记后同步一处（ADR-0012）；裁决与配方字节不变。`
  - Step 3 developers.md 自持条款（「每个皮肤目录自持品牌标识…」句后）追加一句：`浮层毛玻璃等家族级机制住 src/client/skins/ 平级共享模块（如 frost-family.js），tint 色值与品牌资源仍由各皮自持（ADR-0012）。`
  - Step 4 verify-upstream-hooks.mjs 头注记 L14 **保留** `src/client/skins/*` 主体指向（清单条目 1/2/2b/3 钉的气泡选择器仍住各皮文件，以 meirenzhi 为主），仅在句末追加括注：`（frost-family 浮层家族选择器现集中于 src/client/skins/frost-family.js，ADR-0012）`——不整体改指向，避免把气泡条目指错文件。
  - Step 5 验证：`grep -n "frost-family" docs/adr/0012-frost-family-shared-generator.md docs/adr/0007-overlay-frost-union.md docs/developers.md scripts/verify-upstream-hooks.mjs` 各命中；`DSH_RUNTIME_ROOT="$HOME/.local/share/dsh-runtime" pnpm run verify:hooks` 通过（真跑非 SKIPPED）。注意：该命令本地全量扫描可能远超 90 秒（评审 60 秒窗口内无输出）——以后台作业起跑、经 job_output 收三态结论；若本地久无结论，如实记录覆盖度并以 CI（ADR-0011）为强制点，不停工。

### Task 8: 终验与 commit 1

- 目标：全量验证后落第一笔 commit。
- Files: commit 内容 = Task 2-7 全部改动 + `GLOSSARY.md`（已先行入册的未提交改动）+ 本计划文件自身 `docs/plans/2026-10-19-frost-family-generator-implementation-plan.md`（docs/plans/ 为入库惯例目录，计划随实现一并入库）。
- 验证范围：`pnpm run check`（带 RUNTIME_ROOT）全绿。
- 步骤：
  - Step 1 终验：`cd /home/ubuntu/workspace/dsh-skins && DSH_RUNTIME_ROOT="$HOME/.local/share/dsh-runtime" pnpm run check`（长链命令，预计可能超 90 秒——verify:hooks 段尤甚，按后台纪律起跑并经 job_output 收结果）
  - Expected: lockfile + build + node --check + 全部测试 + readme + bundle + hooks 全绿（bundle 尺寸应缩小，上限 776,360+b64+slack 不变）
  - Step 2 复验字节线：`cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify openbmc && node canon.mjs --verify uefi-harness && node canon.mjs --verify meirenzhi` → openbmc/uefi 三项 PASS、meirenzhi squash+menu PASS
  - Step 3 提交：`cd /home/ubuntu/workspace/dsh-skins && git add src/client/skins/frost-family.js src/client/skins/openbmc-harness/index.js src/client/skins/uefi-harness/index.js src/client/skins/meirenzhi/index.js tests/overlay-frost.test.mjs scripts/verify-upstream-hooks.mjs docs/adr/0012-frost-family-shared-generator.md docs/adr/0007-overlay-frost-union.md docs/developers.md docs/plans/2026-10-19-frost-family-generator-implementation-plan.md GLOSSARY.md && git commit -m "refactor(skins): collapse frost family into shared generator, rule-byte-canonical (ADR-0012)"`
  - Expected: commit 成功；`git status --short` 干净（无未跟踪残留）

### Task 9: developers.md 配方重写（commit 2）

- 目标：修复「照文档做即翻车」的新皮肤教程：教 `project()` 形状、删「内置适配器」幻觉。
- Files: Modify `docs/developers.md`「自建一套皮肤」节（代码样例 L~30-50、步骤 3 L~57）
- 接口契约
  - Consumes: `projector.js:16-18`（legacy adapter 已删、无 project 即 fail closed 的现实）、ADR-0004 标准字段集前瞻（wallpaper + slogan + panelOpacity）、ADR-0012（家族段一行调用）
  - Produces: 教学样例含 `project(values, assets)`；步骤 3 改写；无「内置适配器」表述
- 验证范围：grep 零命中 + 套件兜底绿。
- 步骤：
  - Step 1 前置：`cd /home/ubuntu/workspace/dsh-skins && grep -n "内置适配器" docs/developers.md` → 命中 1 处（当前缺失状态）
  - Step 2 改文件：代码样例补 `project(values, assets)`（标准字段集三字段的最小映射，输出含 `bodyAttribute`/`staticCss` 等必需 effects 键）；步骤 3 改为「必须提供 `project(values, assets)` 纯函数——无 `project` 的目录皮肤经三层回退 fail closed、**永不挂载**（`projector.js` 顶部注释），不存在内置适配器」；补一句「浮层毛玻璃家族段经 `frostFamilyCss(scope, TINTS)` 一行取得（ADR-0012）」与「默认投影须与烘焙串逐字节相等（ADR-0004 不变式）」。
  - Step 3 验证：`cd /home/ubuntu/workspace/dsh-skins && grep -n "内置适配器" docs/developers.md` 零命中（exit 1）；`cd /home/ubuntu/workspace/dsh-skins && pnpm test` 兜底绿
  - Step 4 提交：`cd /home/ubuntu/workspace/dsh-skins && git add docs/developers.md && git commit -m "docs(dev): rewrite skin recipe — project() required, legacy-adapter claim removed"`

## 执行纪律

- 开始实现前，先批判性复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- 按任务顺序执行，不无声跳步、合并步或改变任务目标。
- 每完成一个任务，运行该任务定义的验证；验证不过不进下一任务。
- 遇阻塞、重复失败或计划与仓库现实不符（如行段锚点漂移），立即停下说明，不猜。
- 工作在 `main` 上直接提交（仓库惯例，且用户已在共识中默许两笔 commit 划分）；若执行时发现不在 `main`，先停下确认。
- 基线与 canon 工具只落 `.dsh-research/frost-refactor/`，不进仓库、不进 commit。
- 全部任务完成后运行最终验证并输出修改摘要。

## 最终验证

- `cd /home/ubuntu/workspace/dsh-skins && DSH_RUNTIME_ROOT="$HOME/.local/share/dsh-runtime" pnpm run check` → 全绿（含 upstream hooks 真跑；超时纪律见全局约束）
- `cd /home/ubuntu/workspace/.dsh-research/frost-refactor && node canon.mjs --verify openbmc && node canon.mjs --verify uefi-harness && node canon.mjs --verify meirenzhi` → openbmc/uefi 三项 PASS；meirenzhi squash+menu PASS
- `git log --oneline -2` → 两笔新 commit（refactor + docs）；`git status --short` 干净（计划文件已随 commit 1 入库，无未跟踪残留）
- 输出修改摘要：文件清单、行数增减、bundle 尺寸变化（应缩小）、canon 三皮结果
