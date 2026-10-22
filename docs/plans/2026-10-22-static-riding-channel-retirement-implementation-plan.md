# 静态 riding 通道退役实施计划（ADR-0017）

## 目标

- 退役 openbmc/uefi 的 ridingDecl 静态插值块（16/14 处）与 `SPEC` 中间物：riding token 全走 `tokenOverrides` 单通道（ThemePresenter 内联落值恒胜样式表，事实链见 ADR-0017 背景）。
- anchor 单写 `table.anchor`、riding token 键名单写 RIDING 表；`ridingDecl` 从 `translucency.js` 导出面删除；`developers.md`「自建一套皮肤」配方同步改写。
- ADR-0004 锚点字节不变式收档：删三类旧钉（CSS↔effects 交叉校验、16/14 计数钉、ridingDecl 单元），新增三皮反向钉（`project(出厂锚).staticCss` 不得含任何本皮 riding token 名的声明）。
- **像素红线**：全程零像素；headless A/B 像素实测（6 cell + 灵敏度负对照）加固；免截图 gate（ADR-0016 先例）；desktop 真机补课随发版升级后执行。
- 发版：独立正式版本 `1.5.15`（lib 字节必变，触发 ADR-0017 grill Q4 的独立分支）。

## 架构快照

- **通道现状**：riding token 的值今天写两处——RIDING 表（→ `createProjection` → `project().tokenOverrides` → runtime `ctx.theme.overrideTokens` → presenter `body.style.setProperty` 内联，恒胜）与 CSS 模板插值行（静态块，恒被内联覆盖，仅承载 ADR-0004 字节等式）。退役 = 删静态半边，表半边原样。
- **退役后三皮一致**：meirenzhi 形态即目标态（staticCss 无任何 token 声明，CSS 只持装饰/品牌段）。
- **反向钉形状**（唯一权威定义，落在 `tests/translucency-contract.test.mjs`）：

```js
// ADR-0017：ADR-0004 锚点字节不变式的接班钉——从「构造相等」反转为「构造不存在」。
// token 名单沿用本文件 GOLD[skin].riding 的键集（GOLD 值列仅服务于表通道金值，不动）。
// 断言：project(出厂锚).staticCss 不含 `${token}\s*:` 形态的声明（var() 引用无冒号，不受影响）。
// 期望：改前 openbmc/uefi 红（证明钉子咬合）、meirenzhi 绿；改后三皮全绿。
```

- **不受影响面（执行前已核）**：`smoke-test.cjs` 只钉表通道 Host 契约（:154-160）；`meirenzhi-skin`/`personalization-projector` 金值走表通道；`runtime-effects` 不读 staticCss token 字面量；`upstream-hooks.test.mjs` 运行时计数只数气泡钩子串（riding 行不含）→ 6/6 原样。

## 全局约束

- **G0 例外（允许修改的测试，逐条穷尽）**：
  1. `tests/translucency-contract.test.mjs`：删 anchor 测试内的 `if (legacy) {…}` CSS↔effects 交叉校验块（≈:156-168，以块内容锚定，勿伤测试闭合 `});`）、16/14 计数钉与零手写钉（≈:280-303）；新增上述反向钉；C1 金值段头注释 `every non-ridingDecl declaration`（≈:305）措辞改为 `every non-riding declaration`（注释非期望值，为终态 grep 归零判据放行）。GOLD 表通道金值与 C1 等式断言不动。
  2. `tests/translucency-kernel.test.mjs`：`:9` import 行去掉 `ridingDecl`（保留 `createProjection, glassRule`）；删 `ridingDecl` 单元测试（≈:193-200，**含闭合行**）。
  - 除上述外现存测试期望值禁止修改；执行中如遇未列测试变红 → 停下说明，不猜。
- **范围红线（ADR-0017 Decision 7）**：artLayer 三元不碰；decorations 死通道不搭车；frost 常量族静态声明不碰；`runtime.js:424` typeof 守卫保留；peer 范围（package.json:57-65）不动；GLOSSARY 零改动。
- **lib 纪律**：凡触碰 `src/` 的 checkpoint 一并提交重建后的 `lib/`（developers.md 发版节第 6 条）；构建（esbuild）在 danger-full-access 沙箱会话执行（工作区 AGENTS 约定）。
- **计划判据三律**（developers.md，源自 ADR-0016 retro）：① 冻结类断言面清点必须 grep 派生、逐文件裁决，禁止凭记忆穷举；② 「单源收拢/全部派生」类步骤的注释、用户可见文案与代码同清单核对；③ 「唯一来源」grep 判据显式豁免来源文件自身。
- **分支**：仓库惯例直接在 main 迭代；开工前需主人明确同意在 main 直接执行（先例 2026-10-21 批准）。

