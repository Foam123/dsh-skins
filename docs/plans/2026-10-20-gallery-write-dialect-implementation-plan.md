# 图库写并入修订号写方言实施计划

## 目标

- 按 ADR-0015 落地：PATCH 操作词汇扩为 `set | delete | deleteAsset | clearLibrary`，图库删除携带前置条件、清空图库单次提交；`INVALID_CONFIG` 响应携带结构化 `issues`，客户端对悬空类预览点名摘除并回退；上传成功本地合并 + 上传自动应用的预览立即 flush。
- 混版宽容：旧式 `DELETE /library/{id}` 路由保留为兼容适配器，无前置条件 = 今日语义。
- 行为变化封闭在 ADR-0015 裁定项内；未列出的现有测试期望值一律不改。

## 架构快照

- **op 词汇与协议形状**（Consumes/Produces 的唯一权威定义）：

```js
// PATCH /dsh-skins/config body.operations（数组，1–64 条，沿现行上限）
{ op: "set" | "delete", skinId, key, value? }   // 现行字段操作，不变
{ op: "deleteAsset", assetId }                   // 新：删资产 + 清引用，参与前置条件
{ op: "clearLibrary" }                           // 新：清空图库（服务端展开，1 条 op 不受资产数限制）

// 响应 200
{ revision }                         // 纯字段批（现状不变）
{ revision, affectedSkins? }         // affectedSkins: [{skinId, key}]，gallery op 在场时必带
                                     // （复用 DELETE 路由现有形状）

// 响应 400 INVALID_CONFIG（增量、向后兼容；复用 codedError→publicError 既有 params 通道，
// host 序列化面零改动；字段 op 失败保留 params.code 并新增 params.issues，老读者零影响）
{ error, code: "INVALID_CONFIG",
  params: { issues: [{ opIndex, skinId?, key?, assetId?, code }] } }  // 字段 op 带 skinId/key；
                                                             // deleteAsset op 带 assetId；
                                                             // code 复用 MISSING_ASSET/BAD_ASSET/
                                                             // BAD_VALUE/…，新增 ASSET_NOT_FOUND
                                                             // （deleteAsset 目标不存在）、
                                                             // INVALID_ASSET_ID（assetId 形状非法，
                                                             // 复用既有词汇）与 INVALID_OP（未知 op）
```

- **store 内部**：抽共享的 `applyGalleryDelete(draft, id)`（返回 affectedSkins），`applyOperations` 的 op 分派与兼容路由包装 `deleteAsset` 都走它；`clearLibrary` 遍历 draft.library 一次成型、单次 commit、修订号 +1。全部在既有串行队列与 `baseRevision` 前置条件内。
- **同批次序语义**：所有 op 先对批前状态校验、再按数组序应用；`set X` 后跟 `deleteAsset X` 终态为字段回退，无悬空。
- **config-client**：`deleteImage`/`clearLibrary` 改发 PATCH op，且与 flush 同走 `writeChain` 串行化（消除挂起防抖 flush 与删除操作的同标签 baseRevision 自伤）。冲突语义（409 `REVISION_CONFLICT`）→ refetch → 资产已不在 → 静默成功 `{affectedSkins: []}`（B2）；仍在 → 以新 baseRevision 重试一次；耗尽 → 具名错误。400 `ASSET_NOT_FOUND` 同样 refetch → 已不在 → 静默成功。400 带 `params.issues` 时，悬空类（`MISSING_ASSET`、`BAD_ASSET`）预览**摘除**并记入 `publicState().revertedFields`（面板点名用，下次成功 flush 清空），其余错误类预览保脏 + 具名报错（现状语义）；批内**只有**悬空类时不置 `lastFlushError`（点名条独立呈现，不叠失败条）；摘除后经 writeChain 再入队**自动续 flush** 残余脏预览（有界：每次续跑要么再摘 ≥1 条、要么止于非悬空具名错误）。面板经新导出 `dirtyFields()`（→ `[{skinId, key, value}]`，仅非 null 预览）枚举预览层引用。
- **两项捎带**：上传成功响应含 `{asset, revision}`，客户端本地合并（library push、quota 增量、revision 对齐，**不再 GET /config**）；上传自动应用的预览由面板在 `onValue` 后立即 `flushNow()`（仅上传路径，普通编辑仍走 400ms 合并窗）。
- **面板**：删除确认对话框同时列持久化引用（`state.references`）与预览层引用（`effectiveOverrides` 与 `snapshot.skins` 的差集中等于该资产 id 的壁纸字段）；悬空摘除渲染「壁纸已失效，已回退」点名条。

