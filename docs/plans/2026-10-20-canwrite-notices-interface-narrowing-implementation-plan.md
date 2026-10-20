# config-client 可写判定与保存失败呈现接口收窄实施计划

## 目标

- 把「能否写」与「保存失败如何呈现」两条领域规则收进 config-client 单一所有者：新增 `canWrite()`（布尔，吸收 recovery 维度）与 `notices`（失败生命周期唯一出口），面板退化为纯渲染。
- 消除已坐实的分歧：面板在 `panel.js:495` 自行推导 `status !== "synced" || mode === "recovery"` 补偿 client 自身闸门缺 recovery 维度的缺陷；三套「能否写」判定（client gate / panel 推导 / 服务端 `requireNormal`）收敛为「client 单一判定 + 服务端权威」。
- 删除只为测试活的接口成员：`writeBlocked`（生产零调用）、`retry`（双分支同义残迹）、`dirtyFields`（唯一生产消费被 `referencesFor` 吸收）。
- **行为零变化红线**：面板渲染逐像素不变；现存测试期望值除本计划 G0 例外清单逐条列出者外一律不改。

## 架构快照

- **接口形状（Consumes/Produces 的唯一权威定义）**：

```js
// createConfigClient() 返回的 api 成员变化
canWrite(): boolean          // = writeGate() === null；panel 的 disabled 与测试消费
referencesFor(assetId): Array // [{skinId, key, layer: "persisted"|"preview"}]
                             // 序：persisted 在前、preview 在后，不去重（对齐现 panel.js:243-248 拼接序；
                             // 条目字段以现 panel 消费的 state.references 条目字段为准，不新增）
− writeBlocked / − retry / − dirtyFields   // dirtyFields 逻辑转内部（作 referencesFor 的预览层来源）

// getState()（publicState）字段变化
notices: Array  // [{kind:"conflict"|"error"|"reverted", message?, fields?}]，每 kind 至多一条
                // conflict：无 message（面板渲染本地化文案，即现 panel.js:556-559 的 tr 路径）
                // error：message = 宿主原文（errorBody?.error ?? "HTTP <status>"，面板原样渲染）
                // reverted：fields = [{skinId, key}]（GLOSSARY「悬空预览」点名回退）
                // error 与 reverted 可共存（部分悬空批次：摘除记 reverted，剩余保脏记 error）
− lastFlushCode / − lastFlushError / − revertedFields

// 内部实现（不对外）
writeGate(): null | "loading" | "offline" | "unsupported" | "recovery"
  // gateWrites 演进而来：新增 recovery 维度（mode === "recovery" 时即使 status==="synced" 也拒绝）
  // 4 处内部闸门同源：flushNow(:209)、uploadImage(:485)、runGalleryOp(:561)、deleteImage(:612)
// 预拒绝返回词形（全部为既有词形，不发明新值）：
//   flushNow        → { flushed: 0, blocked: "recovery" }   （与 :268 途中发现的返回同词）
//   upload/delete/clear → { error: "recovery" }              （gallery 族既有 blocked 形状）
```

- **notices 清除时机（逐字保留现状，迁移为显式测试）**：
  - 任何编辑（`preview`/`previewReset`）清除 `conflict` 与 `error`（现 :388 与 :396 两处同语义，"a fresh edit always clears the failure strip"），**不清除** `reverted`；
  - 健康落盘清除全部（含 `reverted`，现 :330-331）；
  - `STORE_READONLY` 降级清除 `error` 并降级 status（现 :225-229 同族的恢复态处理 :267）。
- **不变区**：面板状态条（loading/offline-failed/unsupported-readonly/recovery 四态，`panel.js:522-551`）仍按 `status`/`mode` 渲染——那是状态展示不是可写性；panel 对 `mode`/`status` 的合法读取仅限状态条（含 :522 恢复分支），其余推导点（:476 acceptConfirm 闸门、:495 writesBlocked）全部改走 `canWrite()`；`dirtyCount` 保留在 `publicState`（预览层诚实观测量，测试正当窗口）；`state.recovery`/`confirmRecovery` 不动。
- **任务切分原则：纵向切片，每个 checkpoint 自洽**——每个任务同时完成「client 成员 + panel 对应接线点 + 两个测试假件 + 断言迁移」，任何 checkpoint 上真实 panel 与真实 client 配对可运行（2026-10-20 retro「checkpoint-lib 纪律」的同款精神，适用于 src 内部）。

