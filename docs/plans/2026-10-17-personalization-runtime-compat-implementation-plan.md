# 个性化面板运行时兼容（web/desktop × 四格）+ peer 下限门槛 实施计划

## 目标

1. 修复 DSH Desktop 0.2.1-rc.2 上个性化面板「配置尚未同步，暂时无法编辑」：宿主入口只声明 `webServer` 硬依赖，`trustedHosts` 改为每请求惰性解析（`webStartup` → `webRuntime` → `[]` 降级）。
2. 新版 `peerDependencies` 六条 `@deepseek-ai/dsh-client-*` 钉到 `">=0.2.0-rc.1 || >=0.2.1-rc.1"`：web 侧 0.1.x / 0.2.0-rc.0 及更旧 DSH 被升级预检挡在门外（主人 2026-10-17 指定的门槛语义）。
3. 发版 1.5.8 → desktop 装机复验 → 热修退役 → dsh-m registry `verified`/描述如实更新 → know-how 034 立档。

覆盖四格：web 0.2.0-rc.1/rc.2（`webRuntime` 形态）、desktop 0.2.1-rc.1/rc.2（`webStartup` 形态，rc.1 为等价论证）。desktop 0.2.0-rc.2 属 `webRuntime` 形态（本机 10-16 前的 state 写入史即活证据），同被惰性解析覆盖。

## 架构快照

- 根因（已定谳）：`@deepseek-ai/dsh-desktop-runtime@0.2.1-rc.2` 移除 `webRuntime` provision（asar 全量扫描零命中；计数口径＝asar 头 18,309 项），信任列表迁至 `"webStartup"`（`WEB_STARTUP_SERVICE`，`dsh-web-app/lib/startup.js`）；dsh-skins ≤1.5.7 宿主入口 `ctx.inject(["webServer", "webRuntime"])` 等齐语义永不回调 → 路由静默不挂载 → `GET /dsh-skins/config` 404 → 客户端 offline-failed。`@deepseek-ai/cordis@4.0.5` 的 `Inject.resolve` 无按服务可选语法，故排除声明式可选依赖。
- 方案（主人已确认的方案 A）：挂载只依赖四格共有的 `webServer`；信任源差异降维成每请求一次属性读取，双缺 → `[]`（仅环回信任，合法降级）。
- peer 门槛：并集 `">=0.2.0-rc.1 || >=0.2.1-rc.1"` 覆盖 0.2.0-rc.1+ 与 0.2.1-rc.1+ 两线及全部稳定后续版（0.2.1、0.2.2、0.3.0、1.0.0…）。**门禁两层语义（R1-2 评审定谳，修正本计划初版叙事）**：dsh-m/宿主兼容门以 `includePrerelease: true` 判定（`dsh-m/src/core/compat-check.ts:45`，逐条对齐官方 evaluatePluginCompatibility）——新 rc 线（0.2.2-rc.1、0.3.0-rc.1…）在该门**不被拒**；包管理器 peer 解析（默认语义）在运行时物化图（web profile）中可能对跨元组预发布报冲突——ADR-0006 前科（`^0.1.1-rc.2` 拒 `0.1.2-rc.1`）属此层。追加新臂属「非必需但无害」，保留以使两引擎语义一致（know-how 034 必查②）。
- peer 门槛形态对照（better-sidebar `83faf70` / v0.28.0，同日适配 0.2.1-rc.1）：它用「单线 caret `^0.2.1-rc.1` + 支持线×插件版本对照表（旧宿主 pin 旧版）+ 不写运行时兼容层」；**不照抄**——单线 caret 会把 web 0.2.0-rc.1/rc.2 宿主预检硬拦在门外（web 侧预检真咬合），与本计划四格目标冲突；其「不写兼容层」成立的前提是 HTTP/WS 已迁 `ctx.connection.requestRejection`（天然不碰 `webRuntime`），而 dsh-skins 个性化路由是裸 HTTP + 自维护信任栏，惰性兼容层是最小改法。（requestRejection 主张出处＝83faf70 patch 的 AGENTS.md hunk 原句；Task 8 Step 0 立档前复验，核验不了则只写 npm 已证实的 peer 半句并注明「内部形态未核验」。）
- desktop 预检边界（如实预期）：desktop profile 的 `@deepseek-ai` 下无 dsh-client-*（运行时在 app.asar 内），dsh-m 的 peer 预检在 desktop 实际空转；门槛的咬合面在 web profile。desktop 旧版宿主即便装上新版，惰性降级也保证不致命。

## 全局约束（逐字继承）

- 六条 peer 范围字符串必须逐字为 `">=0.2.0-rc.1 || >=0.2.1-rc.1"`；`"@deepseek-ai/cordis": "^4.0.1"` 不动。
- 版本号：`1.5.8`（patch）。
- 平台：Windows + PowerShell；构建/测试命令走仓库 `package.json` scripts（`packageManager: pnpm@10.34.5`）。
- know-how 026 纪律：in-place 写 profile 前必须当会话直写探针（touch 后删），失败即停、改宿主通道。
- 备份一律落 node_modules 外（005 先例）。
- know-how 018 纪律：发版 CI 绿 ≠ 已上架，三键轮询，勿提前重推 tag。
- know-how 008/022 纪律：registry 改动跑 `node scripts/validate-registry.mjs` 全绿；push 前经主人确认；`verified` 只记 DSH 运行时版本，未实测版本不入列。
- know-how 写作规范：可 grep 的报错原文逐字收录（`配置尚未同步，暂时无法编辑`、`ctx.inject(["webServer", "webRuntime"]`、`webRuntime` provision）。
- 不声明 `package.json#engines.dsh`：宿主对声明该字段的包**优先且仅按它判定、不读 peer**（better-sidebar v0.28.0 AGENTS §3 实录）；该机制行为未逐版验证且 dsh-m 预检仍按 `@deepseek-ai/dsh(-*)` peer 判定——维持纯 peer 路线，仅作认知记录。
- 客户端 bundle（`src/client/**`）零改动。

