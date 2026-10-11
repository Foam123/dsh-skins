# Desktop 外壳单层出画：消除 R 倒角缺口的涂层次数差

---
status: accepted
date: 2026-10-11
---

## 症状与根因

Windows DSH Desktop（`html[data-windows-titlebar]`）下，三套皮肤的明暗两态在中央内容区左上 16px 圆角的缺口处露出一枚 1/4 圆「花瓣」色斑（用户四连实拍：meirenzhi 亮/暗、uefi 亮、openbmc 亮；官方皮肤同机无此症状）。

根因是**涂层次数不等**，不是 2026-10-10 计划归因的「半透明面透出壁纸不同位置」（desktopBlur 候选 `1.5.2` 对此无效，实测确认）。AppFrame（`@deepseek-ai/dsh-client-ui-layout`，0.2.0-rc.2）在 titlebar 模式下的出画方式：

| 区域 | 叠层 | 有效不透明度 |
|---|---|---|
| 顶栏条（frame::before 拖拽条） | frame 背景 + 条自身填充 | `1-(1-α)²`（双层） |
| 侧栏列（sidebarCol） | frame 背景 + 列自身填充 | `1-(1-α)²`（双层） |
| **主区 16px 圆角缺口** | **仅 frame 背景** | **α（单层）** |
| 中央内容区 | frame 背景 + bg-base | α+β 复合 |

官方 token（`--dsw-specific-sidebar-fill: var(--dsw-static-neutral-bluish-50)`）不透明，多层同色叠加不可见；皮肤把该 token 换成半透 rgba 后，缺口成为整个窗口**唯一少涂一层**的区域，壁纸以更高饱和度透出，形状恰为一个 16px 的 1/4 圆。普通 Web 无 marker、无圆角缺口，天然无症状；darwin 档 frame 底为 `0 0`（各列自绘单层），同样无症状。

## Considered Options

- **调高 `--dsw-specific-sidebar-fill` 的 alpha 做补偿**——被否：该 token 同时是中央内容区在 frame 下的垫底，内容区跟着变实，摧毁「通透度」旋钮的 P→α 映射。
- **Desktop 上把侧栏填充改为实心**——被否：GLOSSARY「通透度」明确 Desktop 侧栏/顶栏随同一设置联动且保留透底；此举等于砍掉透纱美学的 Desktop 形态。
- **去掉 16px 圆角（`--dsh-windows-content-radius: 0`）**——被否：用户要的正是原生那种 R 框，只是不要色斑。
- **向 DSH 上游提布局接口**——保留为远景：10-10 计划红线针对的是该轮 A/B，且 ADR-0006/0007 已确立「结构化局部名钩子 + 守卫」是本仓库对宿主类名的合法姿势，本轮按此办理。
- **中和多余涂层（采纳）**：条与侧栏列退为透明，全窗口侧栏侧统一由 frame 背景单层出画。缺口与邻居涂层数恒等，任何 α 下都无缝。

## Decision

runtime 层新增 skin 生命周期管理的 `dsh-skins/<id>.shell.css`（marker 门控、三皮肤共享一份）：

```css
html[data-windows-titlebar] [class*="_frame"]:has(> [class*="_sidebarCol"])::before{background:0 0}
html[data-windows-titlebar] [class*="_frame"] > [class*="_sidebarCol"]{background:0 0}
```

- **`::before` 只退底色不退拖拽**：`-webkit-app-region: drag` 保留，顶栏拖拽区不受影响。
- **结构化局部名钩子**（ADR-0006/0007 教义）：不钉哈希；`:has(> [class*="_sidebarCol"])` 把第一条规则锚定到唯一 AppFrame，`>` 直接子元素约束钉住第二条。
- **特异性**：两条规则 (0,3,2)/(0,3,0) 均压过宿主 `[data-windows-titlebar] .BynINW_frame:before` 与无作用域的 `.BynINW_sidebarCol`。
- **守卫**：`scripts/verify-upstream-hooks.mjs` 新增第 7 组——layout 包内 `_frame`/`_sidebarCol` 类选择器、`data-windows-titlebar` marker、已发布变量 `--dsh-windows-content-radius` 存活，加全仓包级 `_frame`/`_sidebarCol` 类选择器清单（非登记包出现即 fail，防选择器误伤面扩大）。守卫同时支持 pnpm store 与 desktop-asar 直读两种布局（`DSH_RUNTIME_ROOT` 指向解包 asar 的 `dsh/` 即可真跑）。
- **守卫双模式（2026-10-11 桌面 asar 审计的伴生发现）**：桌面 app 的前端 dist 是**独立构建**，css-modules 哈希随版本漂移——0.2.0-rc.2 桌面 asar 实测 chat=`cJsG2q_bubble`、goal=`ja1rG_bubble`、user-questions=`v1fjQa_bubble`，即 ADR-0006 的精确哈希支路在桌面上**从未命中**，桌面一直靠结构化支路出画。守卫据此分档：pnpm store（web 运行时，哈希钉子的出产地）维持严格模式；desktop-asar 直读布局走结构化模式（单一 `_bubble` 清单 + `userStack`/`_stack` 容器必须成立，精确哈希只报告不要求，页级气泡白名单取运行时自身观测族 + user-questions 回复气泡）。ADR-0007/0009 的结构化钩子在两种模式下同判。
- **`_frame` 登记清单**：layout 之外还有五个包自带 `.<hash>_frame` 面板（chat、sidebar-browser、sidebar-documentpreview、subagent、user-questions，0.2.0-rc.2 实测）——ADR-0009 选择器的复合锚定（`:has(> [class*="_sidebarCol"])` 与 `_sidebarCol` 父子约束，`_sidebarCol` 全仓唯一）使它们永不误伤；守卫登记为已复核面，未登记包新出现即 fail。

