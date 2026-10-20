# 通透度投影核与皮肤生产面收窄实施计划

## 目标

- 按 ADR-0013 落地 `src/client/skins/translucency.js` 通透度投影核：三皮 `project()` 统一为表驱动单一入口，riding 声明单源生成进 CSS 模板，验收补双出厂点契约测试。
- 按 ADR-0014 将皮肤工厂 return 收窄为生产面七字段，`register()` fail-closed 强制，删除 index.js 合成分支与 slogan 第四份兜底。
- 全程纯重构、零行为变化：既有全部 pins 原样通过，禁止修改任何现存期望值。

## 架构快照

- 新模块 `translucency.js` 与 `frost-family.js` 同位同 doctrine：机制住共享模块，色值/品牌资源由皮肤自持。皮肤 = 声明表 + Mark/Name + 品牌 CSS 模板。
- 投影链不变：`projector.js → skin.project(values, assets) → normalizeEffects`。kernel 产出的仍是 SkinEffects 草稿；profile 仍然只经 catalog 默认值进入，投影核不感知 profile。
- 单源生成采用**声明级插值**：CSS 模板保留原排版（注释、空行、非 riding 邻居声明逐字不动），riding 声明改为 `ridingDecl(table, tokenKey, mode)` 插值——openbmc 块内 riding 与非 riding 交错、uefi 平铺，整块生成会破坏字节排版，不可取。meirenzhi 的 CSS 块不含 riding token，无需插值。
- 接口契约（Consumes/Produces 的唯一权威定义）：

```js
// src/client/skins/translucency.js 导出
export function createProjection(table)   // → (values, assets) => SkinEffects 草稿
export function ridingDecl(table, tokenKey, mode) // → "--dsw-alias-bg-base: rgba(247, 250, 252, 0.55);"
export function glassRule(bodyAttribute, glassVar) // → "body[data-dsh-openbmc-skin] [id=\"root\"]{backdrop-filter:blur(var(--dsh-openbmc-glass-blur,0px))}"
```

```js
// table 形状（皮肤声明表）
{
  bodyAttribute: "dshOpenbmcSkin",
  titleBrand: "OpenBMC Studio",
  favicon: { href, mime },
  anchor: 55,                       // 出厂锚：riding 重基线与 blur 铰链共用（GLOSSARY「出厂锚」）
  riding: {                         // 逐 token 亮暗 [rgb, baked]；baked = P=anchor 时的透明度点值
    "--dsw-alias-bg-base": { light: ["247, 250, 252", 55], dark: ["12, 26, 38", 55] },
  },
  constantTokens: null,             // 或 { token: {light, dark} }（meirenzhi 常量族，随 riding 合并进 tokenOverrides）
  scrim: { kind: "baked-gradient",  // twins：stop 对经 alpha(rgb,baked) 重基线后拼 linear-gradient，再拼 artLayer
           stops: { light: [["247, 250, 252", 15], ["240, 246, 250", 28]],
                    dark:  [["7, 14, 22", 10], ["4, 9, 14", 24]] },
           artLayer: <逐字迁自现状常量> }
        | { kind: "overlay", coefficient: 30, light: "252, 250, 246", dark: "16, 16, 26" }, // meirenzhi
  blur: { max: 24 },                // blurPx = round(max·max(0,(P−anchor)/(100−anchor))²)，anchor 处恒 0
  glassVar: "--dsh-openbmc-glass-blur",
  desktopBlur: { rate: 55, dark: "boost" },  // openbmc 为 { rate: 55, dark: "none" }；rate 与 anchor 是两个概念
  wallpaper: { kind: "legacy-baked", sentinel: "builtin:openbmc:art",
               placeholder: { light, dark } | null }   // 仅 openbmc 非 null
        | { kind: "assets" },                            // meirenzhi：image 只来自 assets，overlay 恒为纱
  staticCss: <CSS 模板串，riding 声明已插值>,
}
```