## 输入工件

- 设计文档：无（主人指示跳过）。共识来源＝本会话 2026-10-17 排障定谳 + 主人四项裁决：方案 A（`接受：推荐方案`）、交付门槛「全链路矩阵」、顺序「先热修后发版」、peer 下限门槛（本计划新增约束）。
- 关键事实：asar 探针结论、`Inject.resolve` 源码、`tests/built-host.test.mjs` L16/L24 字面断言、装机 `lib/index.js` 锚点（L1068 / L1221 / L1231）——均已在本会话实测取得。

## 文件结构与职责

Create:
- `dsh-skins/src/host/trusted-hosts.js` — `resolveTrustedHosts(ctx)` 纯函数（唯一承载运行时形态差异的单元）。
- `dsh-skins/tests/trusted-hosts.test.mjs` — 四形态 + fence 函数式求值单测。
- `dsh-skins/tests/peer-range.test.mjs` — peer 范围 semver 矩阵单测（锁住两引擎语义——默认 / includePrerelease——下的地板行为，R2-1）。
- `01_docs/dsh-intall-know-how/034-dsh-skins-desktop-webruntime-compat.md` — know-how 立档。

Modify:
- `dsh-skins/src/index.js` — import、注入收窄、`trustedHosts` 函数化。
- `dsh-skins/src/host/personalization-routes.js` — fence 每请求求值（锚点：`fence` 内 `isTrustedRequest` 调用）。
- `dsh-skins/tests/built-host.test.mjs` — L16 `webRuntime` → `webStartup`、L24 断言改 `["webServer"]`。
- `dsh-skins/package.json` — 六条 peers、devDep `semver`、version 1.5.8。
- `dsh-skins/pnpm-lock.yaml` — 随 `pnpm add -D semver`。
- `dsh-skins/lib/index.js`、`dsh-skins/lib/client.js` — `pnpm run build` 产物，随源码提交。
- `dsh-skins/README.md`、`dsh-skins/README.en.md` — 已验证版本与最低要求句（双语配对，`verify:readme` 强制）。
- `dsh-m/registry.json` — dsh-skins 条目 description/verified。
- `01_docs/dsh-intall-know-how/AGENTS.md` — 索引表追加 034 行。
- 装机目录（非仓库）：`C:\Users\ies255050\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\index.js` — Task 2 热修三处。

## 任务清单

### Task 1: 装机目录直写探针 + lib/index.js 备份

- 目标：确认本会话可直写 desktop profile，并留出可回滚备份（026/005 纪律）。
- 涉及文件：`C:\Users\ies255050\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\index.js`；备份目录在 `D:\_dsh-workspace\.dsh-research\`。
- 接口契约
  - Consumes: 无。
  - Produces: 备份绝对路径（Task 2 回滚依据、Task 10 退役复核参照）。
- 验证范围：探针可建删；备份哈希与源文件一致。

- [ ] Step 1: 直写探针
- Run: `$f = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\.write-probe"; New-Item $f -ItemType File -Force | Out-Null; Remove-Item $f -Force; Write-Host probe-ok`
- Expected: 输出 `probe-ok`。失败（拒绝访问/只读）⇒ 按纪律 026 停止本任务线，改宿主通道，不得换路径硬写。
- [ ] Step 2: 备份
- Run: `$dir = "D:\_dsh-workspace\.dsh-research\dsh-skins-1517-desktop-hotfix-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"; New-Item -ItemType Directory -Force $dir | Out-Null; $src = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\index.js"; Copy-Item $src "$dir\index.js"; (Get-FileHash $src).Hash -eq (Get-FileHash "$dir\index.js").Hash`
- Expected: 输出 `True`；记下 `$dir` 备份路径。

### Task 2: 热修装机 lib/index.js（三处语义编辑）

- 目标：不动仓库，先让本机 desktop 0.2.1-rc.2 恢复个性化路由挂载（语义与 Task 4 源码修复逐字同构）。
- 涉及文件：`C:\Users\ies255050\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\index.js`。
- 接口契约
  - Consumes: Task 1 的备份路径。
  - Produces: 待重启生效的热修 lib（Task 3 验证对象；Task 10 装机 1.5.8 后自然覆盖退役）。
- 验证范围：三处编辑后 `node --check` 语法通过；锚点字符串计数符合预期。

- [ ] Step 1: read 目标行段确认现状
- Run: 用 read 工具读该文件 L1060-L1075 与 L1215-L1240（先读后写纪律；确认各行实际文本，特别是 L1231 行尾有无逗号——esbuild 对对象末属性可能去尾逗号）。
- Expected: 看到 `if (isTrustedRequest(request, trustedHosts)) return true;`、`ctx.inject(["webServer", "webRuntime"], (hostContext) => {`、`trustedHosts: hostContext.webRuntime.trustedHosts` 三处。
- [ ] Step 2: 编辑 A（注入收窄）
- Change: old `ctx.inject(["webServer", "webRuntime"], (hostContext) => {` → new `ctx.inject(["webServer"], (hostContext) => {`
- [ ] Step 3: 编辑 B（信任函数化；保留原行尾逗号/换行形态）
- Change: old `trustedHosts: hostContext.webRuntime.trustedHosts` → new `trustedHosts: () => hostContext.webStartup?.trustedHosts ?? hostContext.webRuntime?.trustedHosts ?? []`
- [ ] Step 4: 编辑 C（fence 每请求求值）
- Change: old `if (isTrustedRequest(request, trustedHosts)) return true;` → new `if (isTrustedRequest(request, typeof trustedHosts === "function" ? trustedHosts() : trustedHosts)) return true;`
- [ ] Step 5: 静态验证（不重启）
- Run: `$lib = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\index.js"; & "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" --check $lib; if ($LASTEXITCODE -eq 0) { Write-Host syntax-ok }; (Select-String -Path $lib -Pattern '"webServer", "webRuntime"').Count; (Select-String -Path $lib -Pattern 'webStartup\?').Count`
- Expected: `syntax-ok`；第一个 Count = `0`；第二个 Count ≥ `1`。