## 全局约束

- **G0 例外（允许迁移/改写的测试，逐条穷尽）**：
  1. `tests/config-client.test.mjs`：① `writeBlocked` 4 断言（:51/:113/:126/:606）→ `canWrite` 布尔表述（reason 区分经 `state.status`/`state.mode` 直读）；② 三元组断言面清点（25 行，评审与执行双方独立清点核对一致）：`lastFlushCode` :362/:366/:387/:410/:429/:457/:478/:498，`lastFlushError` :363/:367/:388/:411/:430/:458/:479/:499/:529/:531/:977/:1015/:1039，`revertedFields` :975/:987/:1014/:1038 → `notices` 等价表述（:434 互斥测试随之迁移；:520 测试名含 `lastFlushError` 字样，改名许可——测试名非期望值）；③ `dirtyFields` 测试 :1064-1070 → 迁移为 `referencesFor` 的「仅含有值预览」断言（同字段 set 后 reset 的消退路径，归 Task 4）。
  2. `tests/write-dialect.test.mjs`：:141/:151 `revertedFields`、:143 `lastFlushError` → `notices` 等价表述（:144 `dirtyCount` 断言保留不动）。
  3. `tests/personalization-panel.test.mjs`：假件 :36（`calls.retry` → `calls.refetch` 计数）、:53/:54（`lastFlushError: null` 维护**替换为** notices 维护——假件侧仅落「编辑清 conflict/error」；「健康落盘清全部」在假件无动作点，由 config-client.test 侧覆盖）、:55-57（`dirtyFields` → `referencesFor`）、:59（`retry` → `refetch`）；state 塞三元组 :517/:518/:531/:532/:548/:797/:806 → notices 等价；测试名 :542 含 `lastFlushError` 字样可改名；失败条/点名条/disabled/重试按钮断言改经新接口，期望文案串不变（按钮在场断言如 :155 `personalization.status.retry` 键名不动）；文件头注释 :8 的 `lastFlushError` 字样不属 G0 管辖（非断言非期望值，改否随意）。
  4. `tests/sidebar-switcher.test.mjs`：假件 :49-59 增 `canWrite: () => true`、`notices: []` 状态、空 `referencesFor`；:61 `retry: () => {}` 撤除。
  - 除上述外，现存测试期望值禁止修改；实现中发现必须改未列测试 → 停下说明，不猜。
- 命名沿用 GLOSSARY：「悬空预览」「恢复模式」「Host 错误文案」；不发明新领域词。
- 单批次落地：全部任务同一变更序列，任务序执行，每任务验证绿才进下一任务。
- 构建类命令（esbuild spawn）在 danger-full-access 会话执行；`verify:hooks` 无本地 runtime 时打印 `upstream-hooks: SKIPPED` 属正常降级（ADR-0011）。
- checkpoint 纪律：凡触碰 `src/` 的 checkpoint 一并提交重建后的 `lib/`（developers.md「发版」节第 6 条）。
- 版本与发版：本计划**不 bump 版本、不发版**——纯内部接口收窄、行为零变化，随下一个自然 1.5.x 发版搭车。
- 聚焦测试命令：`node --test tests/<file>`（直测 src，无需构建）；全量以 `pnpm run test` / `pnpm run check` 为准。
- 判据写法约定：grep 零命中判据一律写 `! grep -n … <file>`（grep 计 0 时 exit 1，禁入 `&&` 链）；对目录一律 `grep -rn`（无 -r 对目录 exit 2，判据失效）。

## 输入工件