- kernel 内部数学（字节等价已逐位验证）：
  - riding：`pt = clamp(P + baked − anchor, 0, 100)`，`alpha = (pt/100).toFixed(2)` → `rgba(R, G, B, 0.55)`（rgb 逗号后空格、两位小数含前导零）
  - meirenzhi 展开换算：`baked = 35 + 100·offset`（base 35/35、sidebar 40/52、module-platform 35/40、input-major 40/45）
  - overlay 纱：`s = (round(coefficient·t²)/100).toFixed(3)`，t = clamp(P/100, 0, 1)
  - desktopBlur：`min(24, blurPx + P/rate)`；`dark:"none"` 时 dark = blurPx
  - 玻璃铰链：`blurPx > 0` ⇒ cssVariables `{glassVar: {light: px, dark: px}}` 且 `staticCss + "\n" + glassRule(...)`
  - slogans：`values.slogan`（mergeValues 保证恒在，无 `??` 兜底——ADR-0014/Q14）

## 全局约束

- 纯重构零行为变化：`tests/personalization-projector.test.mjs`、`tests/meirenzhi-skin.test.mjs`、`tests/runtime-effects.test.mjs`、`tests/upstream-hooks*.test.mjs`、`smoke-test.cjs` 的全部现存期望值**禁止修改**；唯一新增期望值是 Task 1 的契约金值。G0 例外仅两处且已留痕：Task 5 Step 2（slogan 兜底用例改写）、Task 7 Step 6（slogan 同源断言删除）——均属 B14 授权（删除的是生产不可达的死代码路径）。
- 字节格式逐字保留：rgba 逗号后空格（`rgb(248, 247, 255)`）、两位小数含前导零（`0.55`/`0.00`/`1.00`）、overlay 纱三位小数（`0.040`）、GLASS_RULE 单行无空格风格。
- 命名沿用 GLOSSARY：「通透度投影核」「出厂锚」；模块名 `translucency.js`，导出名以本计划「架构快照」为准，后续任务不得改名。
- 单批次落地：全部任务同一 PR；每个任务收尾时对应验证绿才进入下一任务。
- 构建类命令（esbuild spawn）需在 danger-full-access 会话执行；`pnpm run check` 中 `verify:hooks` 在本机需 `DSH_RUNTIME_ROOT`（默认 `~/.local/share/dsh-runtime` 即活 runtime），无 runtime 时该项打印 `upstream-hooks: SKIPPED` 属正常降级。
- 发版（Task 8）：独立正式版本（ADR-0012 修正案先例），流程按 `docs/developers.md`「发版」节与 know-how 018/008；发布前须独立评审 + 主人 headless A/B 像素实测背书。

## 输入工件

- `docs/adr/0013-translucency-projection-kernel.md`（accepted）
- `docs/adr/0014-skin-production-surface.md`（accepted）
- `GLOSSARY.md`（已含「通透度投影核」「出厂锚」词条）
- 代码事实基线：`src/client/skins/{openbmc-harness,uefi-harness,meirenzhi}/index.js`、`src/client/personalization/projector.js`、`src/client/runtime.js`、`src/client/index.js`、`src/shared/personalization/catalog.js`

## 文件结构与职责

- Create: `src/client/skins/translucency.js` —— 投影核：表形状、`createProjection`/`ridingDecl`/`glassRule`，内含 `resolveImageRef` 引用（自 `../../shared/personalization/catalog.js`）处理 legacy 壁纸分支
- Create: `tests/translucency-contract.test.mjs` —— 双出厂点契约金值（先钉围栏，重构全程绿）
- Create: `tests/translucency-kernel.test.mjs` —— kernel 单元测试（合成表）
- Modify: `src/client/skins/openbmc-harness/index.js` —— 声明表 + 插值 16 处 riding 声明（亮 8 暗 8）+ `project = createProjection(table)`；删 `pt/pct/alpha`、riding 装配循环、`GLASS_RULE` 常量、desktopBlur 手算、`SLOGANS` 常量与 `??` 兜底
- Modify: `src/client/skins/uefi-harness/index.js` —— 同上，插值 14 处（亮 7 暗 7）
- Modify: `src/client/skins/meirenzhi/index.js` —— 声明表（展开 baked、constantTokens、overlay 纱、assets 壁纸）；删 `panelBase/BASE_RGB/SLOGANS/GLASS_RULE` 与手写 project
- Modify: `src/client/runtime.js` —— `register()` 增生产面白名单：未知字段抛错（字段缺失不抛，official 皮肤路径不受影响）
- Modify: `src/client/index.js` —— 删 builtinAssets 补底合成分支（31-38 一带）及其 `art/placeholderLight` 依赖
- Modify: `src/shared/personalization/catalog.js` —— 「Legacy wallpaper semantics … live inside each skin's project() branches」注释随迁指向 translucency.js（字段与默认值零改动）
- Modify: `tests/personalization-projector.test.mjs` —— 包装字段读取（:224-230/:255/:262/:272/:310/:317/:327/:417/:432）改为对 `project()` 输出断言；新增内容无（金值在 contract 测试）
- Modify: `tests/overlay-frost.test.mjs`、`tests/meirenzhi-skin.test.mjs`、`tests/brand-seat-coexistence.test.mjs` —— 包装字段读取改 `project()` 输出；brand-seat 85 行合成分支第三抄删除
- Modify: `tests/personalization-catalog.test.mjs` —— :253 slogan 同源断言删除（B14 单源化，G0 例外留痕）
- Modify: `tests/runtime-effects.test.mjs` —— 白名单三例（Task 7 Step 3）；`withLegacyAssets` 死镜像删除（Task 7 Step 5）
- Modify: `docs/developers.md` —— 「皮肤配方」节：`project` 由投影核产出、自持条款注 ADR-0013/0014
- 边界不动：`projector.js`/`normalizeEffects`/SkinEffects 形状、runtime 发射逻辑（`backdropCss`/`shellAlignment`）、catalog 字段与默认值、host 侧全部文件

