# 静态 riding 通道退役：tokenOverrides 单通道与锚点字节不变式收档

---
status: accepted
date: 2026-10-22
---

## 背景

2026-10-22 架构评审（improve-codebase-architecture 流程 + 独立事实调查交叉确认）坐实：ADR-0012→0016 三次收拢消灭了投影数学与装饰配方的多抄实现，但承载声明表的**文件级脚手架**在 openbmc/uefi 仍是逐字孪生——RIDING 键表 + `SPEC` + 16/14 行 `ridingDecl` 插值 + table 组装 + 工厂包装两份同构。riding token 键名每皮**三写**（RIDING 一处 + CSS 模板明暗两块各一处）、anchor 每皮**两写**（SPEC 与 table），等式靠 translucency-contract 的正则计数钉（16/14 处插值、零手写 rgba）与手抄 GOLD 站岗——「测试钉只能 fence 漏改，不能减少要改的地方」（ADR-0016 Considered 原话）。

事实调查三支点（独立子代理 npm tarball 逐一核验 + 活运行时源码直读）：

- **级联**：`overrideTokens` 的产物由 ui-layout `ThemePresenter` 以 **body 内联 style** 落值（`@deepseek-ai/dsh-client-ui-layout@0.2.1-rc.2` lib/client.js:561-566 `body.style.setProperty`）。内联非 important 恒胜一切作者样式表非 important 声明 → 凡进 tokenOverrides 的 token（= constantTokens ∪ 全部 riding，translucency.js:48-54 组装），静态块同名声明运行时**恒被覆盖**。本仓库 ADR-0004 早已记录此结论（其 Consequences：宿主 ThemePresenter 以 body.style.setProperty 落值、行内优先级更高）。
- **区间**：peer floor `>=0.2.0-rc.1 || >=0.2.1-rc.1`（package.json:57-65，peer-range.test.mjs:23-27 钉死）；npm tarball 核验 0.2.0-rc.1/rc.2、0.2.1-rc.1/rc.2 四版全部含 `overrideTokens`（更早的 0.1.1-rc.2、0.1.7-rc.2 亦然）。无任何 commit/ADR 记录过缺该 API 的宿主；API 漂移绊线在岗（verify-upstream-hooks.mjs:250）。
- **出生史**：静态烘焙块先于本仓库存在（dd7b52e 首提交即与 tokenOverrides 运行时通道并存）——仓库史上**从不存在**「静态 CSS 是唯一 token 通道」的时刻。`ridingDecl` 由 ADR-0013 引入，文档明言其存在理由是 **ADR-0004 锚点字节不变式的构造性载体**（「表同时生成 CSS 块内的 riding 声明——文件内双份字面量从构造上消失，字节等式免测自持」），不是运行时兜底。

先例：meirenzhi staticCss 无任何 riding/token 声明（index.js:42-72），其 riding 纯走 tokenOverrides（:96-101,127），单通道生产验证可行（ADR-0016 C1 亦援引为「constantTokens 经 runtime 施加的通道已被 meirenzhi 生产验证」）。

## Decision

1. **退役两皮 ridingDecl 插值块与 SPEC 中间物**：openbmc 16 处、uefi 14 处插值行与 `const SPEC = { anchor, riding }` 删除；anchor 从此只在 `table.anchor` 一处，riding token 键名只在 RIDING 表一处。孪生随块消灭，无需共享生成器。
2. **ADR-0004 锚点字节不变式随块收档**：「默认投影的派生串与各皮肤工厂的烘焙串逐字节相等」的使命（投影核接管期的迁移安全）已完成；烘焙串消失后等式自然消解。投影正确性的测试面 = 投影核金值（P=锚/66/0/100 + 逐 token 单调，全部既有）。
3. **translucency.js 导出面删除 `ridingDecl`**（删除后无剩余消费者）；`developers.md`「自建一套皮肤」配方同步改写：riding 全走声明表 → tokenOverrides，CSS 模板不再持任何 P 相关值。
4. **测试接班**：删 translucency-contract 的 CSS↔effects 交叉校验（:157-170）、16/14 计数钉与零手写钉（:280-303）、translucency-kernel 的 ridingDecl 单元（:193-199）；**新增三皮反向钉**——`project(出厂锚).staticCss` 不得含任何本皮 riding token 名（ADR-0004 不变式的接班形态：从「构造相等」反转为「构造不存在」，防未来皮肤把 P 相关值烤回静态块）。
5. **runtime.js:424 typeof 守卫保留**：零成本，在 API 漂移绊线（编译期红牌）之外保留一层行为语义（API 缺席时跳过 token 覆盖而非崩溃）；desktop asar 为独立构建、本 ADR 事实链未能直接核验其字节（仅有版本对应与 WCO 行为旁证），该守卫由此多一层缓冲。
6. **验收与发版**：纯删除但 lib 字节必变 → 独立正式版本（下一 patch）。零像素论证：静态块与内联在同一 apply tick 内先后落值（styleTag 插入 → overrideTokens → publish → presenter 重放，同步链），被覆盖窗口亚 tick、不可见；meirenzhi 生产先例。加固：复跑 ADR-0013 同款 headless A/B 像素实测（同 P 同明暗逐 cell 零差 + 灵敏度负对照）；零像素任务免截图 gate（ADR-0016 先例）；desktop 真机补课随发版升级后惯例执行。
7. **出局面**：artLayer 三元维持出局（ADR-0016 Q8「两实例低值」，本 ADR 不翻案）；decorations 死通道（translucency/projector/runtime 三处恒 null、零生产者）不搭车，另行独立清理；frost 常量族静态声明不进 tokenOverrides，不在本 ADR 范围。