### Task 3: 主人重启 Desktop 应用 + 端到端验证（rc.2 实测证据）

- 目标：让热修生效并取得 desktop 0.2.1-rc.2 的端到端实测证据（发版前唯一 rc.2 实测）。
- 涉及文件：无代码改动；产出验证记录（Task 8 收进 know-how）。
- 接口契约
  - Consumes: Task 2 的热修 lib。
  - Produces: `config-200` 验证结论 + GUI 端到端结论（Task 8/9 引用）。
- 验证范围：`/dsh-skins/config` 由 404 变 200；面板恢复可编辑且写入落盘。

- [ ] Step 1: 请主人手动重启 Desktop 应用
- 说明：重启会使本会话短暂中断，重连后继续本任务；端口是临时的，重启后会变。
- [ ] Step 2: 配置路由探针（核心判据）
- Run:
```powershell
if ($PSVersionTable.PSVersion.Major -lt 7) { throw "需要 pwsh 7（-SkipHttpErrorCheck 依赖）；当前 $($PSVersionTable.PSVersion)" }
$pids = Get-Process -Name 'DeepSeek Harness' -ErrorAction Stop | Select-Object -ExpandProperty Id
$ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $pids -contains $_.OwningProcess } |
  Select-Object -ExpandProperty LocalPort -Unique
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:$p/dsh-skins/config" -UseBasicParsing -SkipHttpErrorCheck -TimeoutSec 5
    if ($r.StatusCode -eq 200) { Write-Host "PASS port=$p body=$($r.Content.Substring(0, [Math]::Min(80, $r.Content.Length)))" }
  } catch { }
}
```
- Expected: 至少一个端口输出 `PASS`（HTTP 200 + JSON 快照体）。全部 404 ⇒ 热修未生效，停下回报，不得进入 Task 4 之外的猜测性动作。
- [ ] Step 3: 排除「宿主版本守卫跳过 bundle」同症假说（015 锚点）
- Run: 宿主日志通道可及则 grep `skipping profile bundle`（预期 0 命中）；本机若无可及的宿主日志文件，则以逻辑排除并记录：015 实录＝版本守卫跳过 bundle 时客户端包一并消失（皮肤列表在场 ⇒ bundle 未被跳过）。
- [ ] Step 4: GUI 端到端（主人目视 + 执行者核对）
- Expected: 个性化面板不再显示「配置尚未同步，暂时无法编辑」；调整一个滑杆/标语后面板保持正常；`Get-Item "$env:USERPROFILE\.dsh\dsh-skins-desktop\state.json"` 的 `LastWriteTime` 更新为当前时间。

### Task 4: 源码兼容层（trusted-hosts.js + index.js + routes fence）— TDD

- 目标：把热修语义落到仓库源码与测试（含 built-host 契约测试改写）。
- 涉及文件：见「文件结构与职责」前五条（Create 三、Modify 三）。
- 接口契约
  - Consumes: 无（源码层独立）。
  - Produces: `resolveTrustedHosts(ctx)`（导出自 `src/host/trusted-hosts.js`）；`mountPersonalizationRoutes` 接受 `trustedHosts: string[] | (() => string[])`。Task 5/6/9 消费。
- 验证范围：新测试先红后绿；`built-host` 契约测试随 rebuild 转绿。