## 任务清单

### Task 1: 双出厂点契约金值围栏（对现状代码写通过测试）

- 目标：在动任何产品代码前，把 web 出厂锚之外的缺口（P=66 desktop 出厂、P=0/P=100 边界、单调性）钉成金值；这是陷阱 A（锚被 profile 污染）的唯一常驻防线。
- 涉及文件：`tests/translucency-contract.test.mjs`（新建）
- 接口契约
  - Consumes：三皮工厂（`createOpenBmcHarness`/`createUefiHarness`/`createMeirenzhiSkin`，传 `tests/fake-react.mjs` 的 jsx runtime 或最小 `{jsx: () => null, jsxs: () => null, Fragment: "x"}`）；各皮 `project(values, assets)`
  - Produces：`tests/translucency-contract.test.mjs`（后续 Task 3-5 的常绿围栏）
- 验证范围：新测试对**未改动**的当前代码全绿。

- [ ] Step 1: 写契约测试。断言金值的独立基线：双胞胎 token 金值表**逐字抄自现状 CSS 块行**（openbmc `index.js:158-223`、uefi `index.js:68-104`）与 riding 表读数，执行时从仓库现状抄录、不得改写。对三皮各断言：
  - **web 出厂锚（双胞胎 P=55 / meirenzhi P=35）**：逐 token 断言 `tokenOverrides[token].light|dark` 全串等于金值表字面量（如 `"rgba(247, 250, 252, 0.55)"`；meirenzhi 为 base `0.35`/`0.35`、sidebar `0.40`/`0.52`、module `0.35`/`0.40`、input `0.40`/`0.45`、纱 s=`0.040`）；blur=0、cssVariables=null、staticCss 不含 GLASS_RULE；**CSS↔effects 互证（仅双胞胎适用）**：staticCss 对每个 riding token、每种模式都包含整行 `${token}: ${tokenOverrides[token][mode]};`（两条消费路径互为外部基线，防插值错位/亮暗互换/漏插。meirenzhi 的 staticCss 不含 riding 行、随动走 tokenOverrides 通道，不做此断言）。
  - **P=66**（desktop 出厂）：
    - openbmc riding（baked+11）：亮 `bg-base 0.66 / module-platform 0.66 / layer-1 0.59 / layer-2 0.67 / layer-3 0.73 / sidebar-fill 0.71 / input-major 0.71 / login-input 0.71`；暗 `base 0.66 / module 0.71 / layer-1 0.66 / layer-2 0.71 / layer-3 0.75 / sidebar 0.83 / input 0.76 / login 0.76`
    - uefi riding（baked+11）：亮 `base 0.66 / module 0.66 / layer-1 0.59 / layer-2 0.67 / layer-3 0.73 / sidebar 0.71 / input-major 0.73`；暗 `base 0.66 / module 0.71 / layer-1 0.66 / layer-2 0.71 / layer-3 0.75 / sidebar 0.83 / input 0.66`
    - 双胞胎 blurPx=1、cssVariables glass `1px`、staticCss 含 GLASS_RULE；desktopBlur：openbmc `{light: 2.2, dark: 1}`、uefi `{light: 2.2, dark: 2.2}`
    - meirenzhi：t=0.66 → base `0.66`/`0.66`、sidebar `0.71`/`0.83`、module `0.66`/`0.71`、input `0.71`/`0.76`；overlay 纱 s=`0.130`（即 `linear-gradient(rgba(252, 250, 246, 0.130) 0%, … 0.130) 100%)` 同构暗串）；blurPx=3、desktopBlur `{4.2, 4.2}`、glass `3px`
  - **P=0**：双胞胎 riding 有残值（α = max(0, baked−55)/100，仅 baked≤55 的 token 归零）——逐 token 金值：openbmc 亮 `base 0.00 / module 0.00 / layer-1 0.00 / layer-2 0.01 / layer-3 0.07 / sidebar 0.05 / input 0.05 / login 0.05`，暗 `base 0.00 / module 0.05 / layer-1 0.00 / layer-2 0.05 / layer-3 0.09 / sidebar 0.17 / input 0.10 / login 0.10`；uefi 亮 `base 0.00 / module 0.00 / layer-1 0.00 / layer-2 0.01 / layer-3 0.07 / sidebar 0.05 / input 0.07`，暗 `base 0.00 / module 0.05 / layer-1 0.00 / layer-2 0.05 / layer-3 0.09 / sidebar 0.17 / input 0.00`；blur 0、cssVariables null、desktopBlur 全 0；双胞胎 scrim 前缀金值（供 Task 6 :262/:317 改写使用）：openbmc `linear-gradient(rgba(247, 250, 252, 0.00) 0%, rgba(240, 246, 250, 0.00) 100%)`、uefi `linear-gradient(rgba(248, 247, 255, 0.00) 0%, rgba(238, 234, 255, 0.00) 100%)`，其后紧接 `, url(data:image/webp…`（artLayer 前缀）；meirenzhi base `0.00`、sidebar `0.05`/`0.17`、module `0.00`/`0.05`、input `0.05`/`0.10`、s=`0.000`、blur 0
  - **P=100**：随动族 α = clamp(45+baked)——**baked≥锚的 token 钳 `1.00`，baked<锚的 token 为 `(45+baked)/100`**（勘误：v1/v3 误写「全部 1.00」，实况为 openbmc layer-1 亮 0.93、uefi layer-1 亮 0.93，其余全部 1.00；meirenzhi 四 token 全部 1.00）；双胞胎 blur 24、desktopBlur `{24, 24}`（openbmc dark=24=blurPx）、glass `24px`；meirenzhi blur 12、desktopBlur `{12 + 100/55, 12 + 100/55}`、glass `12px`
  - **单调性**：P=0..100 step 5，逐 token α（parseFloat）与 blurPx 均非下降