## Considered Options

- **补齐 meirenzhi 静态块以消除三向分歧——被否**：给已被生产证伪的通道加第三份实现，方向反了。
- **共享生成器收拢孪生（harnessSkin 模板）——被否**：退役使孪生直接消灭，无物可共享；为保留而共享等于给死通道建族。
- **保留现状 + 注释写明级联事实——被否**：三写税与计数钉补偿架构原样留存，与 ADR-0016「钉子不能减少要改的地方」的自我裁决相悖。
- **decorations 死通道顺带清理——被否**：同属「通道存废」但关注点不同（effects 形状 vs riding 通道），保持任务纯度与验收语义单一。

## Consequences

- 三皮 riding 全走 tokenOverrides 单通道；「皮肤 = 声明表 + 品牌资源」（ADR-0014/0016 目标态）在 token 通道上最终成立——第四张皮肤不再手抄插值行 + SPEC，给 riding 加 token = 只动表一处（+金值）。
- ADR-0013「单源到底：表同时生成 CSS 块内的 riding 声明」的静态半边退役：表仍是唯一值源，只是不再镜像进 staticCss；「模板持排版、表持值」对 P 相关值收敛为「模板不持 P 相关值」。
- 事实链（presenter 内联落值、peer 全范围 tarball 核验、出生史）落档于此，未来读者无需重新考古；desktop asar 实现字节仍属旁证，由守卫的 asar 直读布局支持与真机补课兜底。
- upstream-hooks 运行时气泡计数消费 staticCss 整串、只数气泡钩子串（riding 行不含）→ 不受影响，实施计划中验证 6/6 原样；smoke/goldens 随 lib 再生。
- 理论首绘一帧差（styleTag 插入与 presenter 内联落值之间，anchor 值 vs 宿主默认值）由 A/B 实测证伪或接受；meirenzhi 早已在此形态下生产。
- GLOSSARY 零改动（机制名属 ADR 范畴；先例 ADR-0011 Q9 / 0014 / 0016 Q6）。

## Amendments

- **2026-10-22（发版收口）**：本决定以 `1.5.15` 独立正式版本收编（同日完成）：全门禁绿（verify:hooks strict 真跑）+ Release workflow success + npm 三键核验（per-version 200 / latest 推进 / time 推进，staged 窗口约 16 分钟）。**验收**：headless A/B 像素实测（3 皮 × 明暗 × 锚点 6 cell）——5/6 cell 逐字节全等；openbmc-light 残差 12px@δmax7 定位于未改动品牌字形 AA 边（(128-132,36-41)），明暗混合符号指纹判定为级联路径变化的 AA 重量化（计算样式逐字段全等、同构建重采字节全等、负对照 δ1 全屏检出三重排除有害机制），主人 1× 目测 + 独立评审员 8× 放大视觉终裁双通道裁定**不可感知**，闭案。**执行纪要三件**：① A/B 期间 12 次 `systemctl --user restart dsh-web.service` 实际全部失败（detached 上下文无 user bus），切换经 **client-only HMR** 生效（lib/index.js 零字节变化佐证）——restart 步骤基于保守假设，计划阶段应先判 host/client 变更面；逐轮构建指纹探针（styleTag 含/不含静态声明）是实际防线；② npm 版插件切换后仓库 node_modules 一度消失（已 `pnpm install --frozen-lockfile` 恢复，产物同步空 diff 排除污染），成因未确证、待遇同类现象再查；③ 夹具执行期加固：`*,*::before,*::after{transition:none!important}` 过渡冻结（换肤按钮收缩过渡的帧位差曾致 552px 假差）。**待办**：desktop（Windows）真机升级后补课（三皮 × 明暗 × 锚点态观感 + 通透度随动），沿 ADR-0016 真机补课惯例。
- 无（首版）。

## 附录：grill 共识（Q1–Q11，2026-10-22 会话存档）

1. **Q1** 裁决先行（裁决结果决定收拢形态）；**Q2** artLayer 维持出局；**Q3** ADR-0017 全案 + ADR-0004/0013 各一条 Amendment、GLOSSARY 零改动。
2. **Q4** 发版两分支预案：零像素搭车 / 字节变独立——本案字节必变，走独立正式版本；**Q5** 举证规则：退役为默认，保留方举证（事实未出现 forcing 条件）。
3. **Q6** 退役（三支点事实链）；**Q7** ADR-0004 不变式随块收档、投影核金值为唯一测试面；**Q8** 执行清单：删块 + SPEC、删 ridingDecl 导出、developers.md 配方改写、runtime.js:424 守卫保留、lib 随 checkpoint 再生。
4. **Q9** 删三处测试、留金值、加三皮反向钉；**Q10** 独立正式版本 + 零像素论证 + ADR-0013 同款 headless A/B 加固 + 免截图 gate + desktop 真机补课；**Q11** decorations 死通道不搭车。