- [ ] Step 1: 写失败测试
- Change: Create `tests/trusted-hosts.test.mjs`：
```js
import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedHosts } from "../src/host/trusted-hosts.js";

test("resolveTrustedHosts: webRuntime shape (web 0.2.0-rc.x)", () => {
  const ctx = { get(name) { return name === "webRuntime" ? { trustedHosts: ["dsh.example:8443"] } : undefined; } };
  assert.deepEqual(resolveTrustedHosts(ctx), ["dsh.example:8443"]);
});

test("resolveTrustedHosts: webStartup shape (desktop 0.2.1-rc.x)", () => {
  const ctx = { get(name) { return name === "webStartup" ? { trustedHosts: ["dsh.example:443"] } : undefined; } };
  assert.deepEqual(resolveTrustedHosts(ctx), ["dsh.example:443"]);
});

test("resolveTrustedHosts: both present — webStartup wins", () => {
  const ctx = { get(name) { return name === "webStartup" ? { trustedHosts: ["a"] } : { trustedHosts: ["b"] } } };
  assert.deepEqual(resolveTrustedHosts(ctx), ["a"]);
});

test("resolveTrustedHosts: neither — loopback-only degradation", () => {
  assert.deepEqual(resolveTrustedHosts({ get() { return undefined; } }), []);
  assert.deepEqual(resolveTrustedHosts(undefined), []);
});

test("resolveTrustedHosts: throwing getter (cordis Local without inject) — degrade, never propagate", () => {
  // 2026-10-18 热修实录：cordis 对未 inject 服务的属性访问抛
  // 「cannot get property "webStartup" without inject」——`?.` 链不可防护；
  // ctx.get(name) 为非抛查找，且本函数须保证任何意外都降级 []、绝不向上传播。
  const ctx = { get() { throw new Error('cannot get property "webStartup" without inject'); } };
  assert.deepEqual(resolveTrustedHosts(ctx), []);
});

test("mount accepts function trustedHosts and re-evaluates per request", async () => {
  const { mountPersonalizationRoutes } = await import("../src/host/personalization-routes.js");
  const registered = [];
  const host = {
    webServer: { register(route) { registered.push(route); return () => {}; } },
  };
  let trusted = ["good.host"];
  mountPersonalizationRoutes(host, {
    store: { snapshot: () => ({ revision: 0 }) },
    trustedHosts: () => trusted,
  });
  const handler = registered.find((route) => route.path === "/dsh-skins/config").handler;
  const respond = () => ({ code: 0, writeHead(c) { this.code = c; }, end() {} });
  const request = { method: "GET", headers: { host: "good.host" }, socket: { remoteAddress: "203.0.113.7" } };
  let res = respond();
  await handler(request, res);
  assert.equal(res.code, 200);
  trusted = []; // trust withdrawn after mount — must apply on the next request
  res = respond();
  await handler(request, res);
  assert.equal(res.code, 403);
});
```
- Change: Modify `tests/built-host.test.mjs`：L16 `webRuntime: { trustedHosts: ["example.test"] },` → `webStartup: { trustedHosts: ["example.test"] },`；L24 `assert.deepEqual(services, ["webServer", "webRuntime"]);` → `assert.deepEqual(services, ["webServer"]);`
- [ ] Step 2: 确认失败
- Run: `node --test tests/trusted-hosts.test.mjs tests/built-host.test.mjs`
- Expected: trusted-hosts 用例报 `Cannot find module ... trusted-hosts.js`；built-host 用例在 rebuild 前因旧 lib 仍注入两元数组而 `deepEqual` 失败。
- [ ] Step 3: 写最小实现
- Change: Create `src/host/trusted-hosts.js`：
```js
/**
 * Runtime-shape adapter for the trusted-host list (personalization runtime
 * compat, 2026-10-17/18). DSH renamed the provision that carries
 * `trustedHosts` across runtime lines: web 0.2.0-rc.x serves it on
 * `webRuntime`; Desktop 0.2.1-rc.x serves it on `webStartup`. Routes
 * hard-depend on `webServer` only, so the list is resolved lazily per
 * request through the NON-THROWING `ctx.get(name)` lookup — property access
 * on a cordis context proxy throws for services outside `inject`
 * ("cannot get property ... without inject"), which `?.` chains cannot
 * guard (2026-10-18 hot-fix field capture). Every lookup failure degrades
 * to `[]` (loopback-only trust — never a mount failure).
 */
export function resolveTrustedHosts(ctx) {
  let startup, runtime;
  try {
    startup = ctx?.get?.("webStartup");
  } catch {}
  try {
    runtime = ctx?.get?.("webRuntime");
  } catch {}
  return startup?.trustedHosts ?? runtime?.trustedHosts ?? [];
}
```
- Change: Modify `src/index.js`——import 区新增 `import { resolveTrustedHosts } from "./host/trusted-hosts.js";`；`ctx.inject(["webServer", "webRuntime"], (hostContext) => {` → `ctx.inject(["webServer"], (hostContext) => {`；`trustedHosts: hostContext.webRuntime.trustedHosts,` → `trustedHosts: () => resolveTrustedHosts(ctx),`（用 apply 外层 ctx——真 Context 上的 `get` 为非抛查找；hostContext 是 cordis Local，未声明服务的属性访问会抛，见批准与裁决记录 2026-10-18 执行发现）。
- Change: Modify `src/host/personalization-routes.js`——`fence` 内 `if (isTrustedRequest(request, trustedHosts)) return true;` → `if (isTrustedRequest(request, typeof trustedHosts === "function" ? trustedHosts() : trustedHosts)) return true;`
- [ ] Step 4: 确认通过
- Run: `pnpm run build` 然后 `node --test tests/trusted-hosts.test.mjs tests/built-host.test.mjs`
- Expected: 全部用例绿（built-host 在 rebuild 后吃到新 lib）。

### Task 5: peer 下限并集 + semver devDep — TDD

- 目标：六条 dsh-client peer 钉到 `">=0.2.0-rc.1 || >=0.2.1-rc.1"`，并用真实 semver 库把地板语义在两种引擎语义（默认 / includePrerelease）下锁进测试（R2-1）。
- 涉及文件：`tests/peer-range.test.mjs`（Create）、`package.json`、`pnpm-lock.yaml`。
- 接口契约
  - Consumes: 无。
  - Produces: peer 范围常量 `">=0.2.0-rc.1 || >=0.2.1-rc.1"`（Task 9 README/registry 描述、Task 8 know-how 引用同一字符串）。
- 验证范围：矩阵测试先红后绿；devDep `semver` 入 lock。