- [ ] Step 2: Run: `node --test tests/translucency-contract.test.mjs`
- [ ] Expected: 全绿。**任何一个金值不匹配 → 立即停下报告**（说明本计划数学推导与代码现实不符），禁止静默改期望值迁就现状。
- [ ] Step 3: checkpoint commit（如 `test(skins): pin dual-factory translucency contract goldens (ADR-0013 fence)`）

### Task 2: 投影核 translucency.js（红-绿）

- 目标：实现 kernel 与三个导出；用合成表做单元测试，不接触真实皮肤。
- 涉及文件：`src/client/skins/translucency.js`（新建）、`tests/translucency-kernel.test.mjs`（新建）
- 接口契约
  - Consumes: `resolveImageRef`（`src/shared/personalization/catalog.js`）；「架构快照」的表形状与导出签名
  - Produces: `createProjection(table)`、`ridingDecl(table, tokenKey, mode)`、`glassRule(bodyAttribute, glassVar)`——Task 3/4/5 依赖
- 验证范围：单元测试覆盖每条数学分支与字节格式。

- [ ] Step 1: 先写失败测试 `tests/translucency-kernel.test.mjs`：合成表断言 riding 重基线与 clamp（P=0/anchor/100）、曲线 `round(max·max(0,(P−anchor)/(100−anchor))²)`（含 anchor 处 0、P=100 到顶）、desktopBoost（`dark:"none"` 与 `"boost"` 两态、min(24,·) 钳）、overlay 纱 `toFixed(3)`、legacy 壁纸三分支（custom user url / 烘焙纱 / `artLayer === ""` 时 placeholder）、assets 模式（无 asset 时 image 为 null 且 overlay 恒在）、玻璃铰链（cssVariables 与 staticCss 拼接含 `"\n"`）、constantTokens 合并、slogans 取 `values.slogan`；`ridingDecl` 输出逐字节 `"--dsw-alias-bg-base: rgba(247, 250, 252, 0.55);"`；`glassRule` 输出逐字节（`[id="root"]`、var 默认 `0px`）
- [ ] Step 2: Run: `node --test tests/translucency-kernel.test.mjs`
- [ ] Expected: 失败——模块不存在（ERR_MODULE_NOT_FOUND）
- [ ] Step 3: 实现 `src/client/skins/translucency.js`：模块头注释声明「通透度投影核（ADR-0013）；锚与增益率是两个概念；投影不感知 profile」；按「架构快照」实现三导出与全部数学
- [ ] Step 4: Run: `node --test tests/translucency-kernel.test.mjs`
- [ ] Expected: 全绿
- [ ] Step 5: checkpoint commit