- 共识记录（2026-10-20 grill-with-docs，16 项裁决全落定）：本计划即其实现，无独立设计文档。
- `GLOSSARY.md`：「恢复模式」词条已入表（2026-10-20）。
- `docs/adr/0003-auto-save-on-change.md`（accepted，已有一则 2026-09-01 修正案先例）。
- 代码事实基线：`src/client/personalization/config-client.js`（gateWrites :178-183、失败三变量 :64-66、setFlushFailure :69-72、闸门 4 处 :209/:485/:561/:612、api :648-678、publicState 尾部）、`src/client/personalization/panel.js`（:237-248/:495/:522-551/:543/:556-578）。

## 文件结构与职责

- Modify: `src/client/personalization/config-client.js` —— `writeGate` 吸收 recovery、`canWrite`/`referencesFor` 上 api、notices 替代三元组、`writeBlocked`/`retry`/`dirtyFields` 下架。
- Modify: `src/client/personalization/panel.js` —— `writesBlocked` 与 `acceptConfirm` 接受闸门改 `configClient.canWrite()`、失败/点名条改读 `state.notices`、离线重试按钮改 `refetch()`、确认对话框引用列表改 `referencesFor`（共五个接线点：:476/:495/:543/:556-578/:237-248）。
- Test: `tests/config-client.test.mjs` —— Task 1 围栏 + 各任务新断言与迁移。
- Test: `tests/write-dialect.test.mjs` —— 三元组断言迁移（Task 3）。
- Test: `tests/personalization-panel.test.mjs` —— 假件分步改造 + 三 kind 渲染/disabled 传导/重试按钮断言。
- Test: `tests/sidebar-switcher.test.mjs` —— 假件分步补齐。
- Modify: `docs/adr/0003-auto-save-on-change.md` —— Amendments 增补一则。
- 产物: `lib/client.js`（构建再生，随 checkpoint 提交，不手编）。

## 任务清单

### Task 1: 绿色围栏——用现行字段钉住必须存活的语义

- 目标：在动任何实现前，把 notices 要逐字继承的三个生命周期转换与两族预拒绝词形写成**对现状代码即通过**的测试。
- 涉及文件：`tests/config-client.test.mjs`
- 接口契约
  - Consumes：现行 `lastFlushCode`/`lastFlushError`/`revertedFields`、`flushNow`/`deleteImage` 返回形状。
  - Produces：围栏测试五条（Task 3 机械迁移到 notices 表述）：① 编辑清除 conflict/error 但保留 revertedFields；② 健康落盘清除全部（含 revertedFields）；③ STORE_READONLY 降级清除 error；④ offline 预拒绝 `flushNow → {flushed:0, blocked:"offline"}` 且零 PATCH（既有测试已覆盖则核对不重写）；⑤ offline 预拒绝 `deleteImage → {error:"offline"}` 且零 PATCH。
- 验证范围：围栏测试全部通过；不触碰 src。

- [ ] Step 1: 写围栏测试（③ 需构造 409 `STORE_READONLY`；①② 复用既有悬空批次造法，参照 `write-dialect.test.mjs:119-154` 与 `config-client.test.mjs:434` 的 fetch 桩模式）
- [ ] Step 2: Run: `node --test tests/config-client.test.mjs`
- [ ] Expected: 全部通过（含新增）。任何一条失败 = 对现状语义理解有误，停下修正认知而非测试。

### Task 2: canWrite 纵向切片——单一可写判定 + panel disabled 接线

- 目标：`writeGate` 吸收 recovery；对外暴露布尔 `canWrite()`；4 处内部闸门改走 `writeGate`；下架 `writeBlocked` 与 `retry`（panel 重试按钮同 checkpoint 改指 `refetch`，保持配对自洽）；panel 三处可写性接线点全部改走 `canWrite()`——:495 `writesBlocked`、:476 `acceptConfirm` 闸门（现 `current.status === "synced" && current.mode !== "recovery"` 正向推导，与 canWrite 判定式逐字同源）、:543 重试按钮。
- 涉及文件：`src/client/personalization/config-client.js`、`src/client/personalization/panel.js`（:476/:495/:543 三个接线点）、`tests/config-client.test.mjs`、`tests/personalization-panel.test.mjs`、`tests/sidebar-switcher.test.mjs`
- 接口契约
  - Consumes：Task 1 围栏（闸门行为不变的部分）。
  - Produces：`canWrite(): boolean` api 成员；`writeGate()` 内部函数（null | "loading" | "offline" | "unsupported" | "recovery"）；预拒绝词形 `{flushed:0, blocked:"recovery"}` / `{error:"recovery"}`；panel 三接线点改毕。
