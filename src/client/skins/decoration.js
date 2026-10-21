/**
 * 皮肤装饰族机制（ADR-0016）——三皮共享的装饰不变量收拢于此，与
 * frost-family.js 平级同 doctrine：机制住共享模块，色值/metrics/品牌资源
 * 由各皮肤声明自持（调用方只注入 scope 与 palette）。
 *
 * ── 气泡描边（ADR-0006 谱系）────────────────────────────────────────
 * 用户气泡 + 目标面板气泡的描边与轻投影挂接用 :is() 并集（精确哈希 ∪
 * 结构化）：哈希漂移与 DOM 结构变化两种单点故障各有一支兜底，钩子前提由
 * scripts/verify-upstream-hooks.mjs 在 check 时钉住（该守卫与本模块同源
 * 消费 BUBBLE_HOOKS——哈希重推导的单点编辑处即下方对象，ADR-0011 Q3
 * 递延债就此收账）。失效仅影响描边装饰，token 填充仍然生效；结构分支
 * 不命中 goal 面板气泡（其容器 _stack 不含 userStack 子串，ADR-0006
 * 实测），goal 面板经自己的 _stack 并集描边（ADR-0006 v1.0.4 amendment：
 * 主人目测 goal 无描边观感不佳，裁决扩入）。
 *
 * canonical 字节格式 = minified 单行（ADR-0016 Decision 4）：meirenzhi
 * 收拢前的手抄行即 canonical——tests/meirenzhi-skin.test.mjs 的既有
 * golden 零改动通过是本模块的正确性判据（ADR-0012 frost 家族同款
 * rule-byte-canonical 验收）。
 */

/** 气泡钩子唯一事实对象：哈希漂移重推导（bump runtime-pin 后）只改这里。 */
export const BUBBLE_HOOKS = {
  chat: { exact: "Sixlwa_bubble", container: "userStack" },
  goal: { exact: "oRe1gG_bubble", container: "_stack" },
  bubbleLocal: "_bubble",
};

const unionSelector = (hook) =>
  `:is([class*="${hook.exact}"], [class*="${hook.container}"] > [class*="${BUBBLE_HOOKS.bubbleLocal}"])`;

/**
 * 用户+目标气泡描边 4 规则（明暗 × 两表面）。
 * palette = { light: "R, G, B", dark: "R, G, B" }（ADR-0012 tint 同形）；
 * 描边 alpha（0.38/0.10）与投影几何（0 1px 4px / 0 1px 6px）为机制常量
 * （三皮全等，非皮肤自由度）。
 */
export function decorationCss(scope, palette) {
  const chat = unionSelector(BUBBLE_HOOKS.chat);
  const goal = unionSelector(BUBBLE_HOOKS.goal);
  return [
    `${scope} ${chat}{border:1px solid rgba(${palette.light}, 0.38);box-shadow:0 1px 4px rgba(${palette.light}, 0.10)}`,
    `${scope}[data-ds-dark-theme] ${chat}{border-color:rgba(${palette.dark}, 0.38);box-shadow:0 1px 6px rgba(${palette.dark}, 0.10)}`,
    `${scope} ${goal}{border:1px solid rgba(${palette.light}, 0.38);box-shadow:0 1px 4px rgba(${palette.light}, 0.10)}`,
    `${scope}[data-ds-dark-theme] ${goal}{border-color:rgba(${palette.dark}, 0.38);box-shadow:0 1px 6px rgba(${palette.dark}, 0.10)}`,
  ].join("\n");
}