### Task 3: openbmc 接入投影核

- 目标：openbmc 以声明表 + kernel 替换手写投影；CSS 模板 riding 声明改插值。
- 涉及文件：`src/client/skins/openbmc-harness/index.js`
- 接口契约
  - Consumes: Task 2 三导出；现有 riding 表数据（:1757-1766）、TINTS/BACKGROUND_ART/PLACEHOLDER_*/FAVICON_*
  - Produces: openbmc 声明表（uefi/meirenzhi 任务参照其形状）；**工厂 return 显式携带 `builtinAssets`**（Task 6 Step 3 的前置）；该文件 `project` 行为不变
- 验证范围：全量 `pnpm run check` 绿（含 overlay-frost 对 `factory().css` 的文本级断言、smoke 的 includes 子串断言；插值正确性由 Task 1 金值表 + CSS↔effects 互证 + 构造性断言三重把守，不再依赖现有 pins——它们在插值后与被测对象同源自比）。

- [ ] Step 1: 在文件内按「架构快照」声明 `table`（anchor 55、8+8 riding、baked-gradient 纱 stops 与 artLayer 逐字迁自现状、desktopBlur `{rate:55, dark:"none"}`、wallpaper legacy-baked + sentinel `builtin:openbmc:art` + placeholder、staticCss 先指向现 CSS）；**工厂 return 显式新增 `builtinAssets: { art: { mime: "image/webp", url: BACKGROUND_ART } }`**（裸 data URL，与 index.js 合成分支 `url: skin.art` 语义逐字一致；合成分支 `!== undefined` 判断随之短路，行为不变）
- [ ] Step 2: 在 `tests/translucency-contract.test.mjs` 增 openbmc 构造性断言：源文件中 `${ridingDecl(` 出现次数恰为 16；对 **16 个 riding token 的全名逐一**断言源文件中 `${token}: rgba(` 直写形态出现 0 次——**勿用泛化 `--dsw-…: rgba(` 正则**：CSS 内另有 14 处非 riding 邻居（bg-overlay/nav 态/selector/tip/interactive/bubble 等）的合法保留直写。Run: `node --test tests/translucency-contract.test.mjs` → Expected: **红**（现状为 16 处直写、0 处插值）
- [ ] Step 3: CSS 模板内 16 处 riding 字面量声明改为 `${ridingDecl(table, "<token>", "light"|"dark")}`（排版、注释、空行、邻居声明逐字不动；插值产物必须与被替换字面量逐字节相同）
- [ ] Step 4: `project` 替换为 `createProjection(table)` 绑定；删除 `pt/pct/alpha`、riding 装配循环、scrim/desktopBlur 手算、`GLASS_RULE` 常量、`values.slogan ?? SLOGANS` 兜底写法（kernel 由 values.slogan 取值）。`SLOGANS/SCRIM_LIGHT/SCRIM_DARK/PLACEHOLDER_*` 常量**暂留**——工厂 return 的包装字段仍在引用，Task 7 随字段一并删除
- [ ] Step 5: Run: `pnpm run check`
- [ ] Expected: 全绿（verify:hooks 无 runtime 时 SKIPPED 属正常降级）
- [ ] Step 6: checkpoint commit