## 全局约束

- fail-closed 贯穿：未知 op、未知 issue code 不静默；op 词汇白名单测试钉住（ADR-0014 同款「动构造点必须显式」）。
- 修订号保持单一计数器：一切状态提交 +1（现行上传/删除已如此，零改动）。
- G0 例外（允许修改/改写的现有测试，逐条列出、均留痕）：① `tests/config-client.test.mjs` 中 `deleteImage` 的 fetch 序列期望从 `DELETE /library/{id}` 改为 `PATCH /config`；② `tests/personalization-panel.test.mjs` 三条——`:332-362`（循环删除+首错即停的主题被单 op 语义取代，整条改写为单次 op 断言）、`:364-375`（换 `clearLibrary` 桩）、`:377-393`（cleared 序列断言改走 `clearLibrary()`）。B14 读法：其枚举的「唯一 G0 例外」指 fetch 序列一类；panel 三条属 B14 首句「ADR-0015 裁定项许可的行为变更」直接覆盖的测试改写，不构成基线外漂移。除上述外现存测试期望值禁止修改。
- 命名沿用 GLOSSARY：「悬空预览」「修订号」「清空图库」；新增 dict 键 zh/en 双语成对。
- 单批次落地：全部任务同一 PR，任务序执行，每任务验证绿才进下一任务。
- 构建类命令（esbuild spawn）在 danger-full-access 会话执行；`pnpm run check` 的 `verify:hooks` 本机默认 `~/.local/share/dsh-runtime` 即活 runtime，无 runtime 时打印 `upstream-hooks: SKIPPED` 属正常降级。
- 发版：独立正式版本（建议 **1.6.0**，协议增量 + 行为变化超出 patch 级），流程按 `docs/developers.md`「发版」节。

## 输入工件

- `docs/adr/0015-gallery-writes-join-revision-dialect.md`（accepted）
- `GLOSSARY.md`（「修订号」已改写、「悬空预览」已新增）
- 代码事实基线：`src/host/personalization/store.js`、`src/host/personalization-routes.js`、`src/client/personalization/config-client.js`、`src/client/personalization/panel.js`、`src/shared/personalization/catalog.js`（validateOverride 的 code 词汇）、`src/client/dicts.js`

## 文件结构与职责

- Modify: `src/host/personalization/store.js` —— op 分派、`applyGalleryDelete` 共享抽取、`clearLibrary`、issues 聚合、PATCH 响应带 `affectedSkins`；`deleteAsset` 保留为兼容薄包装（无前置条件）
- Modify: `src/client/personalization/config-client.js` —— `deleteImage`/`clearLibrary` 改 PATCH op；issues 摘除机（`revertedFields`）；上传本地合并；`flushNow` 400 处理扩展
- Modify: `src/client/personalization/panel.js` —— 确认对话框预览层引用；悬空点名条；上传路径 `onValue` 后 `flushNow()`；清空图库走单 op
- Modify: `src/client/dicts.js` —— 新键（悬空回退点名、确认对话框预览引用前缀）
- Modify: `src/host/personalization-routes.js` —— **预期零改动**（PATCH body 透传、DELETE 路由不动）；若实现中发现必须动，停下说明
- Modify: `tests/personalization-store.test.mjs`、`tests/config-client.test.mjs`、`tests/personalization-routes.test.mjs`、`tests/personalization-panel.test.mjs` —— 各任务新增用例
- Create: `tests/write-dialect.test.mjs` —— 跨缝集成（真 store + 挂载路由 + fetch 桥接的真 configClient）
- Modify: `docs/developers.md` —— 写路径章节补 ADR-0015 语义
- 边界不动：`catalog.js` 字段与校验词汇、`projector.js`/SkinEffects、`atomic-write.js`、修订号计数语义、上传路由与豁免