## 文件结构与职责

| 文件 | 动作 | 职责变化 |
|---|---|---|
| `src/client/skins/openbmc-harness/index.js` | 修改 | 删 SPEC（:163）与 16 处插值行（:168-188 区）、删 `ridingDecl` import；RIDING 表与 table 原样 |
| `src/client/skins/uefi-harness/index.js` | 修改 | 删 SPEC（:76）与 14 处插值行（:82-97 区）、删 `ridingDecl` import；同上 |
| `src/client/skins/translucency.js` | 修改 | 删 `ridingDecl` 函数与导出；头注释「表形状权威定义」相应更新（模板不再持 P 相关值） |
| `tests/translucency-contract.test.mjs` | 修改 | G0-1：删两段旧钉、加反向钉 |
| `tests/translucency-kernel.test.mjs` | 修改 | G0-2：删 ridingDecl 单元 |
| `docs/developers.md` | 修改 | 配方删 ridingDecl 教学行；步骤 3 文案改为「riding 全走声明表 → tokenOverrides」 |
| `lib/client.js` | 再生 | 随每个 src checkpoint 重建提交 |
| `docs/adr/0017-*.md` | 收口 | 发版后补 Amendment（Task 8） |

不新建任何 src/test 文件；A/B 夹具是一次性产物，落 `.dsh-research/adr0017-ab/`（gitignored，不入库）。

## 任务清单

### Task 0：存档提交 + 基线与断言面清点

1. **存档 commit**：当前工作区有 4 份未提交文档（ADR-0017 新增、ADR-0004/0013 Amendment、本计划）——先作为纯文档 checkpoint 提交（无需重建 lib），使 `git status` 干净。
2. `pnpm run test` 全绿（基线）；记录 `git rev-parse HEAD` 为**基线 commit**（Task 6 A/B 的「改前」坐标）。
3. 断言面 grep 派生（三律①）：`grep -rn 'ridingDecl' src/ tests/ scripts/ docs/developers.md smoke-test.cjs`，逐文件裁决「改/不改」，与 G0 清单比对；差异 → 停下说明。
4. `grep -rn 'ridingDecl' docs/adr/ docs/plans/` 仅历史文档命中（ADR/plan 是存档，不改写正文，Amendment 另计）。

验证：`pnpm run test` 绿；grep 裁决表与 G0 一致。

### Task 1：反向钉先行（红）

1. `tests/translucency-contract.test.mjs`：按架构快照的反向钉形状新增测试（token 名单 = `GOLD[skin].riding` 键集，三皮循环）。
2. 同文件删除 anchor 测试内的 `if (legacy) {…}` 交叉校验块（≈:156-168，以块内容锚定，勿伤测试闭合 `});`）与 ≈:280-303 计数钉/零手写钉；C1 金值段头注释 `every non-ridingDecl declaration`（≈:305）措辞改 `every non-riding declaration`。
3. `tests/translucency-kernel.test.mjs`：`:9` import 行去掉 `ridingDecl`（保留 `createProjection, glassRule`）；删 ridingDecl 单元（≈:193-200，含闭合行）。
4. 本任务**不单独 checkpoint**——反向钉 RED 状态不落库，与 Task 2+3 的绿态合并、Task 3 一次落库（main 历史无红 commit；Task 2 时点 uefi 反向钉仍红，故 Task 2 也不落库）。

验证：`pnpm run test`——反向钉 **openbmc/uefi 红、meirenzhi 绿**，其余全绿；红法（用 `node --test tests/translucency-contract.test.mjs` 单文件确认断言差异就是插值行）。

Produces：反向钉测试（RED）。Consumes：GOLD 键集（既有）。

### Task 2：openbmc 退役（绿一半）