- 验证范围：recovery+synced 下全族预拒绝零网络；reason 断言经 state 直读；panel disabled 传导与重试按钮经新接线。

- [ ] Step 1: 写失败测试（config-client 侧）：`synced+mode:"recovery"` → `canWrite()===false`、`flushNow()` → `{flushed:0, blocked:"recovery"}`、`deleteImage()`/`clearLibrary()`/`uploadImage()` → `{error:"recovery"}`（fetch 桩断言零请求）；`loading`/`offline-failed`/`unsupported-readonly` → `canWrite()===false`；`synced+normal` → `true`
- [ ] Step 2: Run: `node --test tests/config-client.test.mjs`
- [ ] Expected: 新测试失败（canWrite 不存在、recovery 不预拒绝），既有全绿。
- [ ] Step 3: 实现 client——`gateWrites` 改名 `writeGate` 并增 recovery 分支；api 增 `canWrite: () => writeGate() === null`、删 `writeBlocked` 与 `retry`；迁移 :51/:113/:126/:606 四断言（布尔 + reason 经 `state.status`/`state.mode` 直读）
- [ ] Step 4: 实现 panel 接线——:495 `writesBlocked = configClient.canWrite()`；:476 `acceptConfirm` 闸门改 `if (configClient.canWrite())`（行为等价：与现条件式逐字同源）；:543 重试按钮 `onClick` 改 `configClient.refetch()`；新增一条 panel 测试钉住 :476 接线（`canWrite()===false` 时确认对话框接受被闸住、`confirmation.accept` 不调用——现状无此直接断言，补测消除保护缺口）；两个假件同步（panel.test 假件 `calls.retry` → `calls.refetch` 计数、增 `canWrite`；sidebar-switcher 假件增 `canWrite: () => true` 并撤 :61 `retry`），重试按钮与 disabled 相关断言改经新接线（期望文案不变）
- [ ] Step 5: Run: `node --test tests/config-client.test.mjs tests/personalization-panel.test.mjs tests/sidebar-switcher.test.mjs`
- [ ] Expected: 全绿；`! grep -rn "writeBlocked" src/` 通过（零命中）；`! grep -n "configClient.retry\|retry:" src/client/personalization/panel.js` 通过。
- [ ] Step 6: checkpoint commit（src + 重建 lib + 测试一并；`refactor(client): canWrite absorbs recovery — single write gate, panel wired`）

### Task 3: notices 纵向切片——失败生命周期单一出口 + panel 失败条接线

- 目标：内部失败状态从三变量改为 notices 数组（每 kind 至多一条），`publicState` 三元组下架、`notices` 上架；panel 失败/点名条改读 `state.notices`（渲染顺序 conflict → error → reverted，视觉与现状一致）。
- 涉及文件：`src/client/personalization/config-client.js`、`src/client/personalization/panel.js`（:556-578 区块）、`tests/config-client.test.mjs`、`tests/write-dialect.test.mjs`、`tests/personalization-panel.test.mjs`、`tests/sidebar-switcher.test.mjs`
- 接口契约
  - Consumes：Task 1 围栏三转换（机械迁移）；Task 2 `writeGate`。
  - Produces：`getState().notices: [{kind, message?, fields?}]`（形状与清除时机见架构快照）；panel 经 notices 渲染三 kind（conflict 出本地化文案、error 原样 message、reverted 列 fields 点名）。
- 验证范围：三转换在 notices 上逐条复现；`error+reverted` 共存与 kind 唯一性；`publicState` 无三元组；panel 三 kind 渲染文案与现状逐字一致。