## 任务清单

### Task 1: 绿色围栏——钉住必须不变的行为（对现状代码写通过测试）

- 目标：改动前把「混版宽容」与协议现状钉死，全程常绿。
- 涉及文件：`tests/personalization-routes.test.mjs`
- 接口契约
  - Consumes：`mountPersonalizationRoutes(host, {store, trustedHosts})` + 真 store（现有 `makeRequest`/`makeResponse`/`TRUSTED` 脚手架）
  - Produces：两枚围栏用例——① `DELETE /library/{id}` 无任何前置条件头，成功返回 `{revision, affectedSkins}` 且 revision 前进 1；② `PATCH /config` 未知 op（如 `op:"nuke"`）返回 400 `INVALID_CONFIG`
- Steps
  1. 新增用例①：真 store 上传一张图（POST /library），再 DELETE，断言响应形状与 `state.json` 落盘一致。
  2. 新增用例②：PATCH 未知 op，断言 400 与 `code`。
- 验证：`node --test tests/personalization-routes.test.mjs` 全绿（对未改动代码）。

### Task 2: store——gallery op 词汇、issues 聚合与单次提交

- 目标：`applyOperations` 支持 `deleteAsset`/`clearLibrary`；400 带结构化 issues；gallery op 在场时响应带 `affectedSkins`；兼容 `deleteAsset` 包装复用共享抽取。
- 涉及文件：`src/host/personalization/store.js`、`tests/personalization-store.test.mjs`
- 接口契约
  - Consumes：Task 1 的协议形状；`validateOverride` 既有 code 词汇
  - Produces：
    - `applyGalleryDelete(draft, id)`（内部函数）→ `affectedSkins` 数组
    - `applyOperations({baseRevision, operations})` 接受四种 op；失败抛 `codedError("INVALID_CONFIG", …, { issues })`（第三参经 `publicError` 落为响应体 `params.issues`，routes/errors 零改动）
    - op 白名单：未知 op 的 issue `{opIndex, code:"INVALID_OP"}`
- Steps
  1. 写失败测试：deleteAsset op 过期 baseRevision → `REVISION_CONFLICT`（409 路径不变）。
  2. 写失败测试：deleteAsset op 目标不存在 → 400 `INVALID_CONFIG` + `params.issues:[{opIndex, assetId, code:"ASSET_NOT_FOUND"}]`，整批零落盘。
  2b. 写失败测试：deleteAsset op 的 assetId 形状非法（不匹配 `ASSET_ID_PATTERN`）→ 400 + `params.issues:[{opIndex, assetId, code:"INVALID_ASSET_ID"}]`（复用既有词汇；客户端 HOST_ERROR_KEYS 未映射该码 → 回退通用文案，与今日 DELETE 路由返回 INVALID_ASSET_ID 时同构，不新增映射条目），整批零落盘。
  3. 写失败测试：clearLibrary op 在含 2 资产、1 字段引用的库上 → 单次 commit、revision +1、`affectedSkins` 列出回退字段、blob 全删；空库上再发一次 → 成功幂等。
  3b. 写失败测试（验收③组合用例）：同批 `clearLibrary` + `deleteAsset`（不存在 id）→ 整批拒绝、零落盘、零删除（含 blob 不删）。
  4. 写失败测试：混批 `set wallpaper=X` + `deleteAsset X` → 先设后清，终态字段回退、无悬空。
  5. 写失败测试：字段校验失败（`BAD_VALUE`）→ `params.code` 与 `params.issues:[{opIndex, skinId, key, code:"BAD_VALUE"}]` 并存（老读者零影响）。
  6. 实现：op 分派 + `applyGalleryDelete` 抽取 + issues 聚合 + 响应 `affectedSkins`；`deleteAsset` 包装改为调共享抽取（行为不变）。
  7. op 白名单测试：四种合法 op 之外一律 400。