## Amendments

- **2026-10-11（v2，1.5.3-alpha.1 实机反馈）**：主人 Windows Desktop 实测 v1 后仍剩两处。**(a) R 缺口残瓣**——v1 中和了条与侧栏列，但 `dsh-client-ui-sidebar` 的 `.<hash>_root` 在列内**又刷一次** sidebar-fill（darwin 档宿主自己就 `._root{background:0 0}`，佐证这正是该组件的单层化标准关法）——侧栏 ×2 vs 缺口 ×1 依旧不等。补第三条规则 `[class*="_sidebarCol"] > [class*="_root"]{background:0 0}`（`_root` 被 `_sidebarCol` 直接子元素约束唯一化；守卫钉住「sidebar 包内 `_root` 的 background:var(--dsw-specific-sidebar-fill)」前提行）。全仓审计确认 sidebar-fill 其余消费面（schedule 通知卡、trajectory 表头、workspace 列表渐隐、theme 定义）均在内容区内部，与外壳叠涂无关。**(b) 原生窗口按钮色块**——最小化/最大化/关闭是 **Electron WCO 原生面**：主进程开窗时 `titleBarOverlay.color = chromeFallbackFill()`（`#1b1b1c`/`#f9fafb` 静态实色）；win32 预载其实内建了动态回路——往 body 塞探针 span（inline `background-color:var(--dsw-specific-sidebar-fill)`），canvas 合成 computed 色后经 `windowsAppearance` IPC 推给 `setTitleBarOverlay`，并监听 head/样式/明暗属性变化自动重推。半透皮肤填充到达原生面时失去壁纸垫底（无论平台吃不吃 alpha，观感都不再等于侧栏顶栏），按钮区遂呈「实心填充基色」矩形（玄夜红调顶栏上的近黑块、蓝调亮顶栏上的近白块，主人实拍）。修法：皮肤以样式表 `!important` 覆写探针背景为**填充 ⊗ 壁纸右上区域均值的不透明合成色**（`body[data-ds-dark-theme]… > span[style*="--dsw-specific-sidebar-fill"]` 逐模式一条；!important 压过 inline 声明）——发出恒不透明，对「平台忽略/合成 alpha」两种实现都正确；壁纸经 32px 缩略图采样右上 40%×30% 区域（runtime 的 blur 保局部均值，缩略图即近似），采样失败保持空标签 fail-closed；换肤/调通透度/换壁纸/明暗切换都经既有预载监听自动重推。探针钩子结构化但探针本体在**桌面预载脚本**里、不在守卫扫描的运行时包内——预载重构会以视觉回归呈现，属无静态守卫的已知脆弱点。

## Consequences

- **侧栏/顶栏透明度语义修正**：effective α 从 `1-(1-α)²` 回到设计值 α——比 1.5.2 略透（meirenzhi 亮色 P=35：0.64→0.40），壁纸透出更多。「侧栏比内容区更实」的不变式保持（α_s > α_b 不变）；觉得偏透的用户上调 panelOpacity 即可，投影数学从此与所见一致。
- **缺口、顶栏、侧栏、右栏（本就无填充）四处涂层数恒等**，任意壁纸/模糊/明暗组合下不再出现花瓣。
- **官方皮肤零接触**：`official` 卸载全部皮肤样式标签，宿主不透明出画原样恢复。
- **上游风险**：AppFrame 局部名改版（`_frame`/`_sidebarCol` 消失或换名）时守卫在 `check` 阶段红牌；marker 更名同理。修复路径 = 重读宿主 dist 重导选择器。
- `tests/upstream-hooks.test.mjs` 钉住 bundle 内三条 shell 规则与两条探针规则恰好一次、无哈希钉死；`tests/runtime-effects.test.mjs` 钉住逐字块、随皮肤挂载/卸载、A→B 切换与 `official` 回退、N1 热更新存活，以及探针合成/构建器的纯函数金值。
- README/verified 文案仍按 10-10 计划 Task 7 纪律：等 Windows Desktop 实机验收通过后再动。