### Task 4: uefi 接入投影核

- 目标：同 Task 3，作用于 uefi。
- 涉及文件：`src/client/skins/uefi-harness/index.js`
- 接口契约：同 Task 3；差异：7+7 riding、无 login-input、desktopBlur `{rate:55, dark:"boost"}`、wallpaper placeholder 为 null、favicon 自常量、CSS 模板为平铺风格；同样在 return 显式新增 `builtinAssets: { art: { mime: "image/webp", url: BACKGROUND_ART } }`
- 验证范围：全量 `pnpm run check` 绿。

- [ ] Step 1: 声明表 + `builtinAssets` 显式新增（同 Task 3 Step 1 形状）
- [ ] Step 2: 契约测试增 uefi 构造性断言（`${ridingDecl(` 计数 14；对 14 个 riding token 全名逐一断言直写形态 0 次——另有 12 处非 riding 邻居合法直写，勿用泛化正则）。Run: `node --test tests/translucency-contract.test.mjs` → Expected: 红
- [ ] Step 3: CSS 模板 14 处插值替换（平铺排版逐字不动）
- [ ] Step 4: `project = createProjection(table)` 绑定并删手写实现（同 Task 3 Step 4）
- [ ] Step 5: Run: `pnpm run check` → Expected: 全绿
- [ ] Step 6: checkpoint commit

### Task 5: meirenzhi 接入投影核

- 目标：meirenzhi 以声明表接入（锚 35 实例），删除 t 模型手写实现。
- 涉及文件：`src/client/skins/meirenzhi/index.js`
- 接口契约
  - Consumes: Task 2 导出；现 riding 偏移（base 0/0、sidebar +0.05/+0.17、module 0/+0.05、input +0.05/+0.10）→ baked 展开 35/35、40/52、35/40、40/45；常量族 token（:112-128）；BASE_RGB 展开为逐 token rgb（`250, 249, 246`/`18, 18, 26`）；overlay 纱 `{coefficient: 30, light: "252, 250, 246", dark: "16, 16, 26"}`（注意纱 rgb 与 BASE_RGB 不同）；wallpaper `{kind:"assets"}`、blur `{max:12}`、glassVar `--dsh-mrz-glass-blur`
  - Produces: 三皮全部接入完成（Task 6 的前提）
- 验证范围：全量 `pnpm run check` 绿（meirenzhi-skin 现存金值、projector、契约、smoke 全在其中）。

- [ ] Step 1: 声明表并绑定 `project = createProjection(table)`；删除 `panelBase/BASE_RGB/GLASS_RULE` 与手写 project；`SLOGANS` 常量暂留（return 的 `slogans: SLOGANS` 字段 Task 7 删）（CSS 数组不含 riding，无需插值）
- [ ] Step 2: `tests/meirenzhi-skin.test.mjs` :108-113「falls back to factory slogan」用例改写：断言 slogan 字段缺失时草稿 `slogans` 为 undefined、经 `projectSkin`/`normalizeEffects` 后为 null。**G0 例外依据 B14**：生产路径 `mergeValues` 恒供 catalog 默认值，该兜底是死代码路径，删除属零生产行为变化；此处置为 B14 授权内的必要测试改写，在计划中显式留痕
- [ ] Step 3: Run: `pnpm run check` → Expected: 全绿
- [ ] Step 4: checkpoint commit

### Task 6: 测试改读行为（包装字段读取清零）

- 目标：所有测试不再读皮肤包装字段，为 Task 7 的字段删除铺路；此任务独立全绿。
- 涉及文件：`tests/personalization-projector.test.mjs`、`tests/overlay-frost.test.mjs`、`tests/meirenzhi-skin.test.mjs`、`tests/brand-seat-coexistence.test.mjs`
- 接口契约
  - Consumes: 三皮 `project()`（现已为 kernel 绑定）；`projectSkin()` 管道
  - Produces: 测试只经 `project()`/`projectSkin()`/构建产物读取行为的基线
- 验证范围：全量 `pnpm run check` 绿；产品代码零改动。