- 验证：`node --test tests/personalization-store.test.mjs` 全绿；Task 1 围栏仍绿。

### Task 3: 路由缝——新 op 穿透真实 HTTP 与 issues 透传

- 目标：证明路由层与错误序列化零改动即支持新方言；`params.issues` 出现在 HTTP 响应体。
- 涉及文件：`tests/personalization-routes.test.mjs`
- 接口契约
  - Consumes：Task 2 的 store 行为
  - Produces：PATCH（含 deleteAsset/clearLibrary）经真实路由的 200/400 形状用例；`publicError` 对 `error.params.issues` 的既有透传断言（`src/host/errors.js:32-39`：`params` 全量透传，预期零改动）
- Steps
  1. 路由级用例：PATCH deleteAsset 成功 → 200 `{revision, affectedSkins}`；PATCH clearLibrary 幂等；PATCH 非法 deleteAsset → 400 体含 `params.issues`。
  2. 确认 `personalization-routes.js` 与 `errors.js` 均无需改动；若需要，停下按「计划与仓库现实不符」上报。
- 验证：`node --test tests/personalization-routes.test.mjs tests/personalization-store.test.mjs` 全绿。

### Task 4: config-client——新方言、悬空摘除与上传本地合并

- 目标：客户端改说 PATCH 方言；悬空预览点名摘除；上传成功免 refetch。
- 涉及文件：`src/client/personalization/config-client.js`、`tests/config-client.test.mjs`
- 接口契约
  - Consumes：Task 3 的 HTTP 形状
  - Produces：
    - `deleteImage(id)`/`clearLibrary()` → PATCH op，经 `writeChain` 串行化（与 flush 同链，消除挂起防抖 flush 与删除的同标签 baseRevision 自伤）；409 `REVISION_CONFLICT` → refetch → 资产已不在 → `{affectedSkins: []}` 静默成功（B2）／仍在 → 新 baseRevision 重试一次 → 耗尽具名错误；400 `ASSET_NOT_FOUND` → refetch → 已不在 → 静默成功、仍在 → 具名错误；**成功路径**：200 后仍 `refetch()` + `announce()`（今日行为不变——删除改写服务端算得的 references，不能本地合并，与上传的纯追加不对称；网格单元格移除依赖该 refetch，见 panel.js:219-221 注释）。G0 例外①的序列改动仅方法一行，其余成员不变。
    - `dirtyFields()` → `[{skinId, key, value}]`（仅非 null 预览；面板枚举预览层引用的缝）
    - `publicState()` 增 `revertedFields: [{skinId, key}]`（悬空摘除时置位并 emit；下次成功 flush 清空）
    - `flushNow` 400 分支：体含 `params.issues` 时，对 `code ∈ {MISSING_ASSET, BAD_ASSET}` 且带 `skinId/key` 的项 `previews.delete` + 记入 `revertedFields`；其余项保脏 + `lastFlushError` 具名；批内仅悬空类时**不置** `lastFlushError`（点名条独立呈现，不叠失败条）；摘除后经 writeChain 再入队自动续 flush 残余脏预览（有界）
    - `concludeUpload` 成功路径：本地合并 `asset` 进 `snapshot.library`、quota 增量、`snapshot.revision = body.revision`，**不再 GET /config**，仍 `announce()`