1. 删 `SPEC` 常量、CSS 模板 16 处 `${ridingDecl(...)}` 插值行（保留排版性空行收敛为最小 diff）、import 行去掉 `ridingDecl`；`table.anchor: 55` 原样（从此唯一）。
2. 注释同步改写（三律②）：:151-152「逐字对应下方 CSS 块的插值行」段改为「riding 值即出厂锚点烘焙读数，全走 tokenOverrides（ADR-0017）」；:166-167 段头「此处只留随动族 ridingDecl 插值行（ADR-0004 锚点字节不变式的载体）」随块删除，配色段头改写为「只剩品牌装饰段，token 一律走声明表」。
3. `pnpm run build` 重建 lib。

验证：`node --test tests/translucency-contract.test.mjs` 反向钉 openbmc 转绿；`pnpm run test` 除 uefi 反向钉红外全绿；`smoke-test.cjs` 原样通过（若红且差异仅为静态行删除 → 停下说明，G0 未预授权）。

Consumes：Task 1 反向钉。Produces：openbmc 单通道。**无 checkpoint**——此时 uefi 反向钉仍红，与 Task 1+3 合并在 Task 3 落库。

### Task 3：uefi 退役（全绿）

同 Task 2 形状：删 `SPEC`（:76）、14 处插值行、import 去 `ridingDecl`；注释同步改写 :65-66（同 openbmc :151-152 措辞）与 :79-80 段头（同 :166-167 处理）；重建 lib。

验证：`pnpm run test` 全绿（反向钉三皮全绿）；`tests/upstream-hooks.test.mjs` 运行时气泡计数 6/6 原样（ADR-0017 Consequences 显式验证项）。checkpoint：**Task 1+2+3 合并 checkpoint**（三皮反向钉全绿后一次落库，main 历史无红 commit）——测试 + 源码 + lib 同 commit。

### Task 4：ridingDecl 导出面删除

1. `src/client/skins/translucency.js`：删 `ridingDecl` 函数与 export；头注释更新（「模板持排版、表持值」对 P 相关值收敛为「模板不持 P 相关值」，引 ADR-0017）。
2. `grep -rn 'ridingDecl' src/ tests/` 归零（三律③：豁免对象仅剩 docs 存档与 developers.md——后者 Task 5 处理）。

验证：`pnpm run test` 全绿；`node --check lib/client.js` 通过。checkpoint。

### Task 5：developers.md 配方改写（三律②）

1. 「自建一套皮肤」配方**改写**（非整段删除，保引用链自洽——示例必须仍可整体照抄）：`:43` `const RIDING` 保留（`:76` `riding: RIDING` 引用它），注释改「riding 值即出厂锚点烘焙读数，全走 tokenOverrides，模板不持 P 相关值（ADR-0017）」；`:44` `const SPEC` 删除（退役物）；`:46-50` `const css` 模板改写为纯品牌/装饰段示例（`:54` `fullCss` 引用 `${css}` 不得悬空——或 fullCss 直接 = `frostFamilyCss(SCOPE, TINTS)` + 装饰段拼接）；其余「此处只留随动族 ridingDecl 插值行」类表述随段改写清除。
2. :85 注释改写：「`// 出厂锚点投影与烘焙串逐字节相等（ADR-0004 不变式，tests/translucency-contract 钉住）`」→「`// 出厂锚点投影经 tokenOverrides 施加；静态烘焙串已退役（ADR-0017）`」——旧句在退役后是教第四位皮肤作者的事实错误。
3. 同清单核对：`grep -rn 'ridingDecl\|插值行\|逐字节相等' docs/developers.md` 归零或仅剩 ADR 引用；`grep -n 'riding\|投影' GLOSSARY.md` 确认零改动。

验证：两个 grep 判据；`pnpm run verify:readme`（README 未动应绿）。checkpoint（纯文档，无需重建 lib）。

### Task 6：headless A/B 像素实测（零像素加固）