- [ ] Step 1: 写失败测试
- Change: Create `tests/peer-range.test.mjs`：
```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import semver from "semver";

// semver gate semantics differ by layer (R1-2): the dsh-m/host compat gate
// evaluates with includePrerelease:true (compat-check.ts:45) and therefore
// accepts future rc lines; package-manager peer resolution uses default
// semantics (ADR-0006 precedent: ^0.1.1-rc.2 rejects 0.1.2-rc.1), where a
// cross-tuple prerelease does not satisfy the range. The union keeps both
// engines aligned on the floor; appending a new arm for a future rc line is
// optional-but-harmless (know-how 034 必查②).
const RANGE = ">=0.2.0-rc.1 || >=0.2.1-rc.1";
const PEERS = [
  "@deepseek-ai/dsh-client-connection",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-runtime",
  "@deepseek-ai/dsh-client-ui-conversation",
  "@deepseek-ai/dsh-client-ui-sidebar",
  "@deepseek-ai/dsh-client-ui-theme",
];

test("all six dsh-client peers pin the union floor; cordis peer untouched", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  for (const name of PEERS) assert.equal(pkg.peerDependencies[name], RANGE, name);
  assert.equal(pkg.peerDependencies["@deepseek-ai/cordis"], "^4.0.1");
});

test("union floor accepts the target lines and stable futures", () => {
  for (const v of ["0.2.0-rc.1", "0.2.0-rc.2", "0.2.1-rc.1", "0.2.1-rc.2", "0.2.1", "0.2.2", "0.3.0", "1.0.0"]) {
    assert.ok(semver.satisfies(v, RANGE), `expected ${v} to satisfy ${RANGE}`);
  }
});

test("union floor rejects pre-floor and legacy lines", () => {
  for (const v of ["0.1.2-rc.1", "0.1.7-rc.2", "0.2.0-rc.0"]) {
    assert.ok(!semver.satisfies(v, RANGE), `expected ${v} to be rejected by ${RANGE}`);
  }
});

test("default-semver layer: cross-tuple rc lines do not satisfy the range", () => {
  // Pins the package-manager (default semantics) layer only. The dsh-m/host
  // gate (includePrerelease:true) accepts these. When DSH ships a new rc
  // line, appending `>=X.Y.Z-rc.n` to RANGE stays optional-but-harmless
  // (know-how 034 必查②). Stable releases (0.2.2, 0.3.0) satisfy regardless.
  for (const v of ["0.2.2-rc.1", "0.3.0-rc.1"]) {
    assert.ok(!semver.satisfies(v, RANGE), `expected ${v} to be rejected by ${RANGE}`);
  }
});
```
- [ ] Step 2: 确认失败
- Run: `node --test tests/peer-range.test.mjs`
- Expected: 失败于 `Cannot find package 'semver'`（首个用例）。
- [ ] Step 3: 写最小实现
- Run: `pnpm add -D semver`
- Change: `package.json` 六条 peer 值改为 `">=0.2.0-rc.1 || >=0.2.1-rc.1"`（version 字段本任务不动，Task 9 统一 bump 1.5.8）。
- [ ] Step 4: 确认通过
- Run: `node --test tests/peer-range.test.mjs`
- Expected: 4 个用例全绿。

### Task 6: 全量门禁 + 兼容层提交

- 目标：仓库门禁全绿并把 Task 4/5 成果落 commit。
- 涉及文件：Task 4/5 全部产物 + `lib/index.js`、`lib/client.js` 构建产物。
- 接口契约
  - Consumes: Task 4 与 Task 5 的 Produces。
  - Produces: main 分支上的干净提交（Task 9 release 基线）。
- 验证范围：`pnpm run check` 全绿；`git status` 干净。

- [ ] Step 1: 全门禁
- Run: `pnpm run check`
- Expected: build → `node --check` lib 双文件 → smoke-test → 全部 `tests/*.test.mjs` → `verify:readme` → `verify:bundle` → `verify:hooks` 全绿，退出码 0。
- [ ] Step 2: 提交（纪律：main 直接提交是本仓库惯例，但执行前向主人确认一次）
- Run: `git add src/host/trusted-hosts.js tests/trusted-hosts.test.mjs tests/built-host.test.mjs src/index.js src/host/personalization-routes.js lib/index.js lib/client.js; git commit -m "fix(host): mount personalization routes on webServer only with lazy trusted-host resolution"`
- Run: `git add package.json pnpm-lock.yaml tests/peer-range.test.mjs; git commit -m "feat(peers): require DSH >= 0.2.0-rc.1 (union with 0.2.1-rc.1) for dsh-client peers"`
- Expected: 两个 commit 成功；`git status --porcelain` 为空。

### Task 7: dsh-m registry 条目更新 + validate（推送前经主人确认）

- 目标：registry 与新版兼容声明一致，且不再声称已弃版本。
- 涉及文件：`dsh-m/registry.json`（dsh-skins 条目）。
- 接口契约
  - Consumes: Task 5 的 peer 范围字符串（描述文案引用）；Task 3 的 rc.2 实测结论；**Task 9 Step 3 的 npm 三键一致（1.5.8 已上架）——push 的硬前置，杜绝「宣传先于制品」窗口（R1-1）**。
  - Produces: 待主人确认推送的 registry 改动；push 时点＝Task 9 Step 3 完成且主人确认（008）后。Host B web 复验**不作为** push 硬前置（`0.2.0-rc.2` 已有 1.5.7 时代实测背书，1.5.8 对该格为同形态惰性层超集）；若 push 时 Host B 复验尚未完成，由主人在知晓该状态的前提下裁决。
- 验证范围：`node scripts/validate-registry.mjs` 全绿。

- [ ] Step 1: 改 description 与 verified
- Change: `description` → `DSH Web 皮肤插件：多套品牌皮肤侧栏热切换，一键回到官方界面。已适配 web 0.2.0-rc.1/rc.2 与 Desktop 0.2.0-rc.2、0.2.1-rc.2（最低要求 DSH 0.2.0-rc.1），详见仓库。`
- Change: `verified` → `["0.2.0-rc.1", "0.2.0-rc.2", "0.2.1-rc.2"]`。理由：0.1.x 两项移除（新版 peer 已声明不再支持，保留即虚假声明）；`0.2.1-rc.2` 加入（desktop 本机实测）；`0.2.1-rc.1` 不加（未实测，等价论证不进 verified——如实标注纪律）；`0.2.0-rc.1` 保留（历史 verified + 支持范围内 + web 侧等价论证，主人确认时一并复核）。
- [ ] Step 2: validate
- Run: `Set-Location D:\_dsh-workspace\dsh-m; node scripts/validate-registry.mjs; Set-Location D:\_dsh-workspace`
- Expected: 全绿零警告（022 的 verifiedPollution 告警必须为零）。**本任务不执行 push**；push 动作在 Task 9 Step 3（npm 三键一致 1.5.8）完成、且主人确认（008 纪律）后执行：`git -C D:\_dsh-workspace\dsh-m push`。