- [ ] Step 1: `tests/personalization-projector.test.mjs` 包装字段读取全部改为对 `project()` 输出断言（完整清单，逐处落改）：:224-226（`skin.art/placeholder*/scrim*/slogans` → `project(锚点 values)` 的 `backdrop.imageLight/imageDark` 与 catalog 默认 slogan）、:227（`skin.title`→`effects.titleBrand`）、:228（`skin.favicon`→`effects.favicon.href`）、:229/:255/:310/:432（`skin.css`→锚点 `project().staticCss`，锚点 blur=0 即纯 CSS）、:230（`skin.bodyAttr`→`effects.bodyAttribute`）、:262/:317（改为 `project(P=0).backdrop.imageLight` **startsWith(Task 1 契约已钉的 scrim 前缀金值)** 且 **includes(`, url(data:image/webp`)**——整串含 2MB 级 base64 无法硬编码，此前缀+后缀双锚非自比）、:272/:327（改为关系断言 `project(P=100).staticCss === project(P=55).staticCss + "\n" + 'body[data-…-skin] [id="root"]{backdrop-filter:blur(var(--dsh-…-glass-blur,0px))}'`——两个独立输出 + 内联 GLASS 字面量，非自比）、:417（`skin.favicon`→`effects.favicon.href`）
- [ ] Step 2: `tests/meirenzhi-skin.test.mjs` :16（`skin.bodyAttr`→`effects.bodyAttribute`）、:20-22（`skin.favicon/faviconMime/title`→`effects.favicon.href/.mime`、`effects.titleBrand`）、:46（`skin.css`→P=35 `project().staticCss`）；`tests/overlay-frost.test.mjs` 直读 `factory().css` 处（:18 一带）改读锚点 `project().staticCss`（frost 段无条件在内）
- [ ] Step 3: brand-seat 测试 :85 合成分支第三抄删除（直接用 `skin.builtinAssets`——Consumes Task 3/4 的显式声明 Produces）
- [ ] Step 4: 等价映射总则（写入本步实现）：`bodyAttr→effects.bodyAttribute`、`favicon/faviconMime→effects.favicon.href/.mime`、`title→effects.titleBrand`、`css→锚点 project().staticCss`、`slogans→defaultsFor(skinId).slogan`；期望值**禁止引用 Task 7 将删除的字段/常量**。已知可接受弱化并注明兜底：favicon 全等断言退化为 `startsWith("data:image/…")` + mime 断言——favicon 为静态资产、本次三任务均不触碰其内容，行为层由 smoke 的 favicon 断言兜底
- [ ] Step 5: Run: `pnpm run check`
- [ ] Expected: 全绿
- [ ] Step 6: checkpoint commit

### Task 7: 生产面收窄 + register 白名单 + 注释随迁

- 目标：落地 ADR-0014 全部决定；catalog/developers 文档同步。
- 涉及文件：三皮 `index.js`、`src/client/runtime.js`、`src/client/index.js`、`src/shared/personalization/catalog.js`、`docs/developers.md`、`tests/runtime-effects.test.mjs`
- 接口契约
  - Consumes: Task 6 后测试已不读包装字段；生产面七字段 `{id, label, description, Mark, Name, project, builtinAssets}`
  - Produces: `register()` 白名单强制（后续任何字段扩宽必须动 runtime.js 白名单）
- 验证范围：全量 `pnpm run check` 绿。