- Steps
  1. 写失败测试：deleteImage 走 PATCH（G0 例外①：改既有 DELETE 序列期望）；ASSET_NOT_FOUND 静默成功路径。
  1b. 写失败测试（验收①客户端半边）：deleteImage 撞 409（baseRevision 过期）→ refetch → 资产已不在 → `{affectedSkins: []}` 静默成功；仍在 → 新 baseRevision 重试一次成功；重试再撞 409 → 具名错误。clearLibrary 冲突路径同构一条。
  2. 写失败测试：flush 撞 400 体 `params.issues:[{opIndex, skinId, key, code:"MISSING_ASSET"}]` → 该预览被摘、`revertedFields` 置位、其余预览保脏；下次 flush（无毒丸）成功且 `revertedFields` 清空。
  2b. 写失败测试：批内**仅**悬空 issue → `lastFlushError` 为空、`revertedFields` 置位；摘除后**自动续 flush** 残余预览（无用户编辑介入）成功、`revertedFields` 清空。
  3. 写失败测试：`BAD_VALUE` issue → 预览保脏 + 具名错误（不摘）。
  4. 写失败测试：上传成功后 fetch 调用序列为 `[POST /library]`，无 `/config` GET；`getState().library` 含新资产、revision 对齐。
  5. 实现上述四组行为。
- 验证：`node --test tests/config-client.test.mjs` 全绿。

### Task 5: 面板与词典——点名条、预览引用确认、立即 flush

- 目标：UI 侧消费新语义。
- 涉及文件：`src/client/personalization/panel.js`、`src/client/dicts.js`、`tests/personalization-panel.test.mjs`
- 接口契约
  - Consumes：Task 4 的 `revertedFields`/`clearLibrary`/`deleteImage`/`dirtyFields`
  - Produces：dict 新键 `personalization.fieldReverted`（zh「壁纸已失效，已回退默认」/ en "Wallpaper no longer exists; reset to default"）、`personalization.library.previewRef`（确认对话框预览引用标记）；面板点名条渲染 `state.revertedFields`；删除确认对话框列预览层引用；单/批量上传 `onValue` 后 `await configClient.flushNow()`；清空图库走 `configClient.clearLibrary()`
- Steps
  1. 写失败测试：`revertedFields` 非空 → 点名条渲染对应皮肤/字段；为空 → 不渲染。点名条复用既有 footer strip 槽位与 `.dsh-skins-pz-status`/`.dsh-skins-pz-warn`/`.dsh-skins-pz-muted` 类，**零新增 PANEL_CSS 规则**（`tests/personalization-panel.test.mjs:742` 的 59 行 ratchet 保持不动）。
  2. 写失败测试：预览层引用被删资产的字段（经 `configClient.dirtyFields()` 过滤 `value === asset.id`）出现在删除确认列表（带预览标记文案）；用例含一条**跨皮肤**预览引用；清空图库确认**同样**列出预览层引用（用户知情面与单删一致）。
  3. 写失败测试：上传成功路径触发 `flushNow`（fake configClient 断言调用）。
  4. 实现面板与 dict 改动；清空图库确认后改调 `clearLibrary()`（移除 N 次循环删除）；按 G0 例外②改写 panel 既有三条用例（:332-362 整条改写为单次 op 断言、:364-375 换 `clearLibrary` 桩、:377-393 改走 `clearLibrary()`）。
- 验证：`node --test tests/personalization-panel.test.mjs` 全绿。

### Task 6: 跨缝集成——真 store × 真 client 全链路（ADR-0015 验收 ②⑤）

- 目标：补上「两侧互相 mock」的盲区，走真 HTTP 语义。
- 涉及文件：`tests/write-dialect.test.mjs`（新建）
- 接口契约
  - Consumes：真 `createPersonalizationStore`（tmpdir + REAL_FS，沿 store 测试脚手架）+ `mountPersonalizationRoutes` + fetch 桥（把 `URL/method/headers/body` 翻译成 `makeRequest` 打到路由、路由的 `writeHead/end` 包成 Response-like）；真 `createConfigClient({fetchImpl: 桥})`
  - Produces：场景② 悬空预览全链路（预览壁纸 → 路由层直接删资产模拟另端 → flush 400 issues → 预览摘除回退 → 再改标语 flush 成功）与场景⑤ 上传→自动应用→立即 flush 的端到端断言