### Task 8: know-how 034 立档 + 索引行

- 目标：按索引规则沉淀本案（症状逐字、根因、修复、升级后必查）。
- 涉及文件：`01_docs/dsh-intall-know-how/034-dsh-skins-desktop-webruntime-compat.md`（Create）、`01_docs/dsh-intall-know-how/AGENTS.md`（索引表追加行 + 使用规则 3 的过时编号表述顺手修正）。
- 接口契约
  - Consumes: Task 3 实测结论、Task 5 的 peer 语义与门槛备注。
  - Produces: 索引行 `[034]`（后续会话入口）。
- 验证范围：文件含逐字报错原文；索引表可 grep 到 `[034]`。

- [ ] Step 0: 核验 better-sidebar 0.28.0 内部形态主张（R1-4）
- Run: 用 read_page 拉 `https://github.com/omdsh-dev/DSH-better-sidebar/commit/83faf70940160e5cd4c5332f5400aa8f4dbbb6d6.patch`，在 AGENTS.md hunk 内按锚片段核对（grep `requestRejection` 与 `webRuntime` 同段出现即可，不要求整句逐字——R2-2）。评审已于 2026-10-18 预验命中：patch AGENTS.md §3 hunk 含原句「HTTP/WS 准入统一调用 `ctx.connection.requestRejection(req)`，仅 `undefined` 放行，不恢复 `webRuntime` / 自建信任例外」；commit subject「chore(release): adapt to DSH 0.2.1-rc.1 for 0.28.0」、日期 2026-10-17。
- Expected: 锚片段命中 ⇒ Step 1 的 ④ 认知段照写并附引句；未命中/拉取失败 ⇒ ④ 只写 npm 已证实的 peer 形态半句（`^0.2.1-rc.1` 单线 caret，registry 已核）并注明「requestRejection 内部形态未核验」。

- [ ] Step 1: 立档
- Change: 按既有 know-how 章节模板写 034，必须逐字收录：症状 `配置尚未同步，暂时无法编辑` + `重试` 永不生效；根因链（desktop runtime 0.2.1-rc.2 移除 `webRuntime` provision——asar 全量扫描零命中，头 18,309 项；`trustedHosts` 迁 `webStartup`——**结构性证据自限**：asar 全库唯一 provider，非运行时直证，措辞以此自限；`ctx.inject(["webServer", "webRuntime"]` 等齐语义静默不挂载；`GET /dsh-skins/config` 404；cordis 4.0.5 `Inject.resolve` 无可选注入；旁证：装机对照物 dsh-better-sidebar 0.26.1 同样硬依赖 `webRuntime`（其 `src/index.ts:114` inject 列表含 webRuntime）——同机理在 desktop rc.2 上应同样不可挂载，范围外观察）；修复（1.5.8：webServer-only + 惰性信任解析；热修三处编辑与本机备份目录路径）；升级后必查：① DSH desktop 每次升级后 `/dsh-skins/config` 应 200、面板可编辑；② **DSH 新 rc 线发布时的两层门禁语义**（R1-2 定谳）：dsh-m/宿主兼容门（`compat-check.ts:45` 以 `includePrerelease: true` 判定）不拒新 rc 线；包管理器 peer 解析（默认语义，ADR-0006 前科）在 web 物化图中可能 ERESOLVE——并集追加 `>=X.Y.Z-rc.n` 单臂非必需但无害，同批翻新 `tests/peer-range.test.mjs` 矩阵断言；③ web 0.1.x 旧宿主不再能升级 dsh-skins ≥1.5.8，属预期门槛非回归；④ 认知段——better-sidebar `83faf70`（v0.28.0 同日适配 0.2.1-rc.1）的「单线 caret + 版本对照表 + 旧宿主 pin 旧版 + 不写兼容层」模式与本仓「双线 union + 惰性兼容层」的取舍对照（含实证：`0.x caret 不跨 minor`，`^0.1.7-rc.1` 对 `0.2.0-rc.1` 判 false → 整行静默 disabled；`engines.dsh` 字段机制：宿主对声明包优先且仅按它判定、不读 peer；requestRejection 内部形态主张按 Step 0 核验结果如实标注）。
- [ ] Step 2: 索引表加行
- Change: `AGENTS.md` 索引表追加 034 行（主题＝dsh-skins × desktop runtime webRuntime 移除；触发症状＝`配置尚未同步，暂时无法编辑`；关键修复物＝1.5.8 `resolveTrustedHosts` + peer 并集门槛；升级后必查＝上述三条）。（原 R1-9 子项——修正使用规则 3 的「下一篇 028」过时表述——已由并行更新完成为「下一篇 034」，本子项免除。）
- [ ] Step 3: 验证
- Run: `Select-String -Path "D:\_dsh-workspace\01_docs\dsh-intall-know-how\034-dsh-skins-desktop-webruntime-compat.md" -Pattern '配置尚未同步，暂时无法编辑'; Select-String -Path "D:\_dsh-workspace\01_docs\dsh-intall-know-how\AGENTS.md" -Pattern '\[034\]'`
- Expected: 两条都有命中。