- [ ] Step 1: 三皮工厂 return 删至七字段；随之删除仅被包装字段引用的孤儿常量：三皮 `SLOGANS`、双胞胎 `SCRIM_LIGHT/SCRIM_DARK`、meirenzhi 的 `art:""` 与 yuntai 兜底四字段（`WALLPAPER_YUNTAI` import 若仅此处使用一并清理）。openbmc 的 `PLACEHOLDER_LIGHT/DARK` **保留**——`table.wallpaper.placeholder` 仍引用
- [ ] Step 2: `register()` 增白名单：`const PRODUCTION_FIELDS = new Set(["id","label","description","Mark","Name","project","builtinAssets"])`；`Object.keys(skin)` 出现集合外键即 `throw new Error("[dsh-skins] unknown skin field …")`（缺失字段不抛——official/测试最小皮肤路径不变）
- [ ] Step 3: `src/client/runtime.js` `export const PRODUCTION_FIELDS = new Set([...])` 并在 `tests/runtime-effects.test.mjs` 增三例：多余字段注册抛错；七字段最小皮肤注册通过；`[...PRODUCTION_FIELDS].sort()` deepEqual 七字段清单（钉住白名单内容，防未来偷偷加字段）
- [ ] Step 4: `src/client/index.js` 删合成分支（`if (skin.builtinAssets === undefined) {…}` 整段——此时三皮已全部显式声明，该分支为死代码）
- [ ] Step 5: `tests/runtime-effects.test.mjs` :134-141 `withLegacyAssets`（合成分支第二抄，注释自认 "Mirrors src/client/index.js"）删除——Task 3/4 显式声明后其条件恒短路为死代码
- [ ] Step 6: `tests/personalization-catalog.test.mjs` :253「slogan default must be same-source with the factory's static slogans」断言删除，原位注释注明：B14 单源化后 catalog 是唯一源、无第二份可比对，同源校验由单源构造承担。**G0 例外依据 B14**（与 Task 5 Step 2 同口径）
- [ ] Step 7: `catalog.js` 注释随迁：「Legacy wallpaper semantics … live inside each skin's project() branches」改为指向 `skins/translucency.js` 投影核；字段与默认值零改动
- [ ] Step 8: `docs/developers.md`「皮肤配方」节更新：`project` 由 `createProjection(table)` 产出、表形状指向 `translucency.js`、自持条款注明机制共享/色值自持引 ADR-0013、生产面七字段引 ADR-0014
- [ ] Step 9: Run: `pnpm run check`（本机带 `DSH_RUNTIME_ROOT` 则 hooks 真跑，否则 SKIPPED 属正常）
- [ ] Expected: 全绿
- [ ] Step 10: checkpoint commit

### Task 8: 最终验证与发版门

- 目标：全量收口 + 独立发版（ADR-0012 修正案纪律）。
- 涉及文件：无新改动（验证）；发版按 `docs/developers.md`「发版」节
- 接口契约
  - Consumes: Task 1-7 全部产物
  - Produces: 独立正式版本
- 验证范围：全量 check + 评审 + 主人实测。

- [ ] Step 1: Run: `pnpm run check`
- [ ] Expected: 全绿（含 verify:bundle、verify:readme、verify:hooks 真跑或 SKIPPED 降级）
- [ ] Step 2: **开工时已记录基线 commit**（执行纪律：开工首日 `git rev-parse HEAD` 存档），走查 `git diff <基线>..HEAD` 全量：确认无期望值修改（除 Task 1 新增金值与 Task 5 Step 2 / Task 7 Step 6 两处 B14 授权的 G0 例外）、无行为性改动、lib/ 产物与 src 一致
- [ ] Step 3: 独立评审（三轮，ADR-0012 先例）+ 主人 headless A/B 像素实测（web P=55/35 与 desktop P=66 出厂态、明暗两态）
- [ ] Step 4: 发版：版本号 bump、正式版本 tag、OIDC 发布三键核验（npmjs 直查、窗口内不重推 tag、registry 描述/verified 收尾按 know-how 008/018）

## 执行纪律

- 开工前先复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- 按任务顺序执行，不无声跳步、不合并步、不改变任务目标；每任务收尾运行其验证并确认绿。
- 任何既有 pins 变红或金值不匹配：立即停下说明，禁止改期望值迁就。
- 遇阻塞、重复失败或计划与仓库现实不符：立即停下说明，不猜。
- 开工前确认当前分支与主人预期一致（仓库历史为直接提交主干风格；若主人要求特性分支则从最新主干切出）；**开工首日以 `git rev-parse HEAD` 记录基线 commit**（Task 8 Step 2 的走查基准，主干直提与特性分支两种模式皆成立）。
- 全部任务完成后运行最终验证并输出修改摘要。

## 最终验证

- `pnpm run check` 全绿（本机 `DSH_RUNTIME_ROOT` 就绪时含 upstream-hooks 真跑）。
- `node --test tests/translucency-contract.test.mjs tests/translucency-kernel.test.mjs` 全绿。
- `git log --oneline` 展示逐任务 checkpoint；`git diff` 走查确认：产品行为零变化、现存期望值零修改（除 Task 5 Step 2 / Task 7 Step 6 两处 B14 授权、G0 例外已留痕）、lib 产物三方一致（装机/发布 tarball/仓库构建，发版时核）。