1. 重建 ADR-0013 同款夹具（一次性，落 `.dsh-research/adr0017-ab/`）：复用 `scripts/capture-previews.mjs` 的驱动、隐私规程（折叠工作区、空会话取景、强制中文）与 `?skin=<id>` + 主题卡机制，PNG 直出；注入 `prefers-reduced-motion` 冻结动画。
2. 采集矩阵：3 皮 × 明/暗 × 出厂锚 P = **6 cell**，对「改前（Task 0 基线 commit 的 worktree 构建）」与「改后（当前 HEAD 构建）」各采一轮——改前 worktree 为全新检出，构建前先 `pnpm install --frozen-lockfile`（worktree 不共享 node_modules；评审终轮建议 a）；dev-install `dsh plugin --profile web add link:<worktree 路径>` 依次切换；**每次 link 切换后须重启 DSH web 才生效**：`systemctl --user restart dsh-web.service`（shim 转发 restart 至系统级唯一实例；对已运行实例 `start` 是 no-op，禁用）+ 健康检查 `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080` = 200；两次切换、两次重启。
   **构建指纹探针（防「拍错构建」假通过，与像素判据互为双防线）**：每轮采集前 page 读取皮肤 styleTag 内容——改前轮必须含 `--dsw-alias-bg-base: rgba(` 声明、改后轮必须不含（退役后模板无 token 声明）；指纹不符当轮即红，不得进入像素比对。
3. 判据：6/6 cell 逐像素零差（PNG 字节等或逐像素 diff 为空）。
4. 灵敏度负对照（证明夹具能检出）：在改后 worktree 临时把 openbmc RIDING 任一 token 的明色 RGB 改 ±1 → 重启 → 对应 cell 必须检出差异 → 还原代码。
5. 还原自证：负对照还原并重启后**重跑一轮 6 cell 采集**，须回到 6/6 零差（证明还原干净）。
6. 恢复现场：移除 dev-install link，重装 npm 正式版 `@iasiv5/dsh-skins@1.5.14` 并重启（升 1.5.15 由 Task 7 发版后完成）；重启后跑一次指纹探针**反向确认**——应回到「含 `--dsw-alias-bg-base: rgba(`」（1.5.14 仍有静态块），恢复完整性有机读判据（评审终轮建议 b）。

验证：6/6 零差 + 负对照检出，证据文件留 `.dsh-research/adr0017-ab/`；如逐像素工具不可用或页面含不可冻结的动态内容 → 以主人在场对照目测为最终裁决（先例：ADR-0013 主人准许 headless A/B），裁决结论记入 Task 8 的 Amendment。

### Task 7：发版 1.5.15

按 `docs/developers.md`「发版」节全序执行：

1. `npm view @iasiv5/dsh-skins@1.5.15 --registry=https://registry.npmjs.org/` 确认未占用；bump `package.json` 至 1.5.15。
2. 全门禁 `pnpm run check`（CI 将以钉版 runtime 真跑 verify:hooks；末位 lib-sync 必须零差异）。
3. 提交源码 + lib，打 `v1.5.15` tag 推送；Release workflow（OIDC）发布。
4. npm staged 窗口轮询：`01_docs/dsh-intall-know-how/tools/release-monitor.sh`（know-how 018 纪律：窗口内不重推 tag）。
5. 三键核验：per-version 文档 200、`dist-tags.latest` 推进、packument `time` 推进。

验证：三键齐全；本机 `dsh plugin` 升级到 1.5.15。

### Task 8：收口

1. desktop（Windows）真机升级后目测补课：三皮 × 明暗 × 锚点态观感 + 通透度旋钮随动（先例 ADR-0016 真机补课）。
2. `docs/adr/0017-static-riding-channel-retirement.md` 补 Amendment：发版版本、A/B 证据路径、真机补课结论、执行期勘误（如有）。

验证：Amendment 落档；`grep -rn 'ridingDecl' src/ tests/ scripts/ docs/developers.md` 终态归零。

## 执行纪律

- 开工前批判性复查整份计划；发现缺项、矛盾、命名不一致或验证命令无效 → 先修计划。
- 按任务顺序执行，不无声跳步、合并步或改目标；每任务跑该任务验证。
- 阻塞、重复失败或计划与仓库现实不符 → 立即停下说明，不猜。
- 在 main 直接执行需主人开工前明确同意。
- 全部完成后跑最终验证并输出修改摘要。

## 最终验证

1. `pnpm run check` 全绿（含 CI 同款 verify:hooks 真跑前提）。
2. `grep -rn 'ridingDecl' src/ tests/ scripts/ docs/developers.md` → 零命中。
3. `git diff --exit-code -- lib/`（checkpoint 后工作区干净）。
4. A/B 6/6 零差证据 + 负对照检出记录在案。
5. v1.5.15 三键核验齐全；ADR-0017 Amendment 收口。