### Task 9: 发版 1.5.8（README 双语 + release commit + tag + npm 轮询）

- 目标：把 1.5.8 发上 npm 并如实更新 README 兼容声明。
- 涉及文件：`package.json`（version）、`README.md`、`README.en.md`、构建产物。
- 接口契约
  - Consumes: Task 6 的两个 commit（基线）；Task 3 的 desktop rc.2 实测结论（README「已验证」措辞依据）。
  - Produces: npm `@iasiv5/dsh-skins@1.5.8`（Task 10 装机对象）。
- 验证范围：门禁绿；tag 推送后 Release run 绿；npm 三键一致（018：staged 长尾属正常，勿重推 tag）。

- [ ] Step 1: 版本与 README
- Change: `package.json` `"version": "1.5.7"` → `"1.5.8"`；`README.md` 按各行实际原文分别更新（R1-3）：L143 原文「已在 dsh Desktop `0.2.0-rc.2`（Windows）验证」→「已在 dsh Desktop `0.2.1-rc.2`（Windows）验证」；L179 原文「已使用 dsh Desktop `0.2.0-rc.2`（Windows）验证」→「已使用 dsh Desktop `0.2.1-rc.2`（Windows）验证」；L176 FAQ 增加最低要求句（中文）：「最低支持 DSH `0.2.0-rc.1`：更旧的 DSH 版本会被 peer 依赖门槛挡住，无法升级到 1.5.8+。」`README.en.md` 对应行同步（英文等义：「Requires DSH `0.2.0-rc.1` or later; older DSH versions are blocked from upgrading to 1.5.8+ by the peer dependency floor.」）——双语配对由 `verify:readme` 强制。
- Change: README 双语各加「按 DSH 版本选插件版本」小表（仿 better-sidebar 安装节，仅两行）：`DSH ≥ 0.2.0-rc.1（含 0.2.1-rc.1+，web 与 Desktop 通用）→ dsh-skins@latest（1.5.8+）`；`DSH 0.1.x → 1.5.7（该线的最后支持版）`。
- [ ] Step 2: 门禁 + release commit + tag
- Run: `pnpm run check` → Expected 全绿。
- Run: `git add package.json README.md README.en.md lib; git commit -m "release: v1.5.8 personalization runtime compat + peer floor"; git tag v1.5.8; git push origin main; git push origin v1.5.8`
- Expected: push 成功；GitHub Actions Release run 启动。
- [ ] Step 3: npm 三键轮询（018 纪律；后台跑，>90s 命令用 run_in_background）
- Run: `npm view @iasiv5/dsh-skins version; npm view @iasiv5/dsh-skins dist-tags.latest; npm view @iasiv5/dsh-skins@1.5.8 peerDependencies --json`
- Expected: 前两者 = `1.5.8`；peerDependencies 六条为并集串。staged 延迟可达约 1 小时——轮询等待，**不得重推 tag**（018）。

### Task 10: desktop 装机 1.5.8 + 热修退役复核

- 目标：本机 desktop 换上正式版并完成热修退役闭环。
- 涉及文件：装机目录 `...\@iasiv5\dsh-skins\`（由安装通道写入）。
- 接口契约
  - Consumes: Task 9 的 npm 1.5.8；Task 1 的备份路径（仅留存参照，不动）。
  - Produces: 退役复核结论（回写 Task 8 文档补一行「正式版装机收编」）。
- 验证范围：装机版本、语义随包、路由 200、GUI 正常。

- [ ] Step 1: 装机（主人操作）
- 说明：dsh-m 桌面通道对 agent 侧 upgrade 是结构化拒答——不绕行（020 红线）。请主人在产品 GUI 插件页把 dsh-skins 升到 1.5.8（或按 020 操作员通道）。若报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`（新发版 24h 等待期；desktop 的 exclude 现仅 pin 到 1.5.5）：按 020 §8/§9 处置——dsh-m ≥0.9.24 三挂点代管大概率自愈；等待期满自然解除，**不绕行**（R1-5）。
- [ ] Step 2: 复核
- Run: `$lib = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\lib\index.js"; (Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@iasiv5\dsh-skins\package.json" -Raw | ConvertFrom-Json).version; (Select-String -Path $lib -Pattern 'webStartup').Count; (Select-String -Path $lib -Pattern 'HOTFIX-DBG').Count`
- Expected: version = `1.5.8`；`webStartup` 命中 ≥1（语义已随包，热修被正式版覆盖 = 按 024 先例自然退役，无需单独移除）；**`HOTFIX-DBG` 计数 = 0（诊断包装随正式版消失，R1-4 核证点）**。再跑 Task 3 Step 2 的探针应仍 `PASS`；GUI 面板读写正常。
- [ ] Step 3: 留档
- Change: Task 8 文档补一行退役记录（正式版装机时间、复核证据）；备份目录保留至下一次 DSH desktop 升级且无复发后清理（005 观察期规则）。

### 移交项（不在本机执行）

- Host B（bmc-build-server1）web 0.2.0-rc.2 复验：产品内升级 dsh-skins ≥1.5.8 → 个性化面板读写正常 → journal 无 `skipping profile bundle`。通过后无需改 verified（`0.2.0-rc.2` 已在列）；若失败，停下回报并按 know-how 034 复盘。
- web 0.2.0-rc.1 存活实例（Host A 布局）：顺带确认，测到即把结论补进 know-how 034；registry `verified` 是否追加 `0.2.1-rc.1`/维持 `0.2.0-rc.1` 由主人按实测结果裁决。

## 执行纪律