- [ ] Step 1: 迁移围栏测试①②③到 notices 表述，并新增：部分悬空批次 → 同一时刻 `error` 与 `reverted` 并存；每 kind 至多一条（conflict 与 error 互斥）
- [ ] Step 2: Run: `node --test tests/config-client.test.mjs`
- [ ] Expected: 迁移后测试失败（notices 不存在）。
- [ ] Step 3: 实现 client——三变量（:64-66）替换为 notices 数组与写入/清除辅助；`setFlushFailure` 演进（conflict 无 message、error 带宿主原文）；reverted 写入改为 notice fields；编辑清除辅助统一接管 :388（preview）与 :396（previewReset）两处；`publicState` 输出 `notices`、删三元组；write-dialect :141/:143/:151 断言迁移
- [ ] Step 4: 实现 panel 接线——:556-578 区块改读 `state.notices` 按 kind 渲染（顺序与视觉不变）；假件同步（panel.test 假 state 增 `notices` 字段、:53/:54 的 `lastFlushError: null` 维护**替换为** notices 维护——编辑清 conflict/error、健康落盘清全部，与清除时机对齐；sidebar-switcher 假 state 增 `notices: []`），渲染断言期望串不变
- [ ] Step 5: Run: `node --test tests/config-client.test.mjs tests/write-dialect.test.mjs tests/personalization-panel.test.mjs tests/sidebar-switcher.test.mjs`
- [ ] Expected: 全绿；`! grep -rn "lastFlushCode\|lastFlushError\|revertedFields" src/client/` 通过（零命中）。
- [ ] Step 6: checkpoint commit（`refactor(client): notices own the flush-failure lifecycle, panel renders`）

### Task 4: referencesFor 纵向切片——引用单源 + panel 确认对话框接线

- 目标：图库确认对话框的「持久引用 + 预览层引用」两源拼装下沉为 client 成员 `referencesFor(assetId)`；`dirtyFields` 下架。
- 涉及文件：`src/client/personalization/config-client.js`、`src/client/personalization/panel.js`（:237-248 区块）、`tests/config-client.test.mjs`、`tests/personalization-panel.test.mjs`、`tests/sidebar-switcher.test.mjs`
- 接口契约
  - Consumes：`snapshot.references`（持久层）、内部预览层（原 `dirtyFields` 逻辑）。
  - Produces：`referencesFor(assetId): [{skinId, key, layer: "persisted"|"preview"}]`（persisted 在前、不去重）；panel 确认对话框经它列双层引用（layer=preview 条目带「预览」标记文案，键沿用现 tr 路径）。
- 验证范围：仅持久、仅预览、两者并存（同字段两层时两条都出）三种返回与顺序；api 无 `dirtyFields`；对话框断言期望文案不变。

- [ ] Step 1: 写失败测试（config-client 侧三形态 + 顺序断言）
- [ ] Step 2: Run: `node --test tests/config-client.test.mjs`
- [ ] Expected: 新测试失败。
- [ ] Step 3: 实现 client——`referencesFor` 上 api（预览层来源内化原 dirtyFields 逻辑，仅含有值预览）、api 删 `dirtyFields`；:1064-1070 dirtyFields 测试同步迁移为 referencesFor「仅含有值预览」断言（同字段 set 后 reset 的消退路径）
- [ ] Step 4: 实现 panel 接线——:237-248 区块改用 `configClient.referencesFor(asset.id)` 拼确认列表；假件同步（panel.test 假件 `dirtyFields` → `referencesFor`；sidebar-switcher 假件补空实现），对话框断言期望串不变
- [ ] Step 5: Run: `node --test tests/config-client.test.mjs tests/personalization-panel.test.mjs tests/sidebar-switcher.test.mjs`
- [ ] Expected: 全绿；`! sed -n '/const api = {/,/^  };/p' src/client/personalization/config-client.js | grep -n "dirtyFields"` 通过（管道零命中取反）。
- [ ] Step 6: checkpoint commit（`refactor(client): referencesFor merges persisted and preview references`）

### Task 5: ADR-0003 修正案、全量门禁与收尾