- Steps
  1. 搭 fetch 桥（约 40 行，本文件内自含）。
  2. 场景②用例：断言 `revertedFields` 点名、后续 flush 成功、服务端终态字段回退。
  3. 场景⑤用例：fetch 序列钉为 `POST /library` → `PATCH /config` → `GET /config`（flush 成功 resync 属 config-client.js:286-295 现状行为，**保留不得删**）；断言 `concludeUpload` 自身零 GET（上传返回后、flush 发起前无 `/config` 请求）；快照终态壁纸 = 新资产。
  4. 验收①客户端半边用例：经桥直接打路由推进 revision（模拟另端写入）→ 本端 `deleteImage` 撞 409 → refetch → 重试一次成功，终态资产删除、引用字段回退、`affectedSkins` 报告正确。
- 验证：`node --test tests/write-dialect.test.mjs` 全绿。

### Task 7: 文档、全量验证与发版

- 目标：收口。
- 涉及文件：`docs/developers.md`、`package.json`（版本号）、CHANGELOG 若仓库惯例要求
- Steps
  1. `docs/developers.md` 写路径章节：op 四词汇、issues 形状、混版兼容路由地位、上传豁免理由，标注 ADR-0015。
  2. 版本号 → `1.6.0`。
  3. 全量验证：`pnpm run check`（danger-full-access 会话）。
  4. 发版按 `docs/developers.md`「发版」节 + know-how 018（npm staged 轮询）/008（registry 收尾）。
- 验证：`pnpm run check` 全绿；npm 最新正式版本为 1.6.0。

## 执行纪律

- 实现前批判性复查本计划；发现缺项、矛盾、命名不一致或验证命令无效，先修计划再动手。
- 按任务序执行；每任务跑其验证命令；不无声跳步、合并步或改目标。
- 阻塞、重复失败或计划与仓库现实不符（尤其 Task 3 预期的「路由零改动」）时立即停下说明，不猜。
- 若当前在 `main`/`master` 且用户未明确同意，开始实现前先确认。
- 全部完成后跑最终验证并输出修改摘要。

## 最终验证

- `pnpm run check` 全绿（含 `upstream-hooks: VERIFIED` 或本机降级 SKIPPED）。
- ADR-0015 验收五件全数落地：① delete 前置条件冲突 → 409 → refetch 重试（Task 2 服务端 + Task 4 客户端 + Task 6 跨缝三层）② 跨缝悬空自愈（Task 6）③ 清空图库单次提交原子（Task 2，含 3b 组合用例）④ 混版宽容（Task 1 围栏 + Task 3）⑤ 两捎带项（Task 4/6）。

## 收尾记录（2026-10-20）

- Task 1–7 全部完成。Task 7 Step 2/4 由主人裁定当日执行，版本定为 **1.5.12**（计划原建议 1.6.0 作废——主人指示走 1.5.x 补丁线；1.5.11 已被 ADR-0013 批次占用，npm 不可重发）。发版 commit `97ab0c5`、tag `v1.5.12`；staged 窗口 14 轮（约 28 分钟）消散，三键核验通过、`dist-tags.latest` 推进。
- 评审三部曲全部闭环：计划评审 3 轮 11 项、实现评审 3 轮 9 项、视觉评审 2 轮 6 项（真 DOM 截图证据；Desktop `<dialog>` 面声明静态审阅覆盖）——全部「已修复并复核通过」「反驳成立」或「观察备案」，无待主人决策分歧。
- 评审修复链：`d44f766`（终态不变量 + 重复删除守卫）、`a0726d1`（400 分支补钉 + selfHealed）、`c128abe`（清空确认预览引用）、`4d04d91`（验收②断言对齐）、`417146e`（issues 形状文档）、`1ceda18`（产物重建）、`4729424`（清空文案/locale 中立/摘除绑定）、`1e08a31`（产物重建）。
- 终态门禁：`pnpm run check` 330/330 全绿 + upstream-hooks VERIFIED strict-mode；六套件 167/167；lib 与 src 零漂移；本机 web profile 已升级 1.5.12 并重启生效。