- 开始实现前先批判性复查整份计划；发现缺项/矛盾/命令无效，先修计划再动手。
- 按任务顺序执行，不无声跳步、合并或改目标；每任务完成即跑该任务验证。
- 遇阻、重复失败或计划与仓库现实不符，立即停下说明，不猜。
- 当前分支 `main`：仓库惯例直接提交 main，但 Task 6 提交前向主人确认一次。
- Task 3 与 Task 10 的应用重启会使本会话短暂中断：重连后从中断处继续，不重做已完成步骤。
- 环境前提：Windows + PowerShell；`node`/`pnpm`/`git` 在 PATH（node 需 ≥22 以支持 `node --test` 的 glob；若 PATH node 过旧，把 `$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin` 前置到 PATH）；>90s 的命令（npm 轮询）用 `run_in_background`。

## 最终验证

- 仓库：`pnpm run check` 在 1.5.8 树上全绿；`git log --oneline -3` 可见 release commit；`git status --porcelain` 为空。
- npm：`npm view @iasiv5/dsh-skins version` = `1.5.8`，peerDependencies 六条 = `">=0.2.0-rc.1 || >=0.2.1-rc.1"`。
- desktop 本机：装机 1.5.8；`/dsh-skins/config` 200；GUI 面板可编辑；热修退役记录入 034。
- registry：`dsh-m` validate 全绿（push 经主人确认）；verified/description 与 Task 7 一致。
- know-how：034 存在、索引行 `[034]` 在、逐字报错原文在。

## 审阅 Checkpoint

- 计划正文到此为止。请审阅：确认无误后回复批准，即可交由编码 agent / 人工按序执行；有异议先改计划再执行。

## 批准与裁决记录

- 2026-10-18：独立评审 Agent 三轮评审收敛（R1 九项 + R2 两项全部「已修改并复核通过」，R3 终核通过），主人批准计划在 `main` 分支执行。
- UD-1 裁决＝**选 A**：基线 B4 分句修正为「两层门禁」语义——dsh-m/宿主兼容门（includePrerelease: true）不拒新 rc 线；包管理器 peer 解析（默认语义）在物化图中可能 ERESOLVE。六条 peer RANGE 字符串、测试实体、发版行为均不变。
- 执行范围调整（主人指示）：执行至 Task 8 为止（热修 + 源码修复 + registry 本地编辑 + know-how 立档）；**Task 9（发版）与 Task 10（装机退役）暂缓**，待主人另行安排 subagent 评审后再继续。
- 2026-10-18 执行偏差记录：know-how 编号 **033 已被并行工作占用**（`033-dsh-plugin-compat-audit-methodology.md`，索引使用规则 3 现写「下一篇 034」）——本案立档按顺延规则改编号为 **034**（`034-dsh-skins-desktop-webruntime-compat.md`）；原 Task 8 的 R1-9 子项（修正索引「下一篇 028」过时表述）已由该并行更新完成，子项免除。
- 2026-10-18 执行发现（热修诊断，T3 期间）：本计划的惰性解析初版（属性访问 `hostContext.webStartup?.…`）在真实宿主上仍失败——**cordis 对未 inject 服务的属性访问直接抛 `cannot get property "webStartup" without inject`（throwing getter），`?.` 链不可防护**；异常被 `dsh-host-webserver` 分发兜底转为**裸 400 空体**（`.catch(err => { logger.warn; res.writeHead(400); res.end(); })`）。修复＝改用非抛的 `ctx.get(name)`（apply 外层 Context 上的核心方法，better-sidebar `owner.get` 同款）+ 逐服务独立 try/catch。热修三度迭代（v1 属性访问 400 → v1.5 诊断包装 500 抓栈 → v2 ctx.get 200）后 desktop rc.2 实测 200。源码线 T4 已同步采用 ctx.get 形态。
- 2026-10-18 执行偏差记录（评审 R1-1 补记，impl-reviewer 基线对照定谳）：`pnpm run check` 在本机为红——**4 个既有失败**（`build-meirenzhi-wallpapers.test.mjs` 三例 + `personalization-store.test.mjs:453` 一例），基线 worktree `af50173` 同命令同败（**非本三提交引入**），dsh 运行时 node v24.21.0 复跑同败（非 node 版本差异）；根因线索＝meirenzhi 测试夹具 POSIX 专属（无扩展名 shebang shim + PATH `:` 分隔，`tests/build-meirenzhi-wallpapers.test.mjs` L39-49/L63），Windows 结构性必挂。**Task 6「check 全绿」验收在本机不可达，判据修正为**：基线对照后无新增失败（255 测试 251 绿）+ 新增 10 例（trusted-hosts 6 + peer-range 4）与改写 1 例（built-host）合计 11 例全绿（`tests 11 / pass 11`，R2-1 勘误）+ smoke 过 + verify 三件套绿——Task 6 即按此判据交付（「除 4 个基线既有失败外全绿」），未声称字面全绿。Task 9 发版门禁按修正判据执行；既有失败的处置三选一（修夹具 Windows 兼容〔计划外，列建议〕/POSIX 环境跑门禁/主人显式豁免）→ 列「待主人决策」。
- 2026-10-18 执行偏差记录（评审 R1-2/R1-3 补记）：registry description 实际文案较 Task 7 批准文本压缩（`…已适配 web 与 Desktop 0.2.0-rc.1+，详见仓库。`）——原拟文案触发 validate 当量软警告（79.5>60），细节按 validate 指引归 homepage/README 版本对照表（Task 9 落地）；压缩后复跑 validate exit 0、dsh-skins 零警告。另：评审轮 validate-registry 出现 GitHub API 限额（20 条 ✗ 全量失败、exit 1）属环境性——**Task 7 push 前须在限额恢复或设 GITHUB_TOKEN 后复跑 validate 取全绿记录**（R1-3）。