- 目标：裁决留痕；全量验证；重建产物随检入；验收 grep 门。
- 涉及文件：`docs/adr/0003-auto-save-on-change.md`、`lib/`（构建再生）
- 接口契约
  - Consumes：Task 2-4 全部产物。
  - Produces: ADR-0003 Amendments 新增一则（措辞见 Step 1）；全绿门禁。
- 验证范围：`pnpm run check` 全绿（含 lib-sync：src 与 lib 同 commit 自洽）；验收 grep 门四条零命中。

- [ ] Step 1: ADR-0003 `## Amendments` 追加（日期 2026-10-20）：「客户端可写判定与保存失败呈现收窄为单一出口——`canWrite()`（`status==="synced" && mode!=="recovery"`，内部写闸门同源、recovery 预拒绝）与 `notices`（`{kind:"conflict"|"error"|"reverted", message?, fields?}[]`，每 kind 至多一条，`error` 与 `reverted` 可共存）。`lastFlushCode`/`lastFlushError`/`revertedFields` 三字段与 `writeBlocked`/`retry`/`dirtyFields` 成员退出对外接口；面板不再自行推导可写性（此前面板补偿了 client 闸门缺失的 recovery 维度）。清除时机逐字保留：编辑清 conflict/error，健康落盘清全部，STORE_READONLY 降级清 error。行为零变化，面板渲染逐像素不变。」
- [ ] Step 2: Run: `pnpm run build && git add lib/`
- [ ] Expected: lib 再生且暂存（checkpoint 纪律：src 与 lib 同检入）。
- [ ] Step 3: Run: `pnpm run check`
- [ ] Expected: 全绿（`upstream-hooks: SKIPPED` 亦算通过；lib-sync 零差异说明产物已随检入）。
- [ ] Step 4: 验收 grep 门四组全通过（写法依「判据写法约定」取反零命中；对目录一律 -rn）：
  1. panel 可写性推导清零（正反两式全覆盖）：`! grep -n 'status === "synced"' src/client/personalization/panel.js`；`! grep -n 'status !== "synced"' src/client/personalization/panel.js`；`! grep -n 'mode !== "recovery"' src/client/personalization/panel.js`；`[ "$(grep -c 'mode === "recovery"' src/client/personalization/panel.js)" = "1" ]`（唯一合法残存 = 状态条恢复分支）
  2. `! grep -rn "lastFlushCode\|lastFlushError\|revertedFields" src/client/`
  3. `! sed -n '/const api = {/,/^  };/p' src/client/personalization/config-client.js | grep -n "writeBlocked\|retry\|dirtyFields"`
  4. `! grep -rn "configClient.retry\|configClient.dirtyFields" src/`
- [ ] Step 5: 收尾 commit（`docs(adr): ADR-0003 amendment — canWrite/notices interface narrowing`），输出修改摘要

## 执行纪律

- 开始实现前，先批判性复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划。
- 按任务顺序执行，不无声跳步、合并步或改变任务目标。
- 每完成一个任务，运行该任务定义的验证；红灯即停。
- G0 例外清单之外的现存测试若需要修改，立即停下说明，不猜。
- 当前在 `main`/`master` 上工作前，先与主人确认分支策略。
- 全部任务完成后，运行最终验证并输出修改摘要。

## 最终验证

- Run: `pnpm run check`
- Expected: 全链绿（build + smoke + 全部单测 + README 配对 + bundle 守卫 + 上游钩子守卫[SKIPPED 可] + lib-sync 零差异）。
- 验收 grep 门四组通过（Task 5 Step 4；含 panel 推导清零的正反两式全覆盖判据）。
- 修改摘要覆盖：api 成员增删、publicState 字段增删、panel 五个接线点（:476/:495/:543/:556-578/:237-248）、测试迁移清单、ADR/GLOSSARY 留痕。
- 明确非目标（不做）：版本 bump 与发版（随下一个自然 1.5.x）；flush 错误稳定码本地化改造；`revisionedPatch` 共享核（H2 后续任务）。
